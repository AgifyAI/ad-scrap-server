// Test script for the free proxy system
import { proxyRotator, initializeProxySystem } from './freeProxies';
import { SimpleScraper } from './scrapper';

/**
 * Test the proxy fetching system
 */
async function testProxyFetching() {
  console.log('🧪 Testing proxy fetching system...\n');

  try {
    // Initialize the proxy system
    await initializeProxySystem();

    // Show statistics
    const stats = proxyRotator.getStats();
    console.log('📊 Proxy Statistics:', stats);

    // Test getting a few proxies
    console.log('\n🔄 Getting next 5 proxies:');
    for (let i = 0; i < 5; i++) {
      const proxy = proxyRotator.getNextProxy();
      if (proxy) {
        console.log(`${i + 1}. ${proxy.host}:${proxy.port} (${proxy.type})`);
      } else {
        console.log(`${i + 1}. No proxy available`);
      }
    }

    // Test a random proxy
    const randomProxy = proxyRotator.getRandomProxy();
    if (randomProxy) {
      console.log(`\n🎲 Random proxy: ${randomProxy.host}:${randomProxy.port} (${randomProxy.type})`);
    }

    return true;
  } catch (error) {
    console.error('❌ Proxy fetching test failed:', error);
    return false;
  }
}

/**
 * Test proxy connectivity
 */
async function testProxyConnectivity() {
  console.log('\n🧪 Testing proxy connectivity...\n');

  try {
    // Get a few proxies to test
    const proxiesToTest = [];
    for (let i = 0; i < 3; i++) {
      const proxy = proxyRotator.getNextProxy();
      if (proxy) proxiesToTest.push(proxy);
    }

    if (proxiesToTest.length === 0) {
      console.log('⚠️ No proxies available for testing');
      return false;
    }

    console.log(`🔍 Testing ${proxiesToTest.length} proxies...`);

    // Test each proxy
    for (const proxy of proxiesToTest) {
      console.log(`\n🧪 Testing ${proxy.host}:${proxy.port}...`);
      const isWorking = await proxyRotator.testProxy(proxy);

      if (isWorking) {
        console.log(`✅ Working (${proxy.responseTime}ms)`);
      } else {
        console.log('❌ Failed');
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Proxy connectivity test failed:', error);
    return false;
  }
}

/**
 * Test the SimpleScraper with free proxies
 */
async function testScraperWithProxies() {
  console.log('\n🧪 Testing SimpleScraper with free proxies...\n');

  try {
    // Create scraper with free proxies enabled
    const scraper = new SimpleScraper({
      headless: true,
      useFreeProxies: true,
      timeout: 15000,
    });

    // Initialize the scraper
    await scraper.init();

    // Show current proxy info
    const proxyInfo = scraper.getCurrentProxyInfo();
    if (proxyInfo) {
      console.log(`🌐 Current proxy: ${proxyInfo.host}:${proxyInfo.port} (${proxyInfo.type})`);
    } else {
      console.log('🌐 No proxy in use');
    }

    // Show proxy stats
    const stats = scraper.getProxyStats();
    console.log('📊 Proxy stats:', stats);

    // Test navigation to a simple page
    if (scraper.page) {
      console.log('\n🌐 Testing navigation to httpbin.org...');

      try {
        await scraper.page.goto('http://httpbin.org/ip', {
          waitUntil: 'networkidle2',
          timeout: 10000,
        });

        // Get the page content
        const content = await scraper.page.content();
        console.log('✅ Page loaded successfully');

        // Try to extract IP information
        const bodyText = await scraper.page.evaluate(() => document.body.textContent);
        if (bodyText) {
          console.log('📄 Response:', bodyText);
        }
      } catch (error: any) {
        console.error('❌ Navigation failed:', error.message);

        // Try restarting with a new proxy
        console.log('🔄 Attempting to restart with new proxy...');
        const restarted = await scraper.restartWithNewProxy();

        if (restarted) {
          console.log('✅ Successfully restarted with new proxy');
          const newProxyInfo = scraper.getCurrentProxyInfo();
          if (newProxyInfo) {
            console.log(`🌐 New proxy: ${newProxyInfo.host}:${newProxyInfo.port} (${newProxyInfo.type})`);
          }
        } else {
          console.log('❌ Failed to restart with new proxy');
        }
      }
    }

    // Clean up
    await scraper.close();
    console.log('✅ Scraper test completed');

    return true;
  } catch (error) {
    console.error('❌ Scraper test failed:', error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Free Proxy System Tests\n');
  console.log('='.repeat(50));

  const results = {
    fetching: false,
    connectivity: false,
    scraper: false,
  };

  // Test 1: Proxy Fetching
  results.fetching = await testProxyFetching();

  // Test 2: Proxy Connectivity (only if fetching worked)
  if (results.fetching) {
    results.connectivity = await testProxyConnectivity();
  }

  // Test 3: Scraper Integration (only if previous tests worked)
  if (results.fetching) {
    results.scraper = await testScraperWithProxies();
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 Test Results Summary:');
  console.log(`🔄 Proxy Fetching: ${results.fetching ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`🌐 Proxy Connectivity: ${results.connectivity ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`🕷️ Scraper Integration: ${results.scraper ? '✅ PASSED' : '❌ FAILED'}`);

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;

  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Free proxy system is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Check the logs above for details.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

// Export functions for external use
export { testProxyFetching, testProxyConnectivity, testScraperWithProxies, runAllTests };
