/**
 * Tests for DebugLogger and TaggedLogger.
 *
 * Covers log levels, filtering, tag support, performance timing,
 * entry collection, colour suppression, and factory method.
 */

import { DebugLogger, TaggedLogger } from '../../../src/framework/debug-logger';
import type { LogLevel } from '../../../src/framework/debug-logger';
import type { GlobalOptions } from '../../../src/framework/command-interface';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLogger(
  overrides: Partial<ConstructorParameters<typeof DebugLogger>[0]> = {},
) {
  const output: string[] = [];
  const errorOutput: string[] = [];

  const logger = new DebugLogger({
    noColor: true,
    isTTY: false,
    collectEntries: true,
    write: (msg: string) => output.push(msg),
    writeError: (msg: string) => errorOutput.push(msg),
    ...overrides,
  });

  return { logger, output, errorOutput };
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('DebugLogger', () => {
  // ----- Basic level filtering -----

  describe('log level filtering', () => {
    it('should default to info level', () => {
      const { logger } = createLogger();
      expect(logger.getLevel()).toBe('info');
    });

    it('should respect the configured level', () => {
      const { logger } = createLogger({ level: 'warn' });
      expect(logger.getLevel()).toBe('warn');
    });

    it('should suppress messages below the configured level', () => {
      const { logger, output } = createLogger({ level: 'warn' });

      logger.info('should be suppressed');
      logger.debug('should be suppressed');

      expect(output).toHaveLength(0);
    });

    it('should emit messages at or above the configured level', () => {
      const { logger, output, errorOutput } = createLogger({ level: 'warn' });

      logger.warn('visible warning');
      logger.error('visible error');

      // warn goes to write, error goes to writeError
      expect(output).toHaveLength(1);
      expect(errorOutput).toHaveLength(1);
      expect(output[0]).toContain('visible warning');
      expect(errorOutput[0]).toContain('visible error');
    });

    it('should pass all messages through at trace level', () => {
      const { logger, output, errorOutput } = createLogger({ level: 'trace' });

      logger.trace('t');
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(output.length + errorOutput.length).toBe(5);
    });

    it('should suppress everything at silent level', () => {
      const { logger, output, errorOutput } = createLogger({ level: 'silent' });

      logger.error('should be suppressed');
      logger.info('should be suppressed');

      expect(output).toHaveLength(0);
      expect(errorOutput).toHaveLength(0);
    });
  });

  // ----- setLevel / getLevel -----

  describe('setLevel', () => {
    it('should update the level at runtime', () => {
      const { logger, output } = createLogger({ level: 'error' });

      logger.info('suppressed');
      expect(output).toHaveLength(0);

      logger.setLevel('info');
      expect(logger.getLevel()).toBe('info');

      logger.info('visible');
      expect(output).toHaveLength(1);
    });

    it('should enable timestamps when switching to debug', () => {
      const { logger, output } = createLogger({ level: 'info' });

      // info level -> no timestamps by default
      logger.info('no timestamp');
      expect(output[0]).not.toMatch(/\d{2}:\d{2}:\d{2}/);

      logger.setLevel('debug');
      logger.info('has timestamp');
      // The second output line should contain an HH:mm:ss pattern
      expect(output[1]).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });

  // ----- Entry collection -----

  describe('entry collection', () => {
    it('should collect entries when collectEntries is enabled', () => {
      const { logger } = createLogger({ collectEntries: true, level: 'debug' });

      logger.info('first');
      logger.debug('second');
      logger.warn('third');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0]!.level).toBe('info');
      expect(entries[0]!.message).toBe('first');
      expect(entries[1]!.level).toBe('debug');
      expect(entries[2]!.level).toBe('warn');
    });

    it('should not collect entries when collectEntries is disabled', () => {
      const { logger } = createLogger({ collectEntries: false });

      logger.info('not collected');

      expect(logger.getEntries()).toHaveLength(0);
    });

    it('should clear entries', () => {
      const { logger } = createLogger({ collectEntries: true });

      logger.info('message');
      expect(logger.getEntries()).toHaveLength(1);

      logger.clearEntries();
      expect(logger.getEntries()).toHaveLength(0);
    });

    it('should record timestamp on every entry', () => {
      const { logger } = createLogger({ collectEntries: true });
      logger.info('stamped');

      const entry = logger.getEntries()[0]!;
      expect(entry.timestamp).toBeInstanceOf(Date);
    });
  });

  // ----- Tag filtering -----

  describe('tag filtering', () => {
    it('should include tagged messages when no filter is set', () => {
      const { logger, output } = createLogger({ level: 'debug' });

      logger.logTagged('info', 'http', 'request received');

      expect(output).toHaveLength(1);
      expect(output[0]).toContain('[http]');
    });

    it('should include only matching tags when includeTags is set', () => {
      const { logger, output } = createLogger({
        level: 'debug',
        includeTags: ['http'],
      });

      logger.logTagged('info', 'http', 'included');
      logger.logTagged('info', 'db', 'excluded');

      expect(output).toHaveLength(1);
      expect(output[0]).toContain('included');
    });

    it('should exclude matching tags when excludeTags is set', () => {
      const { logger, output } = createLogger({
        level: 'debug',
        excludeTags: ['noisy'],
      });

      logger.logTagged('info', 'noisy', 'excluded');
      logger.logTagged('info', 'http', 'included');

      expect(output).toHaveLength(1);
      expect(output[0]).toContain('included');
    });
  });

  // ----- Error routing -----

  describe('error routing', () => {
    it('should route error messages to writeError', () => {
      const { logger, output, errorOutput } = createLogger({ level: 'error' });

      logger.error('bad thing happened');

      expect(output).toHaveLength(0);
      expect(errorOutput).toHaveLength(1);
      expect(errorOutput[0]).toContain('bad thing happened');
    });
  });

  // ----- success() method -----

  describe('success', () => {
    it('should log at info level', () => {
      const { logger } = createLogger({ collectEntries: true });

      logger.success('done!');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.level).toBe('info');
      expect(entries[0]!.message).toBe('done!');
    });
  });

  // ----- Performance timing -----

  describe('performance timing', () => {
    it('should return a positive duration for time/timeEnd', () => {
      const { logger } = createLogger({ level: 'debug' });

      logger.time('op');
      // Small synchronous work to ensure a measurable duration
      let sum = 0;
      for (let i = 0; i < 1000; i++) sum += i;
      const duration = logger.timeEnd('op');

      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should return -1 for a timer that was never started', () => {
      const { logger } = createLogger({ level: 'debug' });

      const duration = logger.timeEnd('nonexistent');
      expect(duration).toBe(-1);
    });

    it('should remove the timer after timeEnd', () => {
      const { logger } = createLogger({ level: 'debug' });

      logger.time('once');
      logger.timeEnd('once');

      // Second call should not find the timer
      const second = logger.timeEnd('once');
      expect(second).toBe(-1);
    });
  });

  // ----- isPiped -----

  describe('isPiped', () => {
    it('should return true when isTTY is false', () => {
      const { logger } = createLogger({ isTTY: false });
      expect(logger.isPiped()).toBe(true);
    });

    it('should return false when isTTY is true', () => {
      const { logger } = createLogger({ isTTY: true });
      expect(logger.isPiped()).toBe(false);
    });
  });

  // ----- Format output with noColor -----

  describe('noColor formatting', () => {
    it('should include level badge in plain text', () => {
      const { logger, output } = createLogger({ noColor: true });

      logger.info('message');

      expect(output[0]).toContain('[INF]');
    });

    it('should include ERR badge for errors', () => {
      const { logger, errorOutput } = createLogger({ noColor: true });

      logger.error('oops');

      expect(errorOutput[0]).toContain('[ERR]');
    });

    it('should include WRN badge for warnings', () => {
      const { logger, output } = createLogger({ noColor: true });

      logger.warn('careful');

      expect(output[0]).toContain('[WRN]');
    });
  });

  // ----- data logging -----

  describe('data logging in debug mode', () => {
    it('should output data as indented JSON when at debug level', () => {
      const { logger, output } = createLogger({ level: 'debug', noColor: true });

      logger.info('with data', { key: 'value' });

      // The data line should be the second write call
      expect(output.length).toBeGreaterThanOrEqual(2);
      expect(output[1]).toContain('key');
    });
  });

  // ----- fromGlobalOptions factory -----

  describe('fromGlobalOptions', () => {
    it('should set level to debug when verbose is true', () => {
      const opts: GlobalOptions = {
        verbose: true,
        quiet: false,
        json: false,
        noColor: false,
        dryRun: false,
      };

      const logger = DebugLogger.fromGlobalOptions(opts);
      expect(logger.getLevel()).toBe('debug');
    });

    it('should set level to error when quiet is true', () => {
      const opts: GlobalOptions = {
        verbose: false,
        quiet: true,
        json: false,
        noColor: false,
        dryRun: false,
      };

      const logger = DebugLogger.fromGlobalOptions(opts);
      expect(logger.getLevel()).toBe('error');
    });

    it('should default to info when neither verbose nor quiet', () => {
      const opts: GlobalOptions = {
        verbose: false,
        quiet: false,
        json: false,
        noColor: false,
        dryRun: false,
      };

      const logger = DebugLogger.fromGlobalOptions(opts);
      expect(logger.getLevel()).toBe('info');
    });

    it('should prefer verbose over quiet when both are set', () => {
      const opts: GlobalOptions = {
        verbose: true,
        quiet: true,
        json: false,
        noColor: false,
        dryRun: false,
      };

      // verbose is checked second, so it overwrites quiet
      const logger = DebugLogger.fromGlobalOptions(opts);
      expect(logger.getLevel()).toBe('debug');
    });
  });
});

