import { Page, Locator, expect } from '@playwright/test';
import { TEST_CONFIG, DashboardName } from './test-config';

/**
 * Base Page Object for common functionality
 */
export class BasePage {
  constructor(
    protected page: Page,
    protected dashboard: DashboardName
  ) {}

  get baseURL() {
    return TEST_CONFIG.dashboards[this.dashboard].baseURL;
  }

  async goto(path: string = '/') {
    const url = `${this.baseURL}${path}`;
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('body', { state: 'visible' });
  }

  async checkForJSErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    this.page.on('pageerror', (error) => {
      errors.push(`Page Error: ${error.message}`);
    });

    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(`Console Error: ${msg.text()}`);
      }
    });

    return errors;
  }

  async checkForFailedRequests(): Promise<string[]> {
    const failedRequests: string[] = [];

    this.page.on('response', (response) => {
      if (!response.ok() && response.status() !== 404) {
        failedRequests.push(`Failed Request: ${response.url()} - ${response.status()}`);
      }
    });

    return failedRequests;
  }

  async getAllLinks(): Promise<Locator[]> {
    return await this.page.locator('a[href]').all();
  }

  async checkBrokenLinks(): Promise<string[]> {
    const brokenLinks: string[] = [];
    const links = await this.getAllLinks();

    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('mailto:')) {
        try {
          const response = await this.page.request.get(href);
          if (!response.ok()) {
            brokenLinks.push(`${href} - ${response.status()}`);
          }
        } catch (_error) {
          brokenLinks.push(`${href} - Network Error`);
        }
      }
    }

    return brokenLinks;
  }

  async checkMissingImages(): Promise<string[]> {
    const missingImages: string[] = [];
    const images = await this.page.locator('img').all();

    for (const img of images) {
      const src = await img.getAttribute('src');
      if (src) {
        try {
          const response = await this.page.request.get(src);
          if (!response.ok()) {
            missingImages.push(`${src} - ${response.status()}`);
          }
        } catch (_error) {
          missingImages.push(`${src} - Network Error`);
        }
      }
    }

    return missingImages;
  }

  async validatePageStructure() {
    // Check for essential page elements
    await expect(this.page.locator('html')).toBeVisible();
    await expect(this.page.locator('body')).toBeVisible();
    
    // Check for basic meta tags
    const title = await this.page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  }
}

/**
 * Dashboard-specific Page Objects
 */
export class WundrDashboardPage extends BasePage {
  constructor(page: Page) {
    super(page, 'wundr');
  }

  get overviewPage() {
    return this.page.locator('[data-testid="dashboard-overview"]');
  }

  get metricsGrid() {
    return this.page.locator('[data-testid="metrics-grid"]');
  }

  get realTimeStatus() {
    return this.page.locator('[data-testid="realtime-status"]');
  }

  async validateDashboardLayout() {
    await this.validatePageStructure();
    // Additional Wundr-specific validations can be added here
  }
}

export class WebClientDashboardPage extends BasePage {
  constructor(page: Page) {
    super(page, 'webClient');
  }

  get sidebar() {
    return this.page.locator('[data-testid="app-sidebar"]');
  }

  get mainContent() {
    return this.page.locator('main, [role="main"]');
  }

  get analysisSection() {
    return this.page.locator('[data-testid="analysis-section"]');
  }

  async validateDashboardLayout() {
    await this.validatePageStructure();
    
    // Check for sidebar navigation
    const sidebarExists = await this.sidebar.count() > 0;
    if (sidebarExists) {
      await expect(this.sidebar).toBeVisible();
    }
    
    // Check for main content area
    await expect(this.mainContent).toBeVisible();
  }

  async navigateToAnalysis(type: string) {
    await this.page.click(`[href="/dashboard/analysis/${type}"]`);
    await this.waitForPageLoad();
  }

  async checkAnalysisData() {
    const analysisCards = await this.page.locator('.analysis-card, .summary-card').count();
    return analysisCards > 0;
  }
}