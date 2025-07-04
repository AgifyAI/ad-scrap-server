import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { proxyRotator, ProxyConfig, initializeProxySystem } from './freeProxies';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

export class SimpleScraper {
  headless: boolean;
  timeout: number;
  browser: Browser | null;
  page: Page | null;
  sessionCookies: any[] | null;
  currentProxy: ProxyConfig | null;
  useFreeProxies: boolean;

  constructor(options: { headless?: boolean; timeout?: number; sessionCookies?: any[]; useFreeProxies?: boolean } = {}) {
    this.headless = options.headless !== false; // Default to headless
    this.timeout = options.timeout || 30000;
    this.browser = null;
    this.page = null;
    this.sessionCookies = options.sessionCookies || null;
    this.currentProxy = null;
    this.useFreeProxies = options.useFreeProxies !== false; // Default to use free proxies

    // Legacy Bright Data proxy configurations (commented out)
    // Configure Bright Data proxy residential
    // this.proxyConfig = {
    //   host: 'brd.superproxy.io',
    //   port: 33335,
    //   username: 'brd-customer-hl_507845b1-zone-residential_proxy1',
    //   password: '7h9e8uqpqlyn',
    // };

    // Configure Bright Data proxy datacenter
    this.currentProxy = {
      host: 'brd.superproxy.io',
      port: 33335,
      username: 'brd-customer-hl_507845b1-zone-datacenter_proxy1',
      password: '4ez6bjx2a46p',
      type: 'http',
    };
  }

  async init() {
    console.log('🚀 Launching browser...');

    // Initialize free proxy system if enabled
    if (this.useFreeProxies) {
      console.log('🌐 Initializing free proxy system...');
      await initializeProxySystem();
      this.currentProxy = proxyRotator.getNextProxy();

      if (this.currentProxy) {
        console.log(`🔄 Selected proxy: ${this.currentProxy.host}:${this.currentProxy.port} (${this.currentProxy.type})`);
      } else {
        console.log('⚠️ No proxy available, proceeding without proxy');
      }
    }

    const launchOptions: any = {
      headless: this.headless,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      ignoreHTTPSErrors: true, // Important for proxy
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
    };

    // Configure free proxy if available
    if (this.currentProxy) {
      const proxyUrl = `${this.currentProxy.host}:${this.currentProxy.port}`;
      console.log(`🌐 Using free proxy: ${proxyUrl} (${this.currentProxy.type})`);

      if (launchOptions.args) {
        launchOptions.args.push(`--proxy-server=${proxyUrl}`);
        // Add SSL/Certificate options for proxy
        launchOptions.args.push('--ignore-certificate-errors');
        launchOptions.args.push('--ignore-ssl-errors');
        launchOptions.args.push('--ignore-certificate-errors-spki-list');
        launchOptions.args.push('--disable-extensions-http-throttling');
        launchOptions.args.push('--accept-lang=en-US,en;q=0.9');
      }
    }

    console.log('launchOptions.args : ', launchOptions.args);

    this.browser = await puppeteer.launch(launchOptions);

    this.page = await this.browser.newPage();

    // Configure proxy authentication if proxy has credentials
    if (this.currentProxy && this.currentProxy.username && this.currentProxy.password) {
      console.log('🔐 Configuring proxy authentication...');
      await this.page.authenticate({
        username: this.currentProxy.username,
        password: this.currentProxy.password,
      });
      console.log('✅ Proxy authentication configured');
    }

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
    // this.page.on('error', (error) => {
    //   console.error('⚠️ Page error:', error.message);
    //   this.handleProxyError();
    // });

    // this.page.on('pageerror', (error) => {
    //   console.error('⚠️ Page script error:', error.message);
    // });

    // Monitor network requests to see if they're being blocked
    // this.page.on('requestfailed', (request) => {
    //   console.error('⚠️ Request failed:', request.url(), 'Error:', request.failure()?.errorText);
    //   // If proxy-related error, try to switch proxy
    //   const errorText = request.failure()?.errorText;
    //   if (errorText && (errorText.includes('PROXY') || errorText.includes('ERR_TUNNEL_CONNECTION_FAILED'))) {
    //     this.handleProxyError();
    //   }
    // });

    // this.page.on('response', (response) => {
    //   if (!response.ok()) {
    //     console.error('⚠️ HTTP error:', response.status(), response.url());
    //     // Handle proxy-related HTTP errors
    //     if (response.status() === 407 || response.status() === 502 || response.status() === 503) {
    //       this.handleProxyError();
    //     }
    //   }
    // });

    // Monitor console logs from the page
    // this.page.on('console', (msg) => {
    //   const type = msg.type();
    //   if (type === 'error' || type === 'warn') {
    //     console.log(`🌐 Browser ${type}:`, msg.text());
    //   }
    // });

    // Load session cookies if provided (helps avoid rate limiting)
    if (this.sessionCookies && this.sessionCookies.length > 0) {
      console.log(`🍪 Loading ${this.sessionCookies.length} session cookies...`);
      await this.page.setCookie(...this.sessionCookies);
      console.log('✅ Session cookies loaded');
    }

    // Add human behavior (stealth plugin handles most automation hiding)
    await this.addHumanBehavior();

    console.log('✅ Browser ready!');
  }

