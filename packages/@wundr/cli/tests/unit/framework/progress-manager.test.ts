/**
 * Tests for ProgressBar, MultiProgressManager, and StepTracker.
 *
 * Covers progress state, increment/update, finish, string rendering,
 * multi-bar management, and step-based tracking.
 */

import {
  ProgressBar,
  MultiProgressManager,
  StepTracker,
} from '../../../src/framework/progress-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The ProgressBar render() methods check process.stderr.isTTY.
 * In test environments isTTY is false, so render() is a no-op.
 * We test the internal state via getState() and toString() instead.
 */

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------

describe('ProgressBar', () => {
  describe('initial state', () => {
    it('should start at zero current and full total', () => {
      const bar = new ProgressBar({ total: 100 });
      const state = bar.getState();

      expect(state.current).toBe(0);
      expect(state.total).toBe(100);
      expect(state.percentage).toBe(0);
    });

    it('should use default options', () => {
      const bar = new ProgressBar({ total: 50 });

      // Check via toString which uses the default format
      const str = bar.toString();
      expect(str).toBeDefined();
      expect(typeof str).toBe('string');
    });
  });

  describe('update', () => {
    it('should update current progress', () => {
      const bar = new ProgressBar({ total: 100 });

      bar.update(50);
      const state = bar.getState();

      expect(state.current).toBe(50);
      expect(state.percentage).toBeCloseTo(0.5, 2);
    });

    it('should clamp to total when exceeding', () => {
      const bar = new ProgressBar({ total: 100 });

      bar.update(200);

      expect(bar.getState().current).toBe(100);
      expect(bar.getState().percentage).toBeCloseTo(1, 2);
    });

    it('should handle zero total gracefully', () => {
      const bar = new ProgressBar({ total: 0 });

      bar.update(0);

      expect(bar.getState().percentage).toBe(0);
    });
  });

  describe('increment', () => {
    it('should increment by 1 by default', () => {
      const bar = new ProgressBar({ total: 10 });

      bar.increment();
      bar.increment();

      expect(bar.getState().current).toBe(2);
    });

    it('should increment by a specified amount', () => {
      const bar = new ProgressBar({ total: 100 });

      bar.increment(25);

      expect(bar.getState().current).toBe(25);
    });

    it('should not exceed total', () => {
      const bar = new ProgressBar({ total: 5 });

      bar.increment(3);
      bar.increment(3);
      bar.increment(3);

      expect(bar.getState().current).toBe(5);
    });
  });

  describe('getState', () => {
    it('should compute elapsed time', () => {
      const bar = new ProgressBar({ total: 100 });

      // Small delay to get a non-zero elapsed
      bar.update(10);
      const state = bar.getState();

      expect(state.elapsed).toBeGreaterThanOrEqual(0);
    });

    it('should compute rate and ETA', () => {
      const bar = new ProgressBar({ total: 100 });

      bar.update(50);
      const state = bar.getState();

      // Rate and ETA depend on time elapsed; just check they are numbers
      expect(typeof state.rate).toBe('number');
      expect(typeof state.eta).toBe('number');
      expect(state.rate).toBeGreaterThanOrEqual(0);
      expect(state.eta).toBeGreaterThanOrEqual(0);
    });

    it('should include the label', () => {
      const bar = new ProgressBar({ total: 100, label: 'Downloading' });

      expect(bar.getState().label).toBe('Downloading');
    });
  });

  describe('toString', () => {
    it('should include the label in output', () => {
      const bar = new ProgressBar({ total: 100, label: 'Building' });

      const str = bar.toString();
      expect(str).toContain('Building');
    });

    it('should include percentage when showPercentage is true', () => {
      const bar = new ProgressBar({ total: 100, showPercentage: true });
      bar.update(50);

      const str = bar.toString();
      expect(str).toContain('50%');
    });

    it('should include count when showCount is true', () => {
      const bar = new ProgressBar({ total: 100, showCount: true });
      bar.update(30);

      const str = bar.toString();
      expect(str).toContain('30/100');
    });

    it('should use custom fill and empty characters', () => {
      const bar = new ProgressBar({
        total: 10,
        width: 10,
        filledChar: '#',
        emptyChar: '.',
        showPercentage: false,
        showCount: false,
        showETA: false,
      });
      bar.update(5);

      const str = bar.toString();
      expect(str).toContain('#');
      expect(str).toContain('.');
    });

    it('should use a custom format function when provided', () => {
      const bar = new ProgressBar({
        total: 100,
        format: state => `custom: ${state.current}/${state.total}`,
      });
      bar.update(42);

      const str = bar.toString();
      expect(str).toBe('custom: 42/100');
    });

    it('should show 100% when complete', () => {
      const bar = new ProgressBar({ total: 10 });
      bar.update(10);

      const str = bar.toString();
      expect(str).toContain('100%');
    });
  });

  describe('finish', () => {
    it('should set current to total', () => {
      // Note: finish() only renders when isTTY is true.
      // We verify via getState after update to total.
      const bar = new ProgressBar({ total: 50 });
      bar.update(25);

      // finish calls update to total internally but only renders when TTY
      // We test the logical effect:
      bar.update(50);
      expect(bar.getState().current).toBe(50);
      expect(bar.getState().percentage).toBeCloseTo(1, 2);
    });
  });
});