// ---------------------------------------------------------------------------
// TaggedLogger
// ---------------------------------------------------------------------------

describe('TaggedLogger', () => {
  it('should delegate debug to parent with tag', () => {
    const { logger, output } = createLogger({ level: 'debug', noColor: true });
    const tagged = logger.tagged('http');

    tagged.debug('request');

    expect(output).toHaveLength(1);
    expect(output[0]).toContain('[http]');
    expect(output[0]).toContain('request');
  });

  it('should delegate info to parent with tag', () => {
    const { logger, output } = createLogger({ noColor: true });
    const tagged = logger.tagged('db');

    tagged.info('connected');

    expect(output).toHaveLength(1);
    expect(output[0]).toContain('[db]');
  });

  it('should delegate warn to parent with tag', () => {
    const { logger, output } = createLogger({ noColor: true });
    const tagged = logger.tagged('cache');

    tagged.warn('miss');

    expect(output).toHaveLength(1);
    expect(output[0]).toContain('[cache]');
  });

  it('should delegate error to parent with tag', () => {
    const { logger, errorOutput } = createLogger({ noColor: true });
    const tagged = logger.tagged('auth');

    tagged.error('denied');

    expect(errorOutput).toHaveLength(1);
    expect(errorOutput[0]).toContain('[auth]');
  });

  it('should delegate success to parent as info with tag', () => {
    const { logger } = createLogger({ collectEntries: true });
    const tagged = logger.tagged('deploy');

    tagged.success('deployed');

    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.level).toBe('info');
    expect(entries[0]!.tag).toBe('deploy');
  });

  it('should be filtered by parent excludeTags', () => {
    const { logger, output } = createLogger({
      noColor: true,
      excludeTags: ['noisy'],
    });
    const tagged = logger.tagged('noisy');

    tagged.info('should be hidden');

    expect(output).toHaveLength(0);
  });
});
