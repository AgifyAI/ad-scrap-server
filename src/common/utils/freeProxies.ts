// Free proxy rotation system with dynamic proxy fetching
import axios from 'axios';

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'http' | 'https' | 'socks4' | 'socks5';
  country?: string;
  anonymity?: string;
  lastTested?: Date;
  responseTime?: number;
  isWorking?: boolean;
}

// Proxy sources configuration
export const PROXY_SOURCES = {
  PROXYSCRAPE_HTTP:
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all&skip=0&limit=100',
  PROXYSCRAPE_HTTPS:
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=https&timeout=10000&country=all&ssl=all&anonymity=all&skip=0&limit=50',
  PROXYSCRAPE_SOCKS4:
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=10000&country=all&ssl=all&anonymity=all&skip=0&limit=50',
  PROXYSCRAPE_SOCKS5:
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all&ssl=all&anonymity=all&skip=0&limit=50',
  GITHUB_HTTP: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
  GITHUB_SOCKS4: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
  GITHUB_SOCKS5: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
};

// Fallback static proxies (updated regularly)
export const FALLBACK_PROXIES: ProxyConfig[] = [
  // HTTP Proxies
  { host: '8.210.83.33', port: 80, type: 'http' },
  { host: '47.74.152.29', port: 8888, type: 'http' },
  { host: '103.127.1.130', port: 80, type: 'http' },
  { host: '191.252.58.204', port: 3128, type: 'http' },
  { host: '103.245.204.214', port: 8080, type: 'http' },

  // HTTPS Proxies
  { host: '185.162.251.76', port: 80, type: 'https' },
  { host: '41.65.236.57', port: 1981, type: 'https' },
  { host: '103.127.1.130', port: 80, type: 'https' },
];

export class FreeProxyRotator {
  private currentIndex = 0;
  private proxies: ProxyConfig[] = [];
  private failedProxies: Set<string> = new Set();
  private lastFetch: Date | null = null;
  private fetchInterval = 30 * 60 * 1000; // 30 minutes
  private testTimeout = 5000; // 5 seconds for proxy testing

  constructor(customProxies?: ProxyConfig[]) {
    this.proxies = customProxies || [...FALLBACK_PROXIES];
  }

  /**
   * Get the next working proxy from the rotation
   */
  getNextProxy(): ProxyConfig | null {
    // Auto-refresh proxies if needed
    if (!this.lastFetch || Date.now() - this.lastFetch.getTime() > this.fetchInterval) {
      console.log('🔄 Auto-refreshing proxy list...');
      this.fetchFreshProxies().catch(console.error);
    }

    // Filter out failed proxies
    const workingProxies = this.proxies.filter((proxy) => !this.failedProxies.has(`${proxy.host}:${proxy.port}`));

    if (workingProxies.length === 0) {
      console.log('🚫 All proxies failed, resetting and using fallback...');
      this.failedProxies.clear();
      this.proxies = [...FALLBACK_PROXIES];
      return this.proxies[0] || null;
    }

    const proxy = workingProxies[this.currentIndex % workingProxies.length];
    this.currentIndex++;

    console.log(`🔄 Using proxy: ${proxy.host}:${proxy.port} (${proxy.type})`);
    return proxy;
  }

  /**
   * Mark a proxy as failed
   */
  markProxyAsFailed(proxy: ProxyConfig) {
    const key = `${proxy.host}:${proxy.port}`;
    this.failedProxies.add(key);
    console.log(`❌ Marked proxy as failed: ${key}`);
  }

  /**
   * Get all currently available proxies
   */
  getAvailableProxies(): ProxyConfig[] {
    return this.proxies.filter((proxy) => !this.failedProxies.has(`${proxy.host}:${proxy.port}`));
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    const total = this.proxies.length;
    const failed = this.failedProxies.size;
    const working = total - failed;

    return {
      total,
      working,
      failed,
      lastFetch: this.lastFetch,
      types: this.proxies.reduce((acc, proxy) => {
        acc[proxy.type] = (acc[proxy.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Fetch fresh free proxies from multiple online sources
   */
  async fetchFreshProxies(): Promise<ProxyConfig[]> {
    console.log('🔍 Fetching fresh proxies from multiple sources...');

    const allProxies: ProxyConfig[] = [];

    try {
      // Fetch from ProxyScrape API (multiple protocols)
      const proxyScrapeResults = await Promise.allSettled([
        this.fetchFromProxyScrape(PROXY_SOURCES.PROXYSCRAPE_HTTP, 'http'),
        this.fetchFromProxyScrape(PROXY_SOURCES.PROXYSCRAPE_HTTPS, 'https'),
        this.fetchFromProxyScrape(PROXY_SOURCES.PROXYSCRAPE_SOCKS4, 'socks4'),
        this.fetchFromProxyScrape(PROXY_SOURCES.PROXYSCRAPE_SOCKS5, 'socks5'),
      ]);

      proxyScrapeResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allProxies.push(...result.value);
          console.log(`✅ ProxyScrape source ${index + 1}: ${result.value.length} proxies`);
        } else {
          console.error(`❌ ProxyScrape source ${index + 1} failed:`, result.reason);
        }
      });

      // Fetch from GitHub sources
      const githubResults = await Promise.allSettled([
        this.fetchFromGitHub(PROXY_SOURCES.GITHUB_HTTP, 'http'),
        this.fetchFromGitHub(PROXY_SOURCES.GITHUB_SOCKS4, 'socks4'),
        this.fetchFromGitHub(PROXY_SOURCES.GITHUB_SOCKS5, 'socks5'),
      ]);

      githubResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allProxies.push(...result.value);
          console.log(`✅ GitHub source ${index + 1}: ${result.value.length} proxies`);
        } else {
          console.error(`❌ GitHub source ${index + 1} failed:`, result.reason);
        }
      });

      // Remove duplicates and merge with existing
      const uniqueProxies = this.removeDuplicateProxies(allProxies);
      this.proxies = [...uniqueProxies, ...FALLBACK_PROXIES];
      this.lastFetch = new Date();

      console.log(`✅ Total unique proxies fetched: ${uniqueProxies.length}`);
      console.log(`📊 Current proxy pool: ${this.proxies.length} proxies`);

      return this.proxies;
    } catch (error) {
      console.error('❌ Failed to fetch fresh proxies:', error);

      // Fallback to static list if all sources fail
      if (this.proxies.length === 0) {
        this.proxies = [...FALLBACK_PROXIES];
        console.log('🔄 Using fallback proxy list');
      }

      return this.proxies;
    }
  }