  /**
   * Handle proxy errors by switching to a new proxy
   */
  private handleProxyError() {
    if (this.currentProxy && this.useFreeProxies) {
      console.log('🔄 Handling proxy error, marking current proxy as failed...');
      proxyRotator.markProxyAsFailed(this.currentProxy);

      // Get next proxy for future use (would require browser restart)
      const nextProxy = proxyRotator.getNextProxy();
      if (nextProxy) {
        console.log(`🔄 Next available proxy: ${nextProxy.host}:${nextProxy.port}`);
      } else {
        console.log('⚠️ No more proxies available');
      }
    }
  }

  /**
   * Restart browser with a new proxy
   */
  async restartWithNewProxy(): Promise<boolean> {
    if (!this.useFreeProxies) {
      console.log('⚠️ Free proxies disabled, cannot restart with new proxy');
      return false;
    }

    console.log('🔄 Restarting browser with new proxy...');

    // Save cookies before closing
    const cookies = await this.saveCookies();

    // Close current browser
    await this.close();

    // Get new proxy
    this.currentProxy = proxyRotator.getNextProxy();

    if (!this.currentProxy) {
      console.log('❌ No proxy available for restart');
      return false;
    }

    // Restore cookies
    this.sessionCookies = cookies;

    // Reinitialize with new proxy
    await this.init();

    console.log('✅ Browser restarted with new proxy');
    return true;
  }

  /**
   * Get current proxy information
   */
  getCurrentProxyInfo(): ProxyConfig | null {
    return this.currentProxy;
  }

  /**
   * Get proxy system statistics
   */
  getProxyStats() {
    if (!this.useFreeProxies) {
      return { message: 'Free proxies disabled' };
    }
    return proxyRotator.getStats();
  }

  async saveCookies(): Promise<any[]> {
    if (!this.page) return [];

    try {
      const cookies = await this.page.cookies();
      console.log(`💾 Saved ${cookies.length} cookies for future sessions`);
      return cookies;
    } catch (error: any) {
      console.error('Failed to save cookies:', error.message);
      return [];
    }
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

    // Add more aggressive viewport randomization to avoid fingerprinting
    const viewports = [
      { width: 1920, height: 1080 }, // Full HD
      { width: 1366, height: 768 }, // Common laptop
      { width: 1440, height: 900 }, // MacBook
      { width: 1536, height: 864 }, // Windows
      { width: 1280, height: 720 }, // HD
      { width: 1600, height: 900 }, // Wide
    ];
    const randomViewport = viewports[Math.floor(Math.random() * viewports.length)];

    // Add small random variations
    randomViewport.width += Math.floor(Math.random() * 40) - 20;
    randomViewport.height += Math.floor(Math.random() * 40) - 20;

    console.log(`📱 Using viewport: ${randomViewport.width}x${randomViewport.height}`);
    await this.page.setViewport(randomViewport);

    // Note: User-agent randomization is now handled by stealth plugin
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser closed');
    }
  }
}
