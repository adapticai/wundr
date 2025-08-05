class MonorepoAnalysisDashboard {
    constructor() {
        this.data = null;
        this.charts = {};
        this.currentTab = 'duplicates';
        this.filters = {
            severity: '',
            type: '',
            search: ''
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadData();
    }

    setupEventListeners() {
        // File input
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFileUpload(e);
        });

        document.getElementById('load-file-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadData();
        });

        // Retry button
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.loadData();
        });

        // Sample data button
        document.getElementById('sample-data-btn').addEventListener('click', async () => {
            this.showLoading();
            try {
                const sampleData = await this.generateSampleData();
                this.processData(sampleData);
                this.hideError();
                this.renderDashboard();
                this.showToast('Sample data loaded successfully', 'success');
            } catch (error) {
                this.showError('Failed to generate sample data');
            } finally {
                this.hideLoading();
            }
        });

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Filters
        document.getElementById('severity-filter').addEventListener('change', (e) => {
            this.filters.severity = e.target.value;
            this.renderDuplicates();
        });

        document.getElementById('type-filter').addEventListener('change', (e) => {
            this.filters.type = e.target.value;
            this.renderDuplicates();
        });

        // Search
        document.getElementById('entity-search').addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.renderEntities();
        });

        // Modal
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('entity-modal').addEventListener('click', (e) => {
            if (e.target.id === 'entity-modal') {
                this.closeModal();
            }
        });

        // Drag and drop functionality
        this.setupDragAndDrop();
    }

    async loadData() {
        this.showLoading();
        
        try {
            // Try to load from default location first
            const response = await fetch('./analysis-output/analysis-report.json');
            
            if (!response.ok) {
                throw new Error('Analysis report not found');
            }

            const data = await response.json();
            this.processData(data);
            this.hideError();
            this.renderDashboard();
            
        } catch (error) {
            console.error('Failed to load data:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.processData(data);
                this.hideError();
                this.renderDashboard();
            } catch (error) {
                this.showError('Invalid JSON file');
            }
        };
        reader.readAsText(file);
    }

    processData(rawData) {
        this.data = rawData;
        
        // Update last updated timestamp
        const timestamp = new Date(rawData.timestamp);
        document.getElementById('last-updated').textContent = 
            `Last updated: ${timestamp.toLocaleString()}`;
    }

    renderDashboard() {
        if (!this.data) return;

        this.updateSummaryCards();
        this.renderCharts();
        this.renderCurrentTab();
        this.showDashboard();
    }

    updateSummaryCards() {
        const { summary } = this.data;
        
        document.getElementById('total-files').textContent = summary.totalFiles.toLocaleString();
        document.getElementById('total-entities').textContent = summary.totalEntities.toLocaleString();
        document.getElementById('duplicate-clusters').textContent = summary.duplicateClusters.toLocaleString();
        document.getElementById('circular-deps').textContent = summary.circularDependencies.toLocaleString();
        document.getElementById('unused-exports').textContent = summary.unusedExports.toLocaleString();
        document.getElementById('code-smells').textContent = summary.codeSmells.toLocaleString();
    }

    renderCharts() {
        this.renderEntityChart();
        this.renderSeverityChart();
        this.renderComplexityChart();
        this.renderDependencyChart();
    }

    renderEntityChart() {
        const ctx = document.getElementById('entity-chart').getContext('2d');
        
        // Count entities by type
        const typeCounts = {};
        this.data.entities.forEach(entity => {
            typeCounts[entity.type] = (typeCounts[entity.type] || 0) + 1;
        });

        const colors = [
            '#3498db', '#e74c3c', '#2ecc71', '#f39c12', 
            '#9b59b6', '#34495e', '#1abc9c', '#e67e22'
        ];

        if (this.charts.entityChart) {
            this.charts.entityChart.destroy();
        }

        this.charts.entityChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(typeCounts),
                datasets: [{
                    data: Object.values(typeCounts),
                    backgroundColor: colors.slice(0, Object.keys(typeCounts).length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }

    renderSeverityChart() {
        const ctx = document.getElementById('severity-chart').getContext('2d');
        
        // Count duplicates by severity
        const severityCounts = { critical: 0, high: 0, medium: 0 };
        this.data.duplicates.forEach(duplicate => {
            severityCounts[duplicate.severity]++;
        });

        if (this.charts.severityChart) {
            this.charts.severityChart.destroy();
        }

        this.charts.severityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Critical', 'High', 'Medium'],
                datasets: [{
                    label: 'Duplicate Clusters',
                    data: [severityCounts.critical, severityCounts.high, severityCounts.medium],
                    backgroundColor: ['#e74c3c', '#f39c12', '#3498db'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderComplexityChart() {
        const ctx = document.getElementById('complexity-chart').getContext('2d');
        
        // Group entities by file and calculate complexity
        const fileComplexity = {};
        this.data.entities.forEach(entity => {
            const fileName = entity.file.split('/').pop();
            if (!fileComplexity[fileName]) {
                fileComplexity[fileName] = 0;
            }
            fileComplexity[fileName] += entity.complexity || 0;
        });

        // Sort by complexity and take top 10
        const sortedFiles = Object.entries(fileComplexity)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        if (this.charts.complexityChart) {
            this.charts.complexityChart.destroy();
        }

        this.charts.complexityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedFiles.map(([file]) => file),
                datasets: [{
                    label: 'Complexity Score',
                    data: sortedFiles.map(([, complexity]) => complexity),
                    backgroundColor: '#9b59b6',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderDependencyChart() {
        const ctx = document.getElementById('dependency-chart').getContext('2d');
        
        // Calculate dependency distribution
        const depCounts = {};
        this.data.entities.forEach(entity => {
            const depCount = entity.dependencies.length;
            const bucket = depCount === 0 ? '0' : 
                          depCount <= 2 ? '1-2' :
                          depCount <= 5 ? '3-5' :
                          depCount <= 10 ? '6-10' : '10+';
            depCounts[bucket] = (depCounts[bucket] || 0) + 1;
        });

        if (this.charts.dependencyChart) {
            this.charts.dependencyChart.destroy();
        }

        this.charts.dependencyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['0', '1-2', '3-5', '6-10', '10+'],
                datasets: [{
                    label: 'Number of Entities',
                    data: ['0', '1-2', '3-5', '6-10', '10+'].map(bucket => depCounts[bucket] || 0),
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;
        this.renderCurrentTab();
    }

    renderCurrentTab() {
        switch (this.currentTab) {
            case 'duplicates':
                this.renderDuplicates();
                break;
            case 'recommendations':
                this.renderRecommendations();
                break;
            case 'entities':
                this.renderEntities();
                break;
            case 'dependencies':
                this.renderDependencies();
                break;
        }
    }

    renderDuplicates() {
        const container = document.getElementById('duplicates-list');
        
        let duplicates = this.data.duplicates;
        
        // Apply filters
        if (this.filters.severity) {
            duplicates = duplicates.filter(d => d.severity === this.filters.severity);
        }
        
        if (this.filters.type) {
            duplicates = duplicates.filter(d => d.type === this.filters.type);
        }

        if (duplicates.length === 0) {
            container.innerHTML = '<div class="empty-state">No duplicates found with current filters.</div>';
            return;
        }

        container.innerHTML = duplicates.map(cluster => `
            <div class="duplicate-cluster ${cluster.severity}">
                <div class="cluster-header">
                    <div class="cluster-info">
                        <h4>${cluster.entities.length} duplicate ${cluster.type}s</h4>
                        <span class="severity-badge ${cluster.severity}">${cluster.severity.toUpperCase()}</span>
                        <span class="match-indicators">
                            ${cluster.structuralMatch ? '<i class="fas fa-code" title="Structural Match"></i>' : ''}
                            ${cluster.semanticMatch ? '<i class="fas fa-brain" title="Semantic Match"></i>' : ''}
                        </span>
                    </div>
                    <div class="cluster-actions">
                        <button class="btn btn-sm" onclick="dashboard.showDuplicateDetails('${cluster.hash}')">
                            View Details
                        </button>
                    </div>
                </div>
                <div class="entity-list">
                    ${cluster.entities.map(entity => `
                        <div class="entity-item" onclick="dashboard.showEntityDetails('${entity.file}:${entity.name}')">
                            <span class="entity-name">${entity.name}</span>
                            <span class="entity-location">${entity.file.split('/').pop()}:${entity.line}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    renderRecommendations() {
        const container = document.getElementById('recommendations-list');
        const recommendations = this.data.recommendations;

        if (recommendations.length === 0) {
            container.innerHTML = '<div class="empty-state">No recommendations available.</div>';
            return;
        }

        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item ${rec.priority.toLowerCase()}">
                <div class="recommendation-header">
                    <div class="recommendation-info">
                        <h4>${rec.description}</h4>
                        <span class="priority-badge ${rec.priority.toLowerCase()}">${rec.priority}</span>
                        <span class="type-badge">${rec.type.replace('_', ' ')}</span>
                    </div>
                </div>
                <div class="recommendation-details">
                    <div class="detail-row">
                        <strong>Impact:</strong> ${rec.impact}
                    </div>
                    <div class="detail-row">
                        <strong>Effort:</strong> ${rec.estimatedEffort}
                    </div>
                    ${rec.suggestion ? `
                        <div class="detail-row">
                            <strong>Suggestion:</strong> ${rec.suggestion}
                        </div>
                    ` : ''}
                    ${rec.entities ? `
                        <div class="detail-row">
                            <strong>Affected Entities:</strong>
                            <div class="entity-tags">
                                ${rec.entities.slice(0, 5).map(entity => `
                                    <span class="entity-tag">${entity}</span>
                                `).join('')}
                                ${rec.entities.length > 5 ? `<span class="entity-tag">+${rec.entities.length - 5} more</span>` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    renderEntities() {
        const tbody = document.getElementById('entities-tbody');
        
        let entities = this.data.entities;
        
        // Apply search filter
        if (this.filters.search) {
            entities = entities.filter(entity => 
                entity.name.toLowerCase().includes(this.filters.search) ||
                entity.file.toLowerCase().includes(this.filters.search)
            );
        }

        tbody.innerHTML = entities.map(entity => `
            <tr onclick="dashboard.showEntityDetails('${entity.file}:${entity.name}')" class="clickable-row">
                <td class="entity-name">${entity.name}</td>
                <td><span class="type-badge ${entity.type}">${entity.type}</span></td>
                <td class="file-path" title="${entity.file}">${entity.file.split('/').pop()}</td>
                <td>${entity.line}</td>
                <td><span class="export-badge ${entity.exportType}">${entity.exportType}</span></td>
                <td>${entity.dependencies.length}</td>
                <td>${entity.complexity || 'N/A'}</td>
            </tr>
        `).join('');
    }

    renderDependencies() {
        const container = document.getElementById('dependencies-list');
        
        // Calculate dependency stats
        const totalDeps = this.data.entities.reduce((sum, e) => sum + e.dependencies.length, 0);
        const avgDeps = (totalDeps / this.data.entities.length).toFixed(1);
        
        document.getElementById('total-deps').textContent = totalDeps.toLocaleString();
        document.getElementById('avg-deps').textContent = avgDeps;

        // Group entities by dependency count
        const depGroups = {};
        this.data.entities.forEach(entity => {
            const depCount = entity.dependencies.length;
            if (!depGroups[depCount]) {
                depGroups[depCount] = [];
            }
            depGroups[depCount].push(entity);
        });

        // Sort by dependency count (descending)
        const sortedGroups = Object.entries(depGroups)
            .sort(([a], [b]) => parseInt(b) - parseInt(a))
            .slice(0, 20); // Show top 20 groups

        container.innerHTML = sortedGroups.map(([depCount, entities]) => `
            <div class="dependency-group">
                <div class="group-header">
                    <h4>${depCount} Dependencies (${entities.length} entities)</h4>
                </div>
                <div class="entity-list">
                    ${entities.slice(0, 10).map(entity => `
                        <div class="entity-item" onclick="dashboard.showEntityDetails('${entity.file}:${entity.name}')">
                            <span class="entity-name">${entity.name}</span>
                            <span class="entity-type">${entity.type}</span>
                            <span class="entity-location">${entity.file.split('/').pop()}</span>
                        </div>
                    `).join('')}
                    ${entities.length > 10 ? `<div class="more-entities">+${entities.length - 10} more entities</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    showEntityDetails(entityKey) {
        const entity = this.data.entities.find(e => `${e.file}:${e.name}` === entityKey);
        if (!entity) return;

        const modal = document.getElementById('entity-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        title.textContent = `${entity.name} (${entity.type})`;
        
        body.innerHTML = `
            <div class="entity-details">
                <div class="detail-section">
                    <h4>Basic Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>File:</label>
                            <span>${entity.file}</span>
                        </div>
                        <div class="detail-item">
                            <label>Line:</label>
                            <span>${entity.line}:${entity.column}</span>
                        </div>
                        <div class="detail-item">
                            <label>Export Type:</label>
                            <span class="export-badge ${entity.exportType}">${entity.exportType}</span>
                        </div>
                        <div class="detail-item">
                            <label>Complexity:</label>
                            <span>${entity.complexity || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                ${entity.jsDoc ? `
                    <div class="detail-section">
                        <h4>Documentation</h4>
                        <div class="jsdoc">${entity.jsDoc}</div>
                    </div>
                ` : ''}

                ${entity.signature ? `
                    <div class="detail-section">
                        <h4>Signature</h4>
                        <code class="signature">${entity.signature}</code>
                    </div>
                ` : ''}

                ${entity.members ? `
                    <div class="detail-section">
                        <h4>Members</h4>
                        ${entity.members.properties ? `
                            <div class="member-group">
                                <h5>Properties (${entity.members.properties.length})</h5>
                                <ul class="member-list">
                                    ${entity.members.properties.map(prop => `
                                        <li>
                                            <span class="member-name">${prop.name}${prop.optional ? '?' : ''}</span>
                                            <span class="member-type">${prop.type}</span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${entity.members.methods ? `
                            <div class="member-group">
                                <h5>Methods (${entity.members.methods.length})</h5>
                                <ul class="member-list">
                                    ${entity.members.methods.map(method => `
                                        <li>
                                            <span class="member-name">${method.name}</span>
                                            <code class="method-signature">${method.signature}</code>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="detail-section">
                    <h4>Dependencies (${entity.dependencies.length})</h4>
                    ${entity.dependencies.length > 0 ? `
                        <ul class="dependency-list">
                            ${entity.dependencies.map(dep => `
                                <li>${dep.split('/').pop()}</li>
                            `).join('')}
                        </ul>
                    ` : '<p>No dependencies</p>'}
                </div>
            </div>
        `;

        modal.style.display = 'block';
    }

    showDuplicateDetails(hash) {
        const cluster = this.data.duplicates.find(d => d.hash === hash);
        if (!cluster) return;

        const modal = document.getElementById('entity-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        title.textContent = `Duplicate Cluster - ${cluster.entities.length} ${cluster.type}s`;
        
        body.innerHTML = `
            <div class="duplicate-details">
                <div class="cluster-summary">
                    <div class="summary-item">
                        <label>Severity:</label>
                        <span class="severity-badge ${cluster.severity}">${cluster.severity.toUpperCase()}</span>
                    </div>
                    <div class="summary-item">
                        <label>Hash:</label>
                        <code>${cluster.hash}</code>
                    </div>
                    <div class="summary-item">
                        <label>Structural Match:</label>
                        <span class="${cluster.structuralMatch ? 'positive' : 'negative'}">
                            ${cluster.structuralMatch ? 'Yes' : 'No'}
                        </span>
                    </div>
                    <div class="summary-item">
                        <label>Semantic Match:</label>
                        <span class="${cluster.semanticMatch ? 'positive' : 'negative'}">
                            ${cluster.semanticMatch ? 'Yes' : 'No'}
                        </span>
                    </div>
                </div>

                <h4>Duplicate Entities</h4>
                <div class="entities-comparison">
                    ${cluster.entities.map((entity, index) => `
                        <div class="entity-card">
                            <div class="entity-header">
                                <h5>${entity.name}</h5>
                                <span class="entity-location">${entity.file.split('/').pop()}:${entity.line}</span>
                            </div>
                            <div class="entity-info">
                                <div class="info-item">
                                    <label>File:</label>
                                    <span>${entity.file}</span>
                                </div>
                                <div class="info-item">
                                    <label>Dependencies:</label>
                                    <span>${entity.dependencies.length}</span>
                                </div>
                                <div class="info-item">
                                    <label>Complexity:</label>
                                    <span>${entity.complexity || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        modal.style.display = 'block';
    }

    closeModal() {
        document.getElementById('entity-modal').style.display = 'none';
    }

    setupDragAndDrop() {
        const dropZone = document.body;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.highlightDropZone, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.unhighlightDropZone, false);
        });

        dropZone.addEventListener('drop', this.handleDrop.bind(this), false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    highlightDropZone() {
        document.body.classList.add('drag-over');
    }

    unhighlightDropZone() {
        document.body.classList.remove('drag-over');
    }

    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                this.processDroppedFile(file);
            } else {
                this.showError('Please drop a JSON analysis report file');
            }
        }
    }

    processDroppedFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.processData(data);
                this.hideError();
                this.renderDashboard();
                this.showToast(`Successfully loaded ${file.name}`, 'success');
            } catch (error) {
                this.showError('Invalid JSON file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    async generateSampleData() {
        // Generate sample data for testing when no real data is available
        const sampleData = {
            timestamp: new Date().toISOString(),
            summary: {
                totalFiles: 150,
                totalEntities: 425,
                duplicateClusters: 12,
                circularDependencies: 3,
                unusedExports: 28,
                codeSmells: 45
            },
            entities: this.generateSampleEntities(),
            duplicates: this.generateSampleDuplicates(),
            circularDeps: [],
            unusedExports: [],
            wrapperPatterns: [],
            recommendations: this.generateSampleRecommendations()
        };
        
        return sampleData;
    }

    generateSampleEntities() {
        const types = ['class', 'interface', 'function', 'type', 'service'];
        const files = ['auth.service.ts', 'user.model.ts', 'api.client.ts', 'utils.ts', 'types.ts'];
        const entities = [];
        
        for (let i = 0; i < 50; i++) {
            entities.push({
                name: `Entity${i + 1}`,
                type: types[i % types.length],
                file: `src/${files[i % files.length]}`,
                line: Math.floor(Math.random() * 200) + 1,
                column: Math.floor(Math.random() * 50) + 1,
                exportType: ['default', 'named', 'none'][Math.floor(Math.random() * 3)],
                complexity: Math.floor(Math.random() * 20) + 1,
                dependencies: Array.from({length: Math.floor(Math.random() * 8)}, (_, j) => `dependency-${j}`)
            });
        }
        
        return entities;
    }

    generateSampleDuplicates() {
        return [
            {
                hash: 'abc123',
                type: 'interface',
                severity: 'high',
                structuralMatch: true,
                semanticMatch: true,
                entities: [
                    {
                        name: 'UserInterface',
                        file: 'src/user.model.ts',
                        line: 15,
                        dependencies: ['auth.service']
                    },
                    {
                        name: 'UserInterface',
                        file: 'src/admin.model.ts',
                        line: 22,
                        dependencies: ['auth.service']
                    }
                ]
            }
        ];
    }

    generateSampleRecommendations() {
        return [
            {
                description: 'Consolidate duplicate user interfaces',
                priority: 'high',
                type: 'duplicate_removal',
                impact: 'Reduces code duplication and maintenance burden',
                estimatedEffort: '2-4 hours',
                suggestion: 'Create a shared user interface in a common types file',
                entities: ['UserInterface', 'UserModel', 'UserType']
            },
            {
                description: 'Extract common service patterns',
                priority: 'medium',
                type: 'pattern_extraction',
                impact: 'Improves code reusability and consistency',
                estimatedEffort: '4-6 hours',
                suggestion: 'Create base service class with common CRUD operations'
            }
        ];
    }

    showLoading() {
        document.getElementById('loading-state').style.display = 'flex';
        document.getElementById('dashboard-content').style.display = 'none';
        document.getElementById('error-state').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading-state').style.display = 'none';
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-state').style.display = 'flex';
        document.getElementById('dashboard-content').style.display = 'none';
    }

    hideError() {
        document.getElementById('error-state').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('dashboard-content').style.display = 'block';
    }

    exportData(type) {
        if (!this.data) {
            this.showToast('No data to export', 'warning');
            return;
        }

        let exportData;
        let filename;

        switch (type) {
            case 'duplicates':
                exportData = this.data.duplicates;
                filename = 'duplicates-report.json';
                break;
            case 'recommendations':
                exportData = this.data.recommendations;
                filename = 'recommendations-report.json';
                break;
            case 'entities':
                exportData = this.data.entities;
                filename = 'entities-report.json';
                break;
            case 'all':
                exportData = this.data;
                filename = 'complete-analysis-report.json';
                break;
            default:
                this.showToast('Unknown export type', 'error');
                return;
        }

        this.downloadJSON(exportData, filename);
        this.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} data exported successfully`, 'success');
    }

    downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new MonorepoAnalysisDashboard();
});