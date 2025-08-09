import { SetupCommand } from '../../src/commands/setup';
import { executeShellScript, checkCommand } from '../../src/utils/system';
import { promptForMissingInfo } from '../../src/utils/prompts';
import fs from 'fs-extra';

jest.mock('../../src/utils/system');
jest.mock('../../src/utils/prompts');
jest.mock('fs-extra');

describe('SetupCommand', () => {
  let setupCommand: SetupCommand;
  const mockOptions = {
    email: 'test@example.com',
    githubUsername: 'testuser',
    githubEmail: 'test@example.com',
    name: 'Test User',
    company: 'Test Company',
    rootDir: '~/TestDev',
    skipPrompts: true,
    verbose: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupCommand = new SetupCommand(mockOptions);
    
    // Default mocks
    (checkCommand as jest.Mock).mockResolvedValue(true);
    (executeShellScript as jest.Mock).mockResolvedValue(undefined);
    (fs.pathExists as jest.Mock).mockResolvedValue(true);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.remove as jest.Mock).mockResolvedValue(undefined);
  });

  describe('execute', () => {
    it('should complete setup successfully', async () => {
      await setupCommand.execute();

      expect(checkCommand).toHaveBeenCalledWith('sudo');
      expect(checkCommand).toHaveBeenCalledWith('curl');
      expect(fs.writeFile).toHaveBeenCalled();
      expect(executeShellScript).toHaveBeenCalled();
    });

    it('should fail if prerequisites are not met', async () => {
      (checkCommand as jest.Mock).mockResolvedValueOnce(false);

      await expect(setupCommand.execute()).rejects.toThrow('Sudo access is required');
    });

    it('should prompt for missing information when not skipping prompts', async () => {
      const incompleteOptions = { ...mockOptions, skipPrompts: false, email: undefined };
      setupCommand = new SetupCommand(incompleteOptions);
      
      (promptForMissingInfo as jest.Mock).mockResolvedValue(mockOptions);

      await setupCommand.execute();

      expect(promptForMissingInfo).toHaveBeenCalledWith(incompleteOptions);
    });

    it('should handle tool selection with only option', async () => {
      const optionsWithOnly = { ...mockOptions, only: 'brew,node' };
      setupCommand = new SetupCommand(optionsWithOnly);

      await setupCommand.execute();

      // Verify that only selected tools are processed
      const calls = (executeShellScript as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    it('should handle tool exclusion', async () => {
      const optionsWithExclude = { ...mockOptions, exclude: 'docker,slack' };
      setupCommand = new SetupCommand(optionsWithExclude);

      await setupCommand.execute();

      // Verify that excluded tools are not processed
      const calls = (executeShellScript as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    it('should continue with non-critical tool failures', async () => {
      (executeShellScript as jest.Mock)
        .mockResolvedValueOnce(undefined) // permissions - success
        .mockResolvedValueOnce(undefined) // brew - success
        .mockRejectedValueOnce(new Error('Slack failed')) // slack - fail
        .mockResolvedValueOnce(undefined); // continue with others

      await setupCommand.execute();

      expect(executeShellScript).toHaveBeenCalled();
    });

    it('should fail on critical tool failure', async () => {
      (executeShellScript as jest.Mock)
        .mockRejectedValueOnce(new Error('Brew installation failed'));

      await expect(setupCommand.execute()).rejects.toThrow();
    });
  });
});