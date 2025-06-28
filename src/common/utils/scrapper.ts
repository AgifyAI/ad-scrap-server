import puppeteer, { Browser, Page } from 'puppeteer';

export class SimpleScraper {
  headless: boolean;
  timeout: number;
  browser: Browser | null;
  page: Page | null;

  constructor(options: { headless?: boolean; timeout?: number } = {}) {
    this.headless = options.headless !== false; // Default to headless
    this.timeout = options.timeout || 30000;
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('🚀 Launching browser...');
    this.browser = await puppeteer.launch({
      headless: this.headless,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',

        // Maximum permissive settings for JS and network
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor,TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-field-trial-config',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--disable-translate',
        '--disable-extensions',
        '--allow-running-insecure-content',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--ignore-certificate-errors-spki-list',
        '--reduce-security-for-testing',
        '--disable-permissions-api',
        '--disable-popup-blocking',
      ],
    });

    this.page = await this.browser.newPage();
    await this.page.setDefaultTimeout(this.timeout);

    // Set viewport for consistency
    await this.page.setViewport({ width: 1280, height: 720 });

    // Set user agent to avoid detection (updated to recent Chrome)
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    // Explicitly enable JavaScript and remove restrictions
    await this.page.setJavaScriptEnabled(true);

    // Set extra HTTP headers to appear more like a real browser
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    });

    // Add comprehensive error handling and network monitoring
    this.page.on('error', (error) => {
      console.error('⚠️ Page error:', error.message);
    });

    this.page.on('pageerror', (error) => {
      console.error('⚠️ Page script error:', error.message);
    });

    // Monitor network requests to see if they're being blocked
    this.page.on('requestfailed', (request) => {
      console.error('⚠️ Request failed:', request.url(), 'Error:', request.failure()?.errorText);
    });

    this.page.on('response', (response) => {
      if (!response.ok()) {
        console.error('⚠️ HTTP error:', response.status(), response.url());
      }
    });

    // Monitor console logs from the page
    this.page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warn') {
        console.log(`🌐 Browser ${type}:`, msg.text());
      }
    });

    console.log('✅ Browser ready!');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser closed');
    }
  }
}
