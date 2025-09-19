import { Command } from 'commander';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { ConfigManager } from '../utils/config-manager';
import { PluginManager } from '../plugins/plugin-manager';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/error-handler';

/**
 * Dashboard commands for web interface and visualization
 */
export class DashboardCommands {
  constructor(
    private program: Command,
    private configManager: ConfigManager,
    private pluginManager: PluginManager
  ) {
    this.registerCommands();
  }

  private registerCommands(): void {
    const dashboardCmd = this.program
      .command('dashboard')
      .alias('dash')
      .description('dashboard and visualization tools');

    // Start dashboard
    dashboardCmd
      .command('start')
      .description('start the web dashboard')
      .option('--port <port>', 'dashboard port', '3000')
      .option('--host <host>', 'dashboard host', 'localhost')
      .option('--open', 'open browser automatically')
      .option('--dev', 'start in development mode')
      .action(async options => {
        await this.startDashboard(options);
      });

    // Stop dashboard
    dashboardCmd
      .command('stop')
      .description('stop the web dashboard')
      .action(async () => {
        await this.stopDashboard();
      });

    // Dashboard status
    dashboardCmd
      .command('status')
      .description('check dashboard status')
      .action(async () => {
        await this.checkDashboardStatus();
      });

    // Generate reports
    dashboardCmd
      .command('report <type>')
      .description('generate dashboard reports')
      .option('--output <path>', 'output directory')
      .option('--format <format>', 'report format (html, pdf, json)', 'html')
      .option(
        '--period <period>',
        'report period (daily, weekly, monthly)',
        'weekly'
      )
      .action(async (type, options) => {
        await this.generateReport(type, options);
      });

    // Export data
    dashboardCmd
      .command('export <type>')
      .description('export dashboard data')
      .option('--output <path>', 'output file path')
      .option('--format <format>', 'export format (json, csv, xlsx)', 'json')
      .option('--filter <filter>', 'data filter')
      .action(async (type, options) => {
        await this.exportData(type, options);
      });

    // Import data
    dashboardCmd
      .command('import <file>')
      .description('import data into dashboard')
      .option('--type <type>', 'data type to import')
      .option('--merge', 'merge with existing data')
      .action(async (file, options) => {
        await this.importData(file, options);
      });

    // Configure dashboard
    dashboardCmd.command('config').description('configure dashboard settings');

    dashboardCmd
      .command('config set <key> <value>')
      .description('set dashboard configuration')
      .action(async (key, value) => {
        await this.setDashboardConfig(key, value);
      });

    dashboardCmd
      .command('config get [key]')
      .description('get dashboard configuration')
      .action(async key => {
        await this.getDashboardConfig(key);
      });

    // Manage widgets
    dashboardCmd.command('widget').description('manage dashboard widgets');

    dashboardCmd
      .command('widget add <type>')
      .description('add a new widget')
      .option('--config <config>', 'widget configuration')
      .option('--position <position>', 'widget position')
      .action(async (type, options) => {
        await this.addWidget(type, options);
      });

    dashboardCmd
      .command('widget remove <id>')
      .description('remove a widget')
      .action(async id => {
        await this.removeWidget(id);
      });

    dashboardCmd
      .command('widget list')
      .description('list all widgets')
      .action(async () => {
        await this.listWidgets();
      });

    // Manage themes
    dashboardCmd
      .command('theme <action>')
      .description('manage dashboard themes')
      .option('--name <name>', 'theme name')
      .option('--config <config>', 'theme configuration')
      .action(async (action, options) => {
        await this.manageTheme(action, options);
      });
  }

  /**
   * Start the web dashboard
   */
  private async startDashboard(options: any): Promise<void> {
    try {
      logger.info('Starting Wundr dashboard...');

      // Check if dashboard is already running
      const isRunning = await this.isDashboardRunning();
      if (isRunning) {
        logger.warn('Dashboard is already running');
        if (options.open) {
          await this.openBrowser(`http://${options.host}:${options.port}`);
        }
        return;
      }

      // Ensure dashboard assets are available
      await this.ensureDashboardAssets();

      // Start the dashboard server
      const dashboardProcess = await this.startDashboardServer(options);

      // Save process info
      await this.saveDashboardProcess(dashboardProcess, options);

      logger.success(
        `Dashboard started at http://${options.host}:${options.port}`
      );

      if (options.open) {
        await this.openBrowser(`http://${options.host}:${options.port}`);
      }

      // Keep the process alive if not in dev mode
      if (!options.dev) {
        logger.info(
          'Dashboard is running in the background. Use "wundr dashboard stop" to stop it.'
        );
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_DASHBOARD_START_FAILED',
        'Failed to start dashboard',
        { options },
        true
      );
    }
  }