  /**
   * Fetch proxies from ProxyScrape API
   */
  private async fetchFromProxyScrape(url: string, type: ProxyConfig['type']): Promise<ProxyConfig[]> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      return this.parseProxyList(response.data, type);
    } catch (error: any) {
      console.error(`Failed to fetch from ProxyScrape (${type}):`, error.message);
      return [];
    }
  }

  /**
   * Fetch proxies from GitHub raw files
   */
  private async fetchFromGitHub(url: string, type: ProxyConfig['type']): Promise<ProxyConfig[]> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      return this.parseProxyList(response.data, type);
    } catch (error: any) {
      console.error(`Failed to fetch from GitHub (${type}):`, error.message);
      return [];
    }
  }

  /**
   * Parse proxy list from various formats
   */
  private parseProxyList(data: string, type: ProxyConfig['type']): ProxyConfig[] {
    const proxies: ProxyConfig[] = [];

    // Split by whitespace or newlines and filter empty strings
    const lines = data.split(/[\s\n\r]+/).filter((line) => line.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse IP:PORT format
      const match = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/);
      if (match) {
        const [, host, portStr] = match;
        const port = parseInt(portStr, 10);

        if (this.isValidIP(host) && port > 0 && port <= 65535) {
          proxies.push({
            host,
            port,
            type,
            lastTested: new Date(),
            isWorking: undefined, // Will be tested later
          });
        }
      }
    }

    return proxies;
  }

  /**
   * Remove duplicate proxies
   */
  private removeDuplicateProxies(proxies: ProxyConfig[]): ProxyConfig[] {
    const seen = new Set<string>();
    return proxies.filter((proxy) => {
      const key = `${proxy.host}:${proxy.port}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Validate IP address format
   */
  private isValidIP(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;

    return parts.every((part) => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
  }

  /**
   * Test a proxy's connectivity
   */
  async testProxy(proxy: ProxyConfig): Promise<boolean> {
    try {
      const proxyUrl = `${proxy.type}://${proxy.host}:${proxy.port}`;
      const startTime = Date.now();

      const response = await axios.get('http://httpbin.org/ip', {
        proxy: {
          protocol: proxy.type,
          host: proxy.host,
          port: proxy.port,
          auth:
            proxy.username && proxy.password
              ? {
                  username: proxy.username,
                  password: proxy.password,
                }
              : undefined,
        },
        timeout: this.testTimeout,
      });

      proxy.responseTime = Date.now() - startTime;
      proxy.isWorking = response.status === 200;
      proxy.lastTested = new Date();

      if (proxy.isWorking) {
        console.log(`✅ Proxy ${proxy.host}:${proxy.port} is working (${proxy.responseTime}ms)`);
      }

      return proxy.isWorking;
    } catch (error: any) {
      proxy.isWorking = false;
      proxy.lastTested = new Date();
      console.log(`❌ Proxy ${proxy.host}:${proxy.port} failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Test all proxies and remove non-working ones
   */
  async testAllProxies(): Promise<void> {
    console.log(`🧪 Testing ${this.proxies.length} proxies...`);

    const testPromises = this.proxies.map((proxy) => this.testProxy(proxy));
    await Promise.allSettled(testPromises);

    // Remove non-working proxies
    const workingProxies = this.proxies.filter((proxy) => proxy.isWorking !== false);
    const removedCount = this.proxies.length - workingProxies.length;

    this.proxies = workingProxies;
    console.log(`✅ Proxy testing complete. Removed ${removedCount} non-working proxies. ${this.proxies.length} proxies remaining.`);
  }

  /**
   * Reset failed proxies list (give them another chance)
   */
  resetFailedProxies(): void {
    this.failedProxies.clear();
    console.log('🔄 Reset failed proxies list');
  }

  /**
   * Get a random proxy (useful for testing)
   */
  getRandomProxy(): ProxyConfig | null {
    const workingProxies = this.getAvailableProxies();
    if (workingProxies.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * workingProxies.length);
    return workingProxies[randomIndex];
  }
}

// Export singleton instance
export const proxyRotator = new FreeProxyRotator();

// Utility function to initialize proxy system
export async function initializeProxySystem(): Promise<void> {
  console.log('🚀 Initializing proxy system...');
  await proxyRotator.fetchFreshProxies();

  // Optionally test proxies on startup (can be slow)
  // await proxyRotator.testAllProxies();

  console.log('✅ Proxy system initialized');
  console.log('📊 Stats:', proxyRotator.getStats());
}
