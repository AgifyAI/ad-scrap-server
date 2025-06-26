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
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-features=VizDisplayCompositor',
      ],
    });

    this.page = await this.browser.newPage();
    await this.page.setDefaultTimeout(this.timeout);

    // Set viewport for consistency
    await this.page.setViewport({ width: 1280, height: 720 });

    // Set user agent to avoid detection
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );

    // Add error handling for page crashes
    this.page.on('error', (error) => {
      console.error('⚠️ Page error:', error.message);
    });

    this.page.on('pageerror', (error) => {
      console.error('⚠️ Page script error:', error.message);
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