  /**
   * Stop the web dashboard
   */
  private async stopDashboard(): Promise<void> {
    try {
      logger.info('Stopping dashboard...');

      const processInfo = await this.loadDashboardProcess();
      if (!processInfo) {
        logger.warn('No running dashboard found');
        return;
      }

      // Kill the dashboard process
      process.kill(processInfo.pid, 'SIGTERM');

      // Clean up process info
      await this.cleanupDashboardProcess();

      logger.success('Dashboard stopped successfully');
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_DASHBOARD_STOP_FAILED',
        'Failed to stop dashboard',
        {},
        true
      );
    }
  }

  /**
   * Check dashboard status
   */
  private async checkDashboardStatus(): Promise<void> {
    try {
      const isRunning = await this.isDashboardRunning();
      const processInfo = await this.loadDashboardProcess();

      if (isRunning && processInfo) {
        logger.success(
          `Dashboard is running on http://${processInfo.host}:${processInfo.port}`
        );
        logger.info(`Process ID: ${processInfo.pid}`);
        logger.info(
          `Started: ${new Date(processInfo.started).toLocaleString()}`
        );
      } else {
        logger.info('Dashboard is not running');
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_DASHBOARD_STATUS_FAILED',
        'Failed to check dashboard status',
        {},
        true
      );
    }
  }

  /**
   * Generate dashboard reports
   */
  private async generateReport(type: string, options: any): Promise<void> {
    try {
      logger.info(`Generating ${type} report...`);

      const reportData = await this.collectReportData(type, options.period);
      const report = await this.formatReport(reportData, options.format);

      const outputPath =
        options.output || this.getDefaultReportPath(type, options.format);
      await this.saveReport(report, outputPath);

      logger.success(`Report generated: ${outputPath}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_DASHBOARD_REPORT_FAILED',
        'Failed to generate report',
        { type, options },
        true
      );
    }
  }

  /**
   * Export dashboard data
   */
  private async exportData(type: string, options: any): Promise<void> {
    try {
      logger.info(`Exporting ${type} data...`);

      const data = await this.collectExportData(type, options.filter);
      const exportedData = await this.formatExportData(data, options.format);

      const outputPath =
        options.output || this.getDefaultExportPath(type, options.format);
      await this.saveExportData(exportedData, outputPath);

      logger.success(`Data exported: ${outputPath}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_DASHBOARD_EXPORT_FAILED',
        'Failed to export data',
        { type, options },
        true
      );
    }
  }

  /**
   * Import data into dashboard
   */
  private async importData(file: string, options: any): Promise<void> {
    try {
      logger.info(`Importing data from ${chalk.cyan(file)}...`);

      if (!(await fs.pathExists(file))) {
        throw new Error(`File not found: ${file}`);
      }

      const data = await this.loadImportData(file);
      const validatedData = await this.validateImportData(data, options.type);

      if (options.merge) {
        await this.mergeImportData(validatedData, options.type);
      } else {
        await this.replaceImportData(validatedData, options.type);
      }

      logger.success(`Data imported successfully from ${file}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_DASHBOARD_IMPORT_FAILED',
        'Failed to import data',
        { file, options },
        true
      );
    }
  }

  /**
   * Set dashboard configuration
   */
  private async setDashboardConfig(key: string, value: string): Promise<void> {
    try {
      this.configManager.set(`dashboard.${key}`, value);
      await this.configManager.saveConfig();
      logger.success(`Dashboard configuration updated: ${key} = ${value}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_DASHBOARD_CONFIG_SET_FAILED',
        'Failed to set dashboard configuration',
        { key, value },
        true
      );
    }
  }

  /**
   * Get dashboard configuration
   */
  private async getDashboardConfig(key?: string): Promise<void> {
    try {
      if (key) {
        const value = this.configManager.get(`dashboard.${key}`);
        console.log(`${key}: ${value}`);
      } else {
        const dashboardConfig = this.configManager.get('dashboard');
        console.log(JSON.stringify(dashboardConfig, null, 2));
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_DASHBOARD_CONFIG_GET_FAILED',
        'Failed to get dashboard configuration',
        { key },
        true
      );
    }
  }

  /**
   * Add a new widget
   */
  private async addWidget(type: string, options: any): Promise<void> {
    try {
      logger.info(`Adding ${type} widget...`);

      const widget = {
        id: `widget-${Date.now()}`,
        type,
        config: options.config ? JSON.parse(options.config) : {},
        position: options.position
          ? JSON.parse(options.position)
          : { x: 0, y: 0 },
        created: new Date().toISOString(),
      };

      await this.saveWidget(widget);
      logger.success(`Widget added: ${widget.id}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_DASHBOARD_ADD_WIDGET_FAILED',
        'Failed to add widget',
        { type, options },
        true
      );
    }
  }

  /**
   * Remove a widget
   */
  private async removeWidget(id: string): Promise<void> {
    try {
      logger.info(`Removing widget: ${chalk.cyan(id)}`);

      await this.deleteWidget(id);
      logger.success(`Widget removed: ${id}`);
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_DASHBOARD_REMOVE_WIDGET_FAILED',
        'Failed to remove widget',
        { id },
        true
      );
    }
  }

  /**
   * List all widgets
   */
  private async listWidgets(): Promise<void> {
    try {
      const widgets = await this.getAllWidgets();

      if (widgets.length === 0) {
        logger.info('No widgets configured');
        return;
      }

      logger.info(`Dashboard widgets (${widgets.length}):`);
      console.table(
        widgets.map(widget => ({
          ID: widget.id,
          Type: widget.type,
          Position: `(${widget.position.x}, ${widget.position.y})`,
          Created: new Date(widget.created).toLocaleDateString(),
        }))
      );
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_DASHBOARD_LIST_WIDGETS_FAILED',
        'Failed to list widgets',
        {},
        true
      );
    }
  }

  /**
   * Manage dashboard themes
   */
  private async manageTheme(action: string, options: any): Promise<void> {
    try {
      switch (action) {
        case 'list':
          await this.listThemes();
          break;
        case 'set':
          await this.setTheme(options.name);
          break;
        case 'create':
          await this.createTheme(options.name, options.config);
          break;
        case 'delete':
          await this.deleteTheme(options.name);
          break;
        default:
          throw new Error(`Unknown theme action: ${action}`);
      }
    } catch (error) {
      throw errorHandler.createError(
        'WUNDR_DASHBOARD_THEME_FAILED',
        'Failed to manage theme',
        { action, options },
        true
      );
    }
  }

  /**
   * Helper methods for dashboard operations
   */
  private async isDashboardRunning(): Promise<boolean> {
    const processInfo = await this.loadDashboardProcess();
    if (!processInfo) return false;

    try {
      process.kill(processInfo.pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureDashboardAssets(): Promise<void> {
    // Ensure dashboard assets are available
    const assetsPath = path.join(__dirname, '../../dashboard-assets');
    if (!(await fs.pathExists(assetsPath))) {
      logger.info('Dashboard assets not found, downloading...');
      // Download or copy dashboard assets
    }
  }

  private async startDashboardServer(options: any): Promise<any> {
    // Start the actual dashboard server process
    const serverPath = path.join(__dirname, '../../dashboard-server');

    const child = spawn('node', [serverPath], {
      env: {
        ...process.env,
        PORT: options.port,
        HOST: options.host,
        NODE_ENV: options.dev ? 'development' : 'production',
      },
      detached: !options.dev,
      stdio: options.dev ? 'inherit' : 'ignore',
    });

    if (!options.dev) {
      child.unref();
    }

    return {
      pid: child.pid,
      host: options.host,
      port: options.port,
      started: Date.now(),
    };
  }

  private async saveDashboardProcess(
    processInfo: any,
    options: any
  ): Promise<void> {
    const processFile = path.join(process.cwd(), '.wundr', 'dashboard.pid');
    await fs.ensureDir(path.dirname(processFile));
    await fs.writeJson(processFile, { ...processInfo, ...options });
  }

  private async loadDashboardProcess(): Promise<any> {
    const processFile = path.join(process.cwd(), '.wundr', 'dashboard.pid');
    if (await fs.pathExists(processFile)) {
      return await fs.readJson(processFile);
    }
    return null;
  }

  private async cleanupDashboardProcess(): Promise<void> {
    const processFile = path.join(process.cwd(), '.wundr', 'dashboard.pid');
    if (await fs.pathExists(processFile)) {
      await fs.remove(processFile);
    }
  }

  private async openBrowser(url: string): Promise<void> {
    const { default: open } = await import('open');
    await open(url);
  }

  // Report generation methods
  private async collectReportData(type: string, period: string): Promise<any> {
    // Collect data for report generation
    return { type, period, data: [] };
  }

  private async formatReport(data: any, format: string): Promise<any> {
    // Format report based on requested format
    return data;
  }

  private getDefaultReportPath(type: string, format: string): string {
    return `reports/wundr-${type}-report.${format}`;
  }

  private async saveReport(report: any, outputPath: string): Promise<void> {
    await fs.ensureDir(path.dirname(outputPath));
    if (typeof report === 'string') {
      await fs.writeFile(outputPath, report);
    } else {
      await fs.writeJson(outputPath, report, { spaces: 2 });
    }
  }

  // Data export/import methods
  private async collectExportData(type: string, filter?: string): Promise<any> {
    return { type, filter, data: [] };
  }

  private async formatExportData(data: any, format: string): Promise<any> {
    return data;
  }

  private getDefaultExportPath(type: string, format: string): string {
    return `exports/wundr-${type}-export.${format}`;
  }

  private async saveExportData(data: any, outputPath: string): Promise<void> {
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
  }

  private async loadImportData(file: string): Promise<any> {
    return await fs.readJson(file);
  }

  private async validateImportData(data: any, type?: string): Promise<any> {
    // Validate imported data
    return data;
  }

  private async mergeImportData(data: any, type?: string): Promise<void> {
    // Merge imported data with existing data
    logger.debug('Merging import data');
  }

  private async replaceImportData(data: any, type?: string): Promise<void> {
    // Replace existing data with imported data
    logger.debug('Replacing with import data');
  }

  // Widget management methods
  private async saveWidget(widget: any): Promise<void> {
    const widgetFile = path.join(
      process.cwd(),
      '.wundr',
      'widgets',
      `${widget.id}.json`
    );
    await fs.ensureDir(path.dirname(widgetFile));
    await fs.writeJson(widgetFile, widget, { spaces: 2 });
  }

  private async deleteWidget(id: string): Promise<void> {
    const widgetFile = path.join(
      process.cwd(),
      '.wundr',
      'widgets',
      `${id}.json`
    );
    if (await fs.pathExists(widgetFile)) {
      await fs.remove(widgetFile);
    }
  }

  private async getAllWidgets(): Promise<any[]> {
    const widgetsDir = path.join(process.cwd(), '.wundr', 'widgets');
    if (!(await fs.pathExists(widgetsDir))) {
      return [];
    }

    const files = await fs.readdir(widgetsDir);
    const widgets: any[] = [];

    for (const file of files.filter(f => f.endsWith('.json'))) {
      const widget = await fs.readJson(path.join(widgetsDir, file));
      widgets.push(widget);
    }

    return widgets;
  }

  // Theme management methods
  private async listThemes(): Promise<void> {
    const themes = ['default', 'dark', 'light'];
    console.log('Available themes:');
    themes.forEach(theme => console.log(`  - ${theme}`));
  }

  private async setTheme(name: string): Promise<void> {
    this.configManager.set('dashboard.theme', name);
    await this.configManager.saveConfig();
    logger.success(`Theme set to: ${name}`);
  }

  private async createTheme(name: string, config: string): Promise<void> {
    logger.info(`Creating theme: ${name}`);
    // Implementation for creating custom themes
  }

  private async deleteTheme(name: string): Promise<void> {
    logger.info(`Deleting theme: ${name}`);
    // Implementation for deleting custom themes
  }
}
