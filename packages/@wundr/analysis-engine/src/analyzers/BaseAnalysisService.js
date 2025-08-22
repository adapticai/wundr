"use strict";
/**
 * Enhanced Base Analysis Service - Core functionality for all analysis services
 * Migrated and optimized from original AnalysisService with performance improvements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAnalysisService = void 0;
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs-extra"));
const path = tslib_1.__importStar(require("path"));
const ts = tslib_1.__importStar(require("typescript"));
const glob_1 = require("glob");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const ora_1 = tslib_1.__importDefault(require("ora"));
const StreamingFileProcessor_1 = require("../streaming/StreamingFileProcessor");
const WorkerPoolManager_1 = require("../workers/WorkerPoolManager");
const MemoryMonitor_1 = require("../monitoring/MemoryMonitor");
const utils_1 = require("../utils");
/**
 * Enhanced base class for all analysis services with performance optimizations
 */
class BaseAnalysisService {
    config;
    program = null;
    checker = null;
    spinner;
    progressCallback;
    // Performance tracking and optimization
    startTime = 0;
    fileCache = new Map();
    analysisCache = new Map();
    memoryUsage = { peak: 0, average: 0 };
    cacheHits = 0;
    // Memory optimization components
    streamingProcessor;
    workerPool;
    memoryMonitor;
    objectPools = {
        entities: [],
        buffers: [],
        arrays: []
    };
    constructor(name, config) {
        const defaultConfig = {
            name,
            version: '2.0.0',
            targetDir: process.cwd(),
            excludeDirs: ['node_modules', 'dist', 'build', 'coverage', '.git', '.next'],
            includePatterns: ['**/*.{ts,tsx,js,jsx}'],
            excludePatterns: ['**/*.{test,spec}.{ts,tsx,js,jsx}', '**/__tests__/**/*'],
            includeTests: false,
            enableAIAnalysis: false,
            outputFormats: ['json'],
            outputDir: path.join(process.cwd(), 'analysis-output', name.toLowerCase()),
            verbose: false,
            performance: {
                maxConcurrency: 10,
                chunkSize: 100,
                enableCaching: true
            },
            thresholds: {
                complexity: {
                    cyclomatic: 10,
                    cognitive: 15
                },
                duplicates: {
                    minSimilarity: 0.8
                },
                fileSize: {
                    maxLines: 500
                }
            }
        };
        this.config = { ...defaultConfig, ...config };
        this.spinner = (0, ora_1.default)({ color: 'cyan' });
        // Initialize optimization components
        this.streamingProcessor = new StreamingFileProcessor_1.StreamingFileProcessor({
            chunkSize: 32 * 1024, // 32KB chunks for memory efficiency
            maxMemoryUsage: 100 * 1024 * 1024, // 100MB limit
            workerPoolSize: this.config.performance.maxConcurrency,
            bufferSize: 512 * 1024 // 512KB buffer
        });
        this.workerPool = new WorkerPoolManager_1.WorkerPoolManager({
            minWorkers: Math.max(2, Math.floor(this.config.performance.maxConcurrency * 0.5)),
            maxWorkers: Math.max(30, this.config.performance.maxConcurrency * 2), // Target 30+ workers
            enableAutoScaling: true,
            workerScript: path.join(__dirname, '../workers/analysis-worker.js')
        });
        this.memoryMonitor = new MemoryMonitor_1.MemoryMonitor({
            snapshotInterval: 10000, // 10 second intervals
            maxSnapshots: 500,
            outputDir: path.join(this.config.outputDir || '.', 'memory-profiles')
        });
        this.setupMemoryOptimizations();
    }
    /**
     * Set progress callback for real-time updates
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }
    /**
     * Emit progress event
     */
    emitProgress(event) {
        if (this.progressCallback) {
            this.progressCallback(event);
        }
        if (this.config.verbose) {
            switch (event.type) {
                case 'phase':
                    this.spinner.text = event.message || '';
                    break;
                case 'progress':
                    if (event.progress !== undefined && event.total !== undefined) {
                        const percent = Math.round((event.progress / event.total) * 100);
                        this.spinner.text = `${event.message || 'Processing'} (${percent}%)`;
                    }
                    break;
                case 'complete':
                    this.spinner.succeed(event.message || 'Complete');
                    break;
                case 'error':
                    this.spinner.fail(event.message || 'Error occurred');
                    break;
            }
        }
    }
    /**
     * Main analysis method with advanced memory optimization and concurrency
     */
    async analyze() {
        this.startTime = Date.now();
        this.emitProgress({ type: 'phase', message: 'Initializing high-performance analysis...' });
        try {
            if (this.config.verbose) {
                this.spinner.start('Starting optimized analysis...');
            }
            // Start memory monitoring
            await this.memoryMonitor.startMonitoring();
            await this.initialize();
            // Get target files
            const files = await this.getTargetFiles();
            if (files.length === 0) {
                throw new Error('No files found to analyze');
            }
            this.emitProgress({
                type: 'progress',
                phase: 'file-discovery',
                progress: files.length,
                total: files.length,
                message: `Found ${files.length} files`
            });
            // Create program and extract entities
            this.createOptimizedProgram(files);
            const entities = await this.extractEntitiesOptimized(files);
            const analysisResults = await this.performAnalysis(entities);
            // Generate report
            const report = await this.generateReport(files, entities, analysisResults);
            // Save report in multiple formats
            await this.saveReport(report);
            const duration = Date.now() - this.startTime;
            const memoryMetrics = this.memoryMonitor.getMetrics();
            this.emitProgress({
                type: 'complete',
                message: `Analysis completed in ${(0, utils_1.formatDuration)(duration)} (Peak memory: ${(0, utils_1.formatFileSize)(memoryMetrics.peak.heapUsed)})`
            });
            return {
                success: true,
                data: report,
                duration
            };
        }
        catch (error) {
            const duration = Date.now() - this.startTime;
            this.emitProgress({
                type: 'error',
                message: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
                error: error instanceof Error ? error : new Error(String(error))
            });
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                duration
            };
        }
        finally {
            await this.cleanup();
        }
    }
    /**
     * Get TypeScript files with advanced filtering and caching
     */
    async getTargetFiles() {
        const cacheKey = 'target-files';
        if (this.config.performance.enableCaching && this.analysisCache.has(cacheKey)) {
            this.cacheHits++;
            return this.analysisCache.get(cacheKey);
        }
        const patterns = this.config.includePatterns;
        const allFiles = [];
        for (const pattern of patterns) {
            const patternFiles = await (0, glob_1.glob)(pattern, {
                cwd: this.config.targetDir,
                absolute: true,
                ignore: [
                    ...this.config.excludeDirs.map(dir => `${dir}/**`),
                    ...(this.config.includeTests ? [] : this.config.excludePatterns)
                ]
            });
            allFiles.push(...patternFiles);
        }
        // Remove duplicates and normalize paths
        const uniqueFiles = [...new Set(allFiles.map(utils_1.normalizeFilePath))];
        // Filter by file size and other criteria
        const filteredFiles = await this.filterFilesByCriteria(uniqueFiles);
        if (this.config.performance.enableCaching) {
            this.analysisCache.set(cacheKey, filteredFiles);
        }
        return filteredFiles;
    }
    /**
     * Filter files by size and other criteria
     */
    async filterFilesByCriteria(files) {
        const maxLines = this.config.thresholds.fileSize.maxLines;
        const filteredFiles = [];
        await (0, utils_1.processConcurrently)(files, async (file) => {
            try {
                const stats = await fs.stat(file);
                if (stats.size > 1024 * 1024) { // Skip files > 1MB
                    if (this.config.verbose) {
                        console.warn(`Skipping large file: ${file} (${(0, utils_1.formatFileSize)(stats.size)})`);
                    }
                    return;
                }
                const content = await fs.readFile(file, 'utf-8');
                const lines = content.split('\n').length;
                if (lines <= maxLines * 2) { // Allow some flexibility
                    filteredFiles.push(file);
                }
                else if (this.config.verbose) {
                    console.warn(`Skipping file with ${lines} lines: ${file}`);
                }
            }
            catch (error) {
                if (this.config.verbose) {
                    console.warn(`Error reading file ${file}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }, this.config.performance.maxConcurrency);
        return filteredFiles;
    }
    /**
     * Create optimized TypeScript program with caching
     */
    createOptimizedProgram(files) {
        const configPath = ts.findConfigFile(this.config.targetDir, ts.sys.fileExists, 'tsconfig.json');
        let compilerOptions = {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.CommonJS,
            lib: ['es2020'],
            allowJs: true,
            checkJs: false,
            skipLibCheck: true,
            skipDefaultLibCheck: true,
            noResolve: false,
            maxNodeModuleJsDepth: 0
        };
        if (configPath) {
            const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
            if (configFile.config) {
                const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
                compilerOptions = { ...compilerOptions, ...parsedConfig.options };
            }
        }
        // Optimize for analysis performance
        compilerOptions.skipLibCheck = true;
        compilerOptions.skipDefaultLibCheck = true;
        compilerOptions.noResolve = true;
        this.program = ts.createProgram(files, compilerOptions);
        this.checker = this.program.getTypeChecker();
    }
    /**
     * Extract entities with performance optimization
     */
    async extractEntitiesOptimized(files) {
        this.emitProgress({
            type: 'phase',
            message: 'Extracting entities from source files...'
        });
        const allEntities = [];
        const fileChunks = (0, utils_1.chunk)(files, this.config.performance.chunkSize);
        let processedFiles = 0;
        for (const fileChunk of fileChunks) {
            const chunkEntities = await (0, utils_1.processConcurrently)(fileChunk, async (filePath) => {
                const entities = await this.extractEntitiesFromFile(filePath);
                processedFiles++;
                this.emitProgress({
                    type: 'progress',
                    progress: processedFiles,
                    total: files.length,
                    message: `Processing files...`
                });
                return entities;
            }, Math.min(this.config.performance.maxConcurrency, fileChunk.length));
            allEntities.push(...chunkEntities.flat());
            // Track memory usage
            const memUsage = process.memoryUsage();
            this.memoryUsage.peak = Math.max(this.memoryUsage.peak, memUsage.heapUsed);
            this.memoryUsage.average = (this.memoryUsage.average + memUsage.heapUsed) / 2;
        }
        return allEntities;
    }
    /**
     * Extract entities from a single file with caching
     */
    async extractEntitiesFromFile(filePath) {
        const cacheKey = `entities-${filePath}`;
        if (this.config.performance.enableCaching && this.analysisCache.has(cacheKey)) {
            this.cacheHits++;
            return this.analysisCache.get(cacheKey);
        }
        const sourceFile = this.getSourceFile(filePath);
        if (!sourceFile) {
            return [];
        }
        const entities = [];
        // Extract different types of entities
        this.visitNode(sourceFile, (node) => {
            const entity = this.extractEntityFromNode(node, sourceFile);
            if (entity) {
                entities.push(entity);
            }
        });
        if (this.config.performance.enableCaching) {
            this.analysisCache.set(cacheKey, entities);
        }
        return entities;
    }
    /**
     * Generate comprehensive analysis report
     */
    async generateReport(files, entities, analysisResults) {
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        const summary = {
            totalFiles: files.length,
            totalEntities: entities.length,
            duplicateClusters: analysisResults.duplicates?.length || 0,
            circularDependencies: analysisResults.circularDependencies?.length || 0,
            unusedExports: analysisResults.unusedExports?.length || 0,
            codeSmells: analysisResults.codeSmells?.length || 0,
            averageComplexity: this.calculateAverageComplexity(entities),
            maintainabilityIndex: this.calculateMaintainabilityIndex(entities),
            technicalDebt: {
                score: this.calculateTechnicalDebtScore(analysisResults),
                estimatedHours: this.estimateTechnicalDebtHours(analysisResults)
            }
        };
        const performance = {
            analysisTime: duration,
            filesPerSecond: Math.round(files.length / (duration / 1000)),
            entitiesPerSecond: Math.round(entities.length / (duration / 1000)),
            memoryUsage: this.memoryUsage,
            cacheHits: this.cacheHits,
            cacheSize: this.analysisCache.size
        };
        return {
            id: (0, utils_1.createId)(),
            timestamp: new Date().toISOString(),
            version: this.config.version,
            targetDir: this.config.targetDir,
            config: this.config,
            summary,
            entities,
            duplicates: analysisResults.duplicates || [],
            circularDependencies: analysisResults.circularDependencies || [],
            unusedExports: analysisResults.unusedExports || [],
            codeSmells: analysisResults.codeSmells || [],
            recommendations: analysisResults.recommendations || [],
            performance,
            visualizations: analysisResults.visualizations
        };
    }
    /**
     * Save analysis report in multiple formats
     */
    async saveReport(report) {
        await fs.ensureDir(this.config.outputDir);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseFilename = `analysis-report-${timestamp}`;
        for (const format of this.config.outputFormats) {
            const filename = `${baseFilename}.${format}`;
            const filePath = path.join(this.config.outputDir, filename);
            let content;
            switch (format) {
                case 'json':
                    content = JSON.stringify(report, null, 2);
                    break;
                case 'html':
                    content = this.generateHtmlReport(report);
                    break;
                case 'markdown':
                    content = this.generateMarkdownReport(report);
                    break;
                case 'csv':
                    content = this.generateCsvReport(report);
                    break;
                default:
                    content = JSON.stringify(report, null, 2);
            }
            await fs.writeFile(filePath, content);
            // Also save as latest
            const latestPath = path.join(this.config.outputDir, `latest.${format}`);
            await fs.writeFile(latestPath, content);
        }
        if (this.config.verbose) {
            console.log(chalk_1.default.green(`📊 Reports saved to ${this.config.outputDir}/`));
        }
    }
    // Utility methods
    calculateAverageComplexity(entities) {
        const complexities = entities
            .filter(e => e.complexity?.cyclomatic)
            .map(e => e.complexity.cyclomatic);
        return complexities.length > 0
            ? complexities.reduce((sum, c) => sum + c, 0) / complexities.length
            : 0;
    }
    calculateMaintainabilityIndex(entities) {
        // Simplified maintainability index calculation
        const avgComplexity = this.calculateAverageComplexity(entities);
        const avgLines = entities.reduce((sum, e) => sum + (e.complexity?.lines || 0), 0) / entities.length;
        return Math.max(0, Math.min(100, 171 - 5.2 * Math.log(avgLines || 1) - 0.23 * avgComplexity));
    }
    calculateTechnicalDebtScore(analysisResults) {
        let score = 100;
        if (analysisResults.duplicates?.length) {
            score -= analysisResults.duplicates.length * 5;
        }
        if (analysisResults.circularDependencies?.length) {
            score -= analysisResults.circularDependencies.length * 10;
        }
        if (analysisResults.codeSmells?.length) {
            score -= analysisResults.codeSmells.length * 2;
        }
        return Math.max(0, score);
    }
    estimateTechnicalDebtHours(analysisResults) {
        let hours = 0;
        hours += (analysisResults.duplicates?.length || 0) * 2;
        hours += (analysisResults.circularDependencies?.length || 0) * 4;
        hours += (analysisResults.codeSmells?.length || 0) * 0.5;
        return hours;
    }
    // Add missing method implementations that were referenced
    setupMemoryOptimizations() {
        // Initialize object pools for memory efficiency
        for (let i = 0; i < 100; i++) {
            this.objectPools.entities.push({});
            this.objectPools.arrays.push([]);
        }
        for (let i = 0; i < 20; i++) {
            this.objectPools.buffers.push(Buffer.alloc(0));
        }
        // Setup memory monitoring events
        this.memoryMonitor.on('memory-alert', (alert) => {
            if (this.config.verbose) {
                console.warn(`Memory Alert: ${alert.type} - Current: ${(0, utils_1.formatFileSize)(alert.current)}`);
            }
            if (alert.severity === 'critical') {
                this.forceCleanup();
            }
        });
    }
    forceCleanup() {
        // Clear caches
        this.fileCache.clear();
        if (!this.config.performance.enableCaching) {
            this.analysisCache.clear();
        }
        // Return objects to pools
        this.objectPools.entities.length = 0;
        this.objectPools.arrays.length = 0;
        this.objectPools.buffers.length = 0;
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }
    // Helper methods
    getSourceFile(filePath) {
        if (this.fileCache.has(filePath)) {
            return this.fileCache.get(filePath);
        }
        const sourceFile = this.program?.getSourceFile(filePath);
        if (sourceFile && this.config.performance.enableCaching) {
            this.fileCache.set(filePath, sourceFile);
        }
        return sourceFile;
    }
    visitNode(node, visitor) {
        visitor(node);
        ts.forEachChild(node, child => this.visitNode(child, visitor));
    }
    getPositionInfo(node, sourceFile) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        return { line: line + 1, column: character + 1 };
    }
    generateHtmlReport(report) {
        // Enhanced HTML report generation
        return `<!DOCTYPE html>
<html>
<head>
  <title>${this.config.name} Analysis Report</title>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 30px; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid #007acc; }
    .metric-value { font-size: 2em; font-weight: bold; color: #007acc; }
    .metric-label { color: #666; margin-top: 5px; }
    .section { margin: 30px 0; }
    .issue { margin: 15px 0; padding: 15px; border-radius: 6px; border-left: 4px solid; }
    .issue.critical { border-color: #dc3545; background: #f8d7da; }
    .issue.high { border-color: #fd7e14; background: #fff3cd; }
    .issue.medium { border-color: #ffc107; background: #fff3cd; }
    .issue.low { border-color: #28a745; background: #d4edda; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 ${this.config.name} Analysis Report</h1>
      <p><strong>Generated:</strong> ${report.timestamp}</p>
      <p><strong>Target Directory:</strong> ${report.targetDir}</p>
      <p><strong>Analysis Time:</strong> ${(0, utils_1.formatDuration)(report.performance.analysisTime)}</p>
    </div>
    
    <div class="section">
      <h2>📊 Summary</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-value">${report.summary.totalFiles}</div>
          <div class="metric-label">Files Analyzed</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${report.summary.totalEntities}</div>
          <div class="metric-label">Entities Found</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${report.summary.duplicateClusters}</div>
          <div class="metric-label">Duplicate Clusters</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${report.summary.technicalDebt.score}</div>
          <div class="metric-label">Quality Score</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>⚠️ Issues Found</h2>
      ${report.recommendations.map(rec => `
        <div class="issue ${rec.priority}">
          <h4>${rec.title}</h4>
          <p>${rec.description}</p>
          <p><strong>Impact:</strong> ${rec.impact}</p>
          <p><strong>Effort:</strong> ${rec.effort}</p>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
    }
    generateMarkdownReport(report) {
        return `# ${this.config.name} Analysis Report

**Generated:** ${report.timestamp}  
**Target Directory:** ${report.targetDir}  
**Analysis Time:** ${(0, utils_1.formatDuration)(report.performance.analysisTime)}

## 📊 Summary

| Metric | Value |
|--------|-------|
| Files Analyzed | ${report.summary.totalFiles} |
| Entities Found | ${report.summary.totalEntities} |
| Duplicate Clusters | ${report.summary.duplicateClusters} |
| Circular Dependencies | ${report.summary.circularDependencies} |
| Unused Exports | ${report.summary.unusedExports} |
| Code Smells | ${report.summary.codeSmells} |
| Average Complexity | ${report.summary.averageComplexity.toFixed(1)} |
| Quality Score | ${report.summary.technicalDebt.score}/100 |

## 🚀 Performance

- **Files/Second:** ${report.performance.filesPerSecond}
- **Entities/Second:** ${report.performance.entitiesPerSecond}  
- **Cache Hits:** ${report.performance.cacheHits}
- **Memory Peak:** ${(0, utils_1.formatFileSize)(report.performance.memoryUsage.peak)}

## 💡 Recommendations

${report.recommendations.map(rec => `
### ${rec.priority.toUpperCase()}: ${rec.title}

${rec.description}

- **Impact:** ${rec.impact}
- **Effort:** ${rec.effort}
${rec.estimatedTimeHours ? `- **Estimated Time:** ${rec.estimatedTimeHours}h` : ''}

`).join('')}`;
    }
    generateCsvReport(report) {
        const rows = [
            'Type,Name,File,Line,Complexity,Export,Dependencies'
        ];
        report.entities.forEach(entity => {
            rows.push([
                entity.type,
                `"${entity.name}"`,
                `"${entity.file}"`,
                entity.line,
                entity.complexity?.cyclomatic || 0,
                entity.exportType,
                entity.dependencies.length
            ].join(','));
        });
        return rows.join('\n');
    }
    async initialize() {
        if (this.config.outputDir) {
            await fs.ensureDir(this.config.outputDir);
        }
    }
    async cleanup() {
        // Stop monitoring
        this.memoryMonitor.stopMonitoring();
        // Shutdown worker pool gracefully
        await this.workerPool.shutdown(10000);
        this.program = null;
        this.checker = null;
        this.fileCache.clear();
        if (!this.config.performance.enableCaching) {
            this.analysisCache.clear();
        }
        // Clear object pools
        this.objectPools.entities.length = 0;
        this.objectPools.arrays.length = 0;
        this.objectPools.buffers.length = 0;
    }
}
exports.BaseAnalysisService = BaseAnalysisService;
//# sourceMappingURL=BaseAnalysisService.js.map