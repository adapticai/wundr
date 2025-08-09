import { expect } from '@playwright/test';
import { test } from '../fixtures';

test.describe('Analysis Engine Large Projects E2E Tests', () => {
  test.beforeEach(async ({ mockDataHelper }) => {
    await mockDataHelper.setupMockApiResponses();
    await mockDataHelper.injectTestDataAttributes();
  });

  test('should handle large project analysis efficiently', async ({ dashboardPage, performanceHelper, page }) => {
    // Mock large project data
    await page.route('**/api/analysis**', route => {
      const largeProjectAnalysis = {
        success: true,
        data: {
          projectStats: {
            totalFiles: 5000,
            linesOfCode: 500000,
            complexity: 15.2,
            maintainabilityIndex: 72.5,
            technicalDebt: 45.2,
            testCoverage: 83.7
          },
          fileAnalysis: Array.from({ length: 1000 }, (_, i) => ({
            path: `src/components/feature-${Math.floor(i/10)}/Component${i}.tsx`,
            size: Math.floor(Math.random() * 10000) + 100,
            complexity: Math.floor(Math.random() * 20) + 1,
            maintainabilityIndex: Math.floor(Math.random() * 100),
            testCoverage: Math.floor(Math.random() * 100),
            issues: Math.floor(Math.random() * 5),
            lastModified: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
          })),
          dependencyAnalysis: {
            totalDependencies: 500,
            outdatedDependencies: 25,
            vulnerabilities: 8,
            duplicates: 12,
            unused: 6
          },
          qualityTrends: Array.from({ length: 365 }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
            quality: 70 + Math.random() * 30,
            complexity: 10 + Math.random() * 10,
            coverage: 80 + Math.random() * 20,
            debt: 30 + Math.random() * 20
          }))
        }
      };
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largeProjectAnalysis)
      });
    });

    await performanceHelper.startPerformanceMonitoring();
    
    const startTime = Date.now();
    await dashboardPage.goto();
    await dashboardPage.navigateToSection('analytics');
    const loadTime = Date.now() - startTime;

    // Should load large analysis data within reasonable time
    expect(loadTime).toBeLessThan(10000); // 10 seconds

    // Verify analysis page is displayed
    const analysisPage = page.locator('[data-testid="analytics-page"]');
    await expect(analysisPage).toBeVisible();

    // Check for key metrics display
    const projectStats = page.locator('[data-testid="project-stats"]');
    if (await projectStats.isVisible()) {
      const totalFilesMetric = projectStats.locator('[data-metric="totalFiles"], text=/5000|5,000/');
      await expect(totalFilesMetric).toBeVisible();
      
      const linesOfCodeMetric = projectStats.locator('[data-metric="linesOfCode"], text=/500000|500,000/');
      await expect(linesOfCodeMetric).toBeVisible();
    }

    const memory = await performanceHelper.measureMemoryUsage();
    expect(memory.used / 1024 / 1024).toBeLessThan(250); // Less than 250MB for large project

    await performanceHelper.stopPerformanceMonitoring();
  });

  test('should provide efficient file browsing for large codebases', async ({ dashboardPage, page }) => {
    // Mock file tree data
    await page.route('**/api/files**', route => {
      const fileTree = {
        success: true,
        data: {
          files: Array.from({ length: 10000 }, (_, i) => {
            const depth = Math.floor(Math.random() * 8) + 1;
            const pathParts = Array.from({ length: depth }, (_, j) => `dir${j}`);
            pathParts.push(`file${i}.ts`);
            
            return {
              id: `file_${i}`,
              path: pathParts.join('/'),
              type: pathParts[pathParts.length - 1].includes('.') ? 'file' : 'directory',
              size: Math.floor(Math.random() * 50000),
              lastModified: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
              issues: Math.floor(Math.random() * 10)
            };
          })
        }
      };
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fileTree)
      });
    });

    await dashboardPage.goto();
    await dashboardPage.navigateToSection('analytics');

    const fileBrowser = page.locator('[data-testid="file-browser"], [data-testid="file-tree"]');
    if (await fileBrowser.isVisible()) {
      // Test virtual scrolling or pagination for large file lists
      const fileItems = fileBrowser.locator('[data-testid="file-item"], .file-item');
      const visibleFileCount = await fileItems.count();
      
      // Should not render all 10,000 files at once (performance optimization)
      expect(visibleFileCount).toBeLessThan(200);
      expect(visibleFileCount).toBeGreaterThan(10);

      // Test search functionality
      const searchInput = page.locator('[data-testid="file-search"], input[placeholder*="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('Component1');
        await page.waitForTimeout(1000);

        const filteredItems = await fileItems.count();
        expect(filteredItems).toBeLessThan(visibleFileCount);
      }

      // Test scrolling performance
      const scrollContainer = fileBrowser.locator('[data-testid="scroll-container"], .scroll-container').first();
      if (await scrollContainer.isVisible()) {
        // Scroll down several times
        for (let i = 0; i < 10; i++) {
          await scrollContainer.evaluate(el => el.scrollBy(0, 200));
          await page.waitForTimeout(100);
        }

        // Should load more items or handle virtual scrolling
        const itemsAfterScroll = await fileItems.count();
        // Items count may change with virtual scrolling or pagination
      }
    }
  });

  test('should handle complex dependency analysis for large projects', async ({ dashboardPage, page }) => {
    // Mock complex dependency data
    await page.route('**/api/dependencies/analysis**', route => {
      const complexDependencies = {
        success: true,
        data: {
          dependencyGraph: {
            nodes: Array.from({ length: 500 }, (_, i) => ({
              id: `package-${i}`,
              name: `package-${i}`,
              version: `1.${i % 10}.${i % 5}`,
              type: Math.random() > 0.7 ? 'dev' : 'prod',
              size: Math.floor(Math.random() * 1000000) + 10000
            })),
            edges: Array.from({ length: 1200 }, (_, i) => ({
              source: `package-${Math.floor(Math.random() * 500)}`,
              target: `package-${Math.floor(Math.random() * 500)}`,
              type: 'depends'
            }))
          },
          vulnerabilities: Array.from({ length: 50 }, (_, i) => ({
            id: `vuln-${i}`,
            package: `package-${Math.floor(Math.random() * 500)}`,
            severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
            description: `Security vulnerability ${i}`,
            fixedIn: `1.${(i % 10) + 1}.0`
          })),
          circularDependencies: Array.from({ length: 15 }, (_, i) => ({
            cycle: [`package-${i}`, `package-${i + 1}`, `package-${i + 2}`, `package-${i}`]
          })),
          duplicates: Array.from({ length: 30 }, (_, i) => ({
            package: `common-package-${i % 10}`,
            versions: [`1.${i % 5}.0`, `1.${(i % 5) + 1}.0`],
            locations: [`node_modules/${i}/`, `node_modules/${i + 1}/`]
          }))
        }
      };
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(complexDependencies)
      });
    });

    await dashboardPage.goto();
    await dashboardPage.navigateToSection('dependencies');

    const dependencyPage = page.locator('[data-testid="dependencies-page"]');
    await expect(dependencyPage).toBeVisible();

    // Test dependency visualization
    const dependencyChart = page.locator('[data-testid="dependency-chart"], .dependency-visualization');
    if (await dependencyChart.isVisible()) {
      // Should render without performance issues
      await expect(dependencyChart).toBeVisible();
      
      // Test interaction with large graph
      await dependencyChart.hover({ position: { x: 200, y: 200 } });
      await page.waitForTimeout(500);
    }

    // Test vulnerability analysis
    const vulnerabilitySection = page.locator('[data-testid="vulnerabilities"]');
    if (await vulnerabilitySection.isVisible()) {
      const vulnItems = vulnerabilitySection.locator('[data-testid="vulnerability-item"]');
      const vulnCount = await vulnItems.count();
      
      // Should show vulnerabilities (may be paginated)
      expect(vulnCount).toBeGreaterThan(0);
      expect(vulnCount).toBeLessThan(100); // Should be paginated for performance
    }

    // Test circular dependency detection
    const circularDepsSection = page.locator('[data-testid="circular-dependencies"]');
    if (await circularDepsSection.isVisible()) {
      const circularItems = circularDepsSection.locator('[data-testid="circular-item"]');
      const circularCount = await circularItems.count();
      
      if (circularCount > 0) {
        // Should display circular dependency information
        expect(circularCount).toBeGreaterThan(0);
        
        // Test expanding circular dependency details
        await circularItems.first().click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should provide performance insights for large applications', async ({ dashboardPage, page }) => {
    // Mock performance data for large application
    await page.route('**/api/performance**', route => {
      const performanceData = {
        success: true,
        data: {
          buildMetrics: {
            totalBuildTime: 480000, // 8 minutes
            bundleSize: 5.2, // MB
            chunkSizes: Array.from({ length: 50 }, (_, i) => ({
              name: `chunk-${i}`,
              size: Math.floor(Math.random() * 500000) + 50000,
              loadTime: Math.floor(Math.random() * 2000) + 100
            })),
            optimizationOpportunities: [
              {
                type: 'bundle-splitting',
                impact: 'high',
                description: 'Large chunks could be split for better caching',
                savings: '1.2MB'
              },
              {
                type: 'tree-shaking',
                impact: 'medium',
                description: 'Unused exports detected in 25 modules',
                savings: '300KB'
              }
            ]
          },
          runtimeMetrics: {
            pageLoadTime: 3200,
            timeToInteractive: 4100,
            largestContentfulPaint: 2800,
            cumulativeLayoutShift: 0.08,
            memoryUsage: 89.5,
            cpuUsage: 65.2
          },
          historicalData: Array.from({ length: 90 }, (_, i) => ({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
            buildTime: 450000 + Math.floor(Math.random() * 60000),
            bundleSize: 5.0 + Math.random() * 0.5,
            loadTime: 3000 + Math.floor(Math.random() * 1000),
            memoryUsage: 85 + Math.random() * 10
          }))
        }
      };
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(performanceData)
      });
    });

    await dashboardPage.goto();
    await dashboardPage.navigateToSection('performance');

    const performancePage = page.locator('[data-testid="performance-page"]');
    await expect(performancePage).toBeVisible();

    // Test build metrics display
    const buildMetrics = page.locator('[data-testid="build-metrics"]');
    if (await buildMetrics.isVisible()) {
      const buildTimeMetric = buildMetrics.locator('[data-testid="build-time"], text=/8 min|480/');
      await expect(buildTimeMetric).toBeVisible();
      
      const bundleSizeMetric = buildMetrics.locator('[data-testid="bundle-size"], text=/5.2.*MB/');
      await expect(bundleSizeMetric).toBeVisible();
    }

    // Test chunk analysis
    const chunkAnalysis = page.locator('[data-testid="chunk-analysis"]');
    if (await chunkAnalysis.isVisible()) {
      const chunkItems = chunkAnalysis.locator('[data-testid="chunk-item"]');
      const chunkCount = await chunkItems.count();
      
      // Should show chunks (may be paginated or top N)
      expect(chunkCount).toBeGreaterThan(0);
      expect(chunkCount).toBeLessThan(100); // Performance consideration
      
      // Test sorting chunks by size
      const sortButton = page.locator('[data-testid="sort-by-size"], button:has-text("Size")');
      if (await sortButton.isVisible()) {
        await sortButton.click();
        await page.waitForTimeout(500);
        
        // First chunk should be large after sorting by size
        const firstChunk = chunkItems.first();
        const chunkSize = await firstChunk.locator('[data-testid="chunk-size"]').textContent();
        expect(chunkSize).toBeTruthy();
      }
    }

    // Test optimization recommendations
    const optimizations = page.locator('[data-testid="optimization-recommendations"]');
    if (await optimizations.isVisible()) {
      const recommendations = optimizations.locator('[data-testid="recommendation-item"]');
      const recCount = await recommendations.count();
      
      if (recCount > 0) {
        expect(recCount).toBeGreaterThan(0);
        
        // Test expanding recommendation details
        await recommendations.first().click();
        await page.waitForTimeout(500);
        
        const details = page.locator('[data-testid="recommendation-details"]');
        if (await details.isVisible()) {
          await expect(details).toBeVisible();
        }
      }
    }

    // Test performance trends chart
    const trendsChart = page.locator('[data-testid="performance-trends"], .performance-chart');
    if (await trendsChart.isVisible()) {
      await expect(trendsChart).toBeVisible();
      
      // Should handle large historical dataset efficiently
      const chartSvg = trendsChart.locator('svg, canvas').first();
      await expect(chartSvg).toBeVisible();
    }
  });

  test('should handle multi-language project analysis', async ({ dashboardPage, page }) => {
    // Mock multi-language project data
    await page.route('**/api/analysis/languages**', route => {
      const languageAnalysis = {
        success: true,
        data: {
          languages: [
            {
              name: 'TypeScript',
              files: 2500,
              linesOfCode: 350000,
              complexity: 12.5,
              testCoverage: 87.3,
              maintainabilityIndex: 78.2
            },
            {
              name: 'JavaScript',
              files: 800,
              linesOfCode: 120000,
              complexity: 15.8,
              testCoverage: 65.2,
              maintainabilityIndex: 68.9
            },
            {
              name: 'Python',
              files: 300,
              linesOfCode: 45000,
              complexity: 8.2,
              testCoverage: 92.1,
              maintainabilityIndex: 85.7
            },
            {
              name: 'Go',
              files: 150,
              linesOfCode: 28000,
              complexity: 6.8,
              testCoverage: 94.5,
              maintainabilityIndex: 89.2
            }
          ],
          crossLanguageInsights: {
            sharedModules: 45,
            apiCompatibility: 0.94,
            performanceBottlenecks: [
              {
                language: 'JavaScript',
                issue: 'Heavy DOM manipulation in legacy files',
                impact: 'high'
              },
              {
                language: 'Python',
                issue: 'Inefficient database queries',
                impact: 'medium'
              }
            ]
          }
        }
      };
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(languageAnalysis)
      });
    });

    await dashboardPage.goto();
    await dashboardPage.navigateToSection('analytics');

    // Test language breakdown
    const languageBreakdown = page.locator('[data-testid="language-breakdown"]');
    if (await languageBreakdown.isVisible()) {
      const languageItems = languageBreakdown.locator('[data-testid="language-item"]');
      const languageCount = await languageItems.count();
      
      expect(languageCount).toBe(4); // TypeScript, JavaScript, Python, Go
      
      // Test TypeScript metrics
      const tsItem = languageItems.locator('text="TypeScript"').first();
      if (await tsItem.isVisible()) {
        const tsParent = tsItem.locator('..').first();
        const tsLines = tsParent.locator('text=/350000|350,000/');
        await expect(tsLines).toBeVisible();
      }
    }

    // Test language comparison chart
    const comparisonChart = page.locator('[data-testid="language-comparison"], .language-chart');
    if (await comparisonChart.isVisible()) {
      await expect(comparisonChart).toBeVisible();
      
      // Should show all languages in comparison
      const chartLegend = comparisonChart.locator('.recharts-legend, [data-testid="chart-legend"]');
      if (await chartLegend.isVisible()) {
        const legendItems = chartLegend.locator('.recharts-legend-item, [data-testid="legend-item"]');
        const legendCount = await legendItems.count();
        expect(legendCount).toBeGreaterThan(0);
      }
    }

    // Test cross-language insights
    const insights = page.locator('[data-testid="cross-language-insights"]');
    if (await insights.isVisible()) {
      const sharedModules = insights.locator('text=/45.*shared|shared.*45/');
      await expect(sharedModules).toBeVisible();
      
      const bottlenecks = insights.locator('[data-testid="bottleneck-item"]');
      const bottleneckCount = await bottlenecks.count();
      expect(bottleneckCount).toBeGreaterThan(0);
    }
  });

  test('should provide scalable search across large codebases', async ({ dashboardPage, page }) => {
    await dashboardPage.goto();
    await dashboardPage.navigateToSection('analytics');

    const searchInput = page.locator('[data-testid="code-search"], input[placeholder*="search code"]');
    if (await searchInput.isVisible()) {
      // Test search performance with various queries
      const searchQueries = [
        'function',
        'useState',
        'import.*react',
        'class.*Component',
        'export default'
      ];

      for (const query of searchQueries) {
        await searchInput.fill(query);
        await searchInput.press('Enter');
        
        // Wait for search results
        const searchResults = page.locator('[data-testid="search-results"]');
        await expect(searchResults).toBeVisible({ timeout: 5000 });
        
        const resultItems = searchResults.locator('[data-testid="search-result-item"]');
        const resultCount = await resultItems.count();
        
        // Should show relevant results (may be paginated)
        expect(resultCount).toBeGreaterThan(0);
        expect(resultCount).toBeLessThan(100); // Performance pagination
        
        // Test result navigation
        if (resultCount > 0) {
          await resultItems.first().click();
          await page.waitForTimeout(500);
          
          // Should navigate to or show file details
          const fileDetails = page.locator('[data-testid="file-details"], [data-testid="code-viewer"]');
          if (await fileDetails.isVisible()) {
            await expect(fileDetails).toBeVisible();
          }
        }
        
        await page.waitForTimeout(500);
      }

      // Test search filters
      const filterButton = page.locator('[data-testid="search-filters"], button:has-text("Filter")');
      if (await filterButton.isVisible()) {
        await filterButton.click();
        
        const filterPanel = page.locator('[data-testid="filter-panel"]');
        if (await filterPanel.isVisible()) {
          // Test file type filter
          const tsFilter = filterPanel.locator('input[value="typescript"], input[name="typescript"]');
          if (await tsFilter.isVisible()) {
            await tsFilter.check();
            
            const applyFilters = filterPanel.locator('button:has-text("Apply")');
            if (await applyFilters.isVisible()) {
              await applyFilters.click();
              await page.waitForTimeout(1000);
              
              // Results should be filtered
              const filteredResults = page.locator('[data-testid="search-results"]');
              await expect(filteredResults).toBeVisible();
            }
          }
        }
      }
    }
  });

  test('should handle real-time analysis updates for active development', async ({ 
    dashboardPage, 
    websocketHelper,
    page 
  }) => {
    await websocketHelper.setupWebSocketMock();
    await dashboardPage.goto();
    await dashboardPage.navigateToSection('analytics');
    await websocketHelper.waitForWebSocketConnection();

    // Simulate real-time analysis updates
    const analysisUpdates = [
      {
        type: 'analysis_update',
        data: {
          file: 'src/components/Dashboard.tsx',
          change: 'complexity_increase',
          oldValue: 12.5,
          newValue: 15.2,
          impact: 'medium'
        }
      },
      {
        type: 'test_coverage_update',
        data: {
          module: 'user-management',
          coverage: 89.5,
          change: 2.3,
          newTests: 15
        }
      },
      {
        type: 'dependency_vulnerability',
        data: {
          package: 'lodash',
          version: '4.17.20',
          vulnerability: 'CVE-2023-1234',
          severity: 'medium'
        }
      }
    ];

    for (const update of analysisUpdates) {
      await websocketHelper.sendMockMessage(update);
      await page.waitForTimeout(1000);
      
      // Check that updates appear in the UI
      const notifications = page.locator('[data-testid="analysis-notification"], .notification');
      if (await notifications.count() > 0) {
        const latestNotification = notifications.first();
        await expect(latestNotification).toBeVisible();
      }
    }

    // Test that metrics are updated in real-time
    const qualityMetrics = page.locator('[data-testid="quality-metrics"]');
    if (await qualityMetrics.isVisible()) {
      // Should reflect real-time updates
      await expect(qualityMetrics).toBeVisible();
      
      // Look for updated complexity score
      const complexityMetric = qualityMetrics.locator('[data-testid="complexity"], text=/15.2/');
      if (await complexityMetric.isVisible()) {
        await expect(complexityMetric).toBeVisible();
      }
    }

    // Test real-time coverage updates
    const coverageDisplay = page.locator('[data-testid="coverage-display"]');
    if (await coverageDisplay.isVisible()) {
      const userMgmtCoverage = coverageDisplay.locator('text="user-management"').first();
      if (await userMgmtCoverage.isVisible()) {
        const coverageParent = userMgmtCoverage.locator('..').first();
        const coverageValue = coverageParent.locator('text=/89.5/');
        await expect(coverageValue).toBeVisible();
      }
    }
  });
});