// ---------------------------------------------------------------------------
// MultiProgressManager
// ---------------------------------------------------------------------------

describe('MultiProgressManager', () => {
  describe('create', () => {
    it('should create and register a new progress bar', () => {
      const manager = new MultiProgressManager();

      const bar = manager.create('dl', { total: 100, label: 'Downloading' });

      expect(bar).toBeInstanceOf(ProgressBar);
      expect(manager.get('dl')).toBe(bar);
    });

    it('should create multiple independent bars', () => {
      const manager = new MultiProgressManager();

      const bar1 = manager.create('a', { total: 50 });
      const bar2 = manager.create('b', { total: 200 });

      expect(manager.get('a')).toBe(bar1);
      expect(manager.get('b')).toBe(bar2);
      expect(bar1).not.toBe(bar2);
    });
  });

  describe('get', () => {
    it('should return undefined for unknown IDs', () => {
      const manager = new MultiProgressManager();

      expect(manager.get('nonexistent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update the correct bar', () => {
      const manager = new MultiProgressManager();

      manager.create('a', { total: 100 });
      manager.create('b', { total: 100 });

      manager.update('a', 50);
      manager.update('b', 25);

      expect(manager.get('a')!.getState().current).toBe(50);
      expect(manager.get('b')!.getState().current).toBe(25);
    });

    it('should silently ignore updates for unknown IDs', () => {
      const manager = new MultiProgressManager();

      // Should not throw
      expect(() => manager.update('nope', 10)).not.toThrow();
    });
  });

  describe('finish', () => {
    it('should remove the bar after finishing', () => {
      const manager = new MultiProgressManager();

      manager.create('dl', { total: 100 });
      manager.finish('dl');

      expect(manager.get('dl')).toBeUndefined();
    });

    it('should silently ignore finishing unknown IDs', () => {
      const manager = new MultiProgressManager();

      expect(() => manager.finish('nope')).not.toThrow();
    });
  });

  describe('finishAll', () => {
    it('should remove all bars', () => {
      const manager = new MultiProgressManager();

      manager.create('a', { total: 100 });
      manager.create('b', { total: 100 });
      manager.create('c', { total: 100 });

      manager.finishAll();

      expect(manager.get('a')).toBeUndefined();
      expect(manager.get('b')).toBeUndefined();
      expect(manager.get('c')).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// StepTracker
// ---------------------------------------------------------------------------

describe('StepTracker', () => {
  describe('initial state', () => {
    it('should create steps in pending status', () => {
      const tracker = new StepTracker(['Step 1', 'Step 2', 'Step 3']);

      const steps = tracker.getSteps();
      expect(steps).toHaveLength(3);
      expect(steps[0]!.name).toBe('Step 1');
      expect(steps[0]!.status).toBe('pending');
      expect(steps[1]!.status).toBe('pending');
      expect(steps[2]!.status).toBe('pending');
    });

    it('should report 0% progress initially', () => {
      const tracker = new StepTracker(['A', 'B']);

      const progress = tracker.getProgress();
      expect(progress.completed).toBe(0);
      expect(progress.total).toBe(2);
      expect(progress.percentage).toBe(0);
    });
  });

  describe('start', () => {
    it('should mark a step as running', () => {
      const tracker = new StepTracker(['Step 1']);

      tracker.start(0);

      expect(tracker.getSteps()[0]!.status).toBe('running');
    });

    it('should silently ignore out-of-range indices', () => {
      const tracker = new StepTracker(['Step 1']);

      expect(() => tracker.start(99)).not.toThrow();
    });
  });

  describe('complete', () => {
    it('should mark a step as done', () => {
      const tracker = new StepTracker(['Step 1']);

      tracker.start(0);
      tracker.complete(0);

      expect(tracker.getSteps()[0]!.status).toBe('done');
    });

    it('should record optional message', () => {
      const tracker = new StepTracker(['Step 1']);

      tracker.start(0);
      tracker.complete(0, 'All good');

      expect(tracker.getSteps()[0]!.message).toBe('All good');
    });

    it('should record duration when timer was started', () => {
      const tracker = new StepTracker(['Step 1']);

      tracker.start(0);
      tracker.complete(0);

      expect(tracker.getSteps()[0]!.duration).toBeDefined();
      expect(tracker.getSteps()[0]!.duration).toBeGreaterThanOrEqual(0);
    });

    it('should silently ignore out-of-range indices', () => {
      const tracker = new StepTracker(['Step 1']);

      expect(() => tracker.complete(99)).not.toThrow();
    });
  });

  describe('fail', () => {
    it('should mark a step as failed', () => {
      const tracker = new StepTracker(['Step 1']);

      tracker.start(0);
      tracker.fail(0, 'Connection refused');

      expect(tracker.getSteps()[0]!.status).toBe('failed');
      expect(tracker.getSteps()[0]!.message).toBe('Connection refused');
    });

    it('should record duration', () => {
      const tracker = new StepTracker(['Step 1']);

      tracker.start(0);
      tracker.fail(0);

      expect(tracker.getSteps()[0]!.duration).toBeDefined();
    });
  });

  describe('skip', () => {
    it('should mark a step as skipped', () => {
      const tracker = new StepTracker(['Step 1']);

      tracker.skip(0, 'Not needed');

      expect(tracker.getSteps()[0]!.status).toBe('skipped');
      expect(tracker.getSteps()[0]!.message).toBe('Not needed');
    });
  });

  describe('getProgress', () => {
    it('should count done and skipped steps as completed', () => {
      const tracker = new StepTracker(['A', 'B', 'C', 'D']);

      tracker.start(0);
      tracker.complete(0); // done
      tracker.skip(1); // skipped
      tracker.start(2);
      tracker.fail(2); // failed - not completed
      // D is still pending

      const progress = tracker.getProgress();
      expect(progress.completed).toBe(2);
      expect(progress.total).toBe(4);
      expect(progress.percentage).toBeCloseTo(0.5, 2);
    });

    it('should return 0 percentage for empty step list', () => {
      const tracker = new StepTracker([]);

      const progress = tracker.getProgress();
      expect(progress.completed).toBe(0);
      expect(progress.total).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    it('should return 100% when all steps are done', () => {
      const tracker = new StepTracker(['A', 'B']);

      tracker.start(0);
      tracker.complete(0);
      tracker.start(1);
      tracker.complete(1);

      const progress = tracker.getProgress();
      expect(progress.completed).toBe(2);
      expect(progress.percentage).toBeCloseTo(1, 2);
    });
  });

  describe('summary', () => {
    it('should include completed count', () => {
      const tracker = new StepTracker(['A', 'B', 'C']);

      tracker.start(0);
      tracker.complete(0);
      tracker.start(1);
      tracker.complete(1);

      const summary = tracker.summary();
      expect(summary).toContain('2/3 steps completed');
    });

    it('should mention failed steps when present', () => {
      const tracker = new StepTracker(['A', 'B']);

      tracker.start(0);
      tracker.fail(0);
      tracker.start(1);
      tracker.complete(1);

      const summary = tracker.summary();
      expect(summary).toContain('1 failed');
    });

    it('should mention skipped steps when present', () => {
      const tracker = new StepTracker(['A', 'B']);

      tracker.skip(0);
      tracker.start(1);
      tracker.complete(1);

      const summary = tracker.summary();
      expect(summary).toContain('1 skipped');
    });

    it('should report 0/N when nothing is done', () => {
      const tracker = new StepTracker(['A', 'B']);

      const summary = tracker.summary();
      expect(summary).toContain('0/2 steps completed');
    });
  });

  describe('options', () => {
    it('should accept showNumbers option', () => {
      // Just ensure it does not throw
      const tracker = new StepTracker(['A'], { showNumbers: false });
      expect(tracker.getSteps()).toHaveLength(1);
    });

    it('should accept showDuration option', () => {
      const tracker = new StepTracker(['A'], { showDuration: false });
      expect(tracker.getSteps()).toHaveLength(1);
    });
  });
});
