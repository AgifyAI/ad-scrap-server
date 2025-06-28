import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

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
        // Let stealth plugin handle most detection avoidance
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    });

    this.page = await this.browser.newPage();
    await this.page.setDefaultTimeout(this.timeout);

    // Set viewport for consistency
    await this.page.setViewport({ width: 1280, height: 720 });

    // Note: Stealth plugin automatically handles user-agent and most headers
    // Explicitly enable JavaScript
    await this.page.setJavaScriptEnabled(true);

    // Set minimal additional headers (stealth plugin handles the rest)
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      DNT: '1',
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

    // Add human behavior (stealth plugin handles most automation hiding)
    await this.addHumanBehavior();

    console.log('✅ Browser ready!');
  }

  // Note: Most automation hiding is now handled by puppeteer-extra-plugin-stealth
  // This function is kept for any additional customizations if needed

  async addHumanBehavior() {
    if (!this.page) return;

    // Random mouse movements to simulate human behavior
    await this.page.evaluate(() => {
      // Simulate random mouse movements
      let mouseX = Math.random() * window.innerWidth;
      let mouseY = Math.random() * window.innerHeight;

      const moveInterval = setInterval(() => {
        mouseX += (Math.random() - 0.5) * 20;
        mouseY += (Math.random() - 0.5) * 20;

        mouseX = Math.max(0, Math.min(window.innerWidth, mouseX));
        mouseY = Math.max(0, Math.min(window.innerHeight, mouseY));

        const event = new MouseEvent('mousemove', {
          clientX: mouseX,
          clientY: mouseY,
          bubbles: true,
        });
        document.dispatchEvent(event);
      }, 1000 + Math.random() * 2000); // Every 1-3 seconds

      // Stop after 30 seconds
      setTimeout(() => clearInterval(moveInterval), 30000);
    });

    // Add random viewport size variations
    const width = 1280 + Math.floor(Math.random() * 200) - 100; // 1180-1380
    const height = 720 + Math.floor(Math.random() * 200) - 100; // 620-820
    await this.page.setViewport({ width, height });

    // Note: User-agent randomization is now handled by stealth plugin
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser closed');
    }
  }
}
