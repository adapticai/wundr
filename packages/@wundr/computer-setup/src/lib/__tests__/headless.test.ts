import {
  isHeadless,
  isInteractive,
  nonInteractiveEnv,
  parseCommandLineToolsLabel,
} from '../headless';

describe('parseCommandLineToolsLabel', () => {
  it('picks the newest "Command Line Tools" label from modern softwareupdate output', () => {
    const output = [
      'Software Update Tool',
      '',
      'Finding available software',
      'Software Update found the following new or updated software:',
      '* Label: Command Line Tools for Xcode-14.1',
      '\tTitle: Command Line Tools for Xcode, Version: 14.1, Size: 700000KiB',
      '* Label: Command Line Tools for Xcode-15.3',
      '\tTitle: Command Line Tools for Xcode, Version: 15.3, Size: 745000KiB',
      '* Label: macOS Sequoia 15.5-24F74',
      '\tTitle: macOS Sequoia 15.5',
    ].join('\n');

    expect(parseCommandLineToolsLabel(output)).toBe(
      'Command Line Tools for Xcode-15.3'
    );
  });

  it('handles the older un-labelled softwareupdate format', () => {
    const output = [
      'Software Update Tool',
      '',
      '* Command Line Tools (macOS High Sierra version 10.13) for Xcode-9.4',
      '* Command Line Tools (macOS High Sierra version 10.13) for Xcode-10.1',
    ].join('\n');

    expect(parseCommandLineToolsLabel(output)).toBe(
      'Command Line Tools (macOS High Sierra version 10.13) for Xcode-10.1'
    );
  });

  it('returns null when no Command Line Tools package is offered', () => {
    expect(parseCommandLineToolsLabel('No new software available.')).toBeNull();
  });
});

describe('headless detection', () => {
  const originalCI = process.env.CI;
  const originalOverride = process.env.WUNDR_NONINTERACTIVE;

  afterEach(() => {
    if (originalCI === undefined) delete process.env.CI;
    else process.env.CI = originalCI;
    if (originalOverride === undefined) delete process.env.WUNDR_NONINTERACTIVE;
    else process.env.WUNDR_NONINTERACTIVE = originalOverride;
  });

  it('treats CI as non-interactive even if a TTY is reported', () => {
    process.env.CI = '1';
    expect(isInteractive()).toBe(false);
    expect(isHeadless()).toBe(true);
  });

  it('honours the WUNDR_NONINTERACTIVE override', () => {
    delete process.env.CI;
    process.env.WUNDR_NONINTERACTIVE = '1';
    expect(isInteractive()).toBe(false);
  });
});

describe('nonInteractiveEnv', () => {
  it('sets the flags that suppress installer prompts', () => {
    const env = nonInteractiveEnv();
    expect(env.NONINTERACTIVE).toBe('1');
    expect(env.HOMEBREW_NO_ANALYTICS).toBe('1');
    expect(env.RUNZSH).toBe('no');
    expect(env.CHSH).toBe('no');
    expect(env.KEEP_ZSHRC).toBe('yes');
  });

  it('merges caller-provided overrides last', () => {
    const env = nonInteractiveEnv({ HOMEBREW_NO_ANALYTICS: '0', FOO: 'bar' });
    expect(env.HOMEBREW_NO_ANALYTICS).toBe('0');
    expect(env.FOO).toBe('bar');
  });
});
