// Simple demonstration of the free proxy system
import { proxyRotator, initializeProxySystem, ProxyConfig } from './freeProxies';
import { SimpleScraper } from './scrapper';

/**
 * Simple demo function to show basic proxy usage
 */
async function basicProxyDemo() {
  console.log('🚀 Basic Proxy System Demo');
  console.log('='.repeat(40));

  try {
    // Step 1: Initialize the proxy system
    console.log('📡 Initializing proxy system...');
    await initializeProxySystem();

    // Step 2: Show current statistics
    const stats = proxyRotator.getStats();
    console.log('\n📊 Current proxy statistics:');
    console.log(`   Total proxies: ${stats.total}`);
    console.log(`   Working proxies: ${stats.working}`);
    console.log(`   Failed proxies: ${stats.failed}`);
    console.log(`   Last fetch: ${stats.lastFetch}`);
    console.log(`   Proxy types:`, stats.types);

    // Step 3: Get and display some proxies
    console.log('\n🔄 Getting 5 random proxies:');
    for (let i = 0; i < 5; i++) {
      const proxy = proxyRotator.getNextProxy();
      if (proxy) {
        console.log(`   ${i + 1}. ${proxy.host}:${proxy.port} (${proxy.type})`);
      } else {
        console.log(`   ${i + 1}. No proxy available`);
        break;
      }
    }

    console.log('\n✅ Basic demo completed successfully!');
    return true;
  } catch (error) {
    console.error('\n❌ Basic demo failed:', error);
    return false;
  }
}

/**
 * Demo function to show web scraping with proxies
 */
async function scraperProxyDemo() {
  console.log('\n🕷️ Web Scraper with Proxy Demo');
  console.log('='.repeat(40));

  let scraper: SimpleScraper | null = null;

  try {
    // Create scraper with proxy support
    console.log('🔧 Creating scraper with proxy support...');
    scraper = new SimpleScraper({
      headless: true,
      useFreeProxies: true,
      timeout: 15000,
    });

    // Initialize scraper
    console.log('🚀 Initializing scraper...');
    await scraper.init();

    // Show current proxy
    const proxyInfo = scraper.getCurrentProxyInfo();
    if (proxyInfo) {
      console.log(`🌐 Using proxy: ${proxyInfo.host}:${proxyInfo.port} (${proxyInfo.type})`);
    } else {
      console.log('🌐 No proxy in use (direct connection)');
    }

    // Test simple navigation
    if (scraper.page) {
      console.log('\n📄 Testing page navigation...');

      try {
        // Navigate to a simple test page
        await scraper.page.goto('http://httpbin.org/ip', {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });

        // Get the response
        const content = await scraper.page.evaluate(() => {
          return document.body.textContent || document.body.innerText;
        });

        console.log('✅ Page loaded successfully!');
        console.log('📄 Response content:', content?.substring(0, 200));
      } catch (navigationError: any) {
        console.error('❌ Navigation failed:', navigationError.message);

        // Try with a different proxy
        console.log('🔄 Trying to restart with new proxy...');
        const restarted = await scraper.restartWithNewProxy();

        if (restarted) {
          const newProxy = scraper.getCurrentProxyInfo();
          console.log(`✅ Restarted with new proxy: ${newProxy?.host}:${newProxy?.port}`);
        } else {
          console.log('❌ Failed to restart with new proxy');
        }
      }
    }

    console.log('\n✅ Scraper demo completed!');
    return true;
  } catch (error) {
    console.error('\n❌ Scraper demo failed:', error);
    return false;
  } finally {
    // Clean up
    if (scraper) {
      await scraper.close();
      console.log('🧹 Scraper cleaned up');
    }
  }
}

/**
 * Demo function to test proxy connectivity
 */
async function proxyConnectivityDemo() {
  console.log('\n🧪 Proxy Connectivity Test Demo');
  console.log('='.repeat(40));

  try {
    // Get a few proxies to test
    const testProxies: ProxyConfig[] = [];

    console.log('🎯 Selecting proxies for testing...');
    for (let i = 0; i < 3; i++) {
      const proxy = proxyRotator.getNextProxy();
      if (proxy) {
        testProxies.push(proxy);
        console.log(`   Selected: ${proxy.host}:${proxy.port} (${proxy.type})`);
      }
    }

    if (testProxies.length === 0) {
      console.log('⚠️ No proxies available for testing');
      return false;
    }

    console.log(`\n🔍 Testing ${testProxies.length} proxies...`);

    // Test each proxy
    const results = [];
    for (let i = 0; i < testProxies.length; i++) {
      const proxy = testProxies[i];
      console.log(`\n🧪 Testing proxy ${i + 1}: ${proxy.host}:${proxy.port}`);

      const startTime = Date.now();
      const isWorking = await proxyRotator.testProxy(proxy);
      const testTime = Date.now() - startTime;

      results.push({
        proxy,
        working: isWorking,
        testTime,
        responseTime: proxy.responseTime,
      });

      if (isWorking) {
        console.log(`   ✅ Working (Response: ${proxy.responseTime}ms, Test: ${testTime}ms)`);
      } else {
        console.log(`   ❌ Failed (Test time: ${testTime}ms)`);
      }
    }

    // Summary
    const workingCount = results.filter((r) => r.working).length;
    console.log(`\n📊 Test Summary:`);
    console.log(`   Working proxies: ${workingCount}/${testProxies.length}`);
    console.log(`   Success rate: ${Math.round((workingCount / testProxies.length) * 100)}%`);

    return workingCount > 0;
  } catch (error) {
    console.error('\n❌ Connectivity demo failed:', error);
    return false;
  }
}

/**
 * Main demo function that runs all demonstrations
 */
async function runCompleteDemo() {
  console.log('🎉 Free Proxy System - Complete Demo');
  console.log('='.repeat(60));
  console.log('This demo will show you how to use the free proxy system.\n');

  const results = {
    basic: false,
    connectivity: false,
    scraper: false,
  };

  // Run basic demo
  results.basic = await basicProxyDemo();

  // Run connectivity demo
  if (results.basic) {
    results.connectivity = await proxyConnectivityDemo();
  }

  // Run scraper demo
  if (results.basic) {
    results.scraper = await scraperProxyDemo();
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('🏁 Demo Results Summary:');
  console.log(`   📡 Basic Proxy Demo: ${results.basic ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   🧪 Connectivity Demo: ${results.connectivity ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   🕷️ Scraper Demo: ${results.scraper ? '✅ PASSED' : '❌ FAILED'}`);

  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;

  console.log(`\n🎯 Overall Success: ${passedCount}/${totalCount} demos passed`);

  if (passedCount === totalCount) {
    console.log('\n🎉 All demos completed successfully!');
    console.log('Your free proxy system is ready to use.');
  } else {
    console.log('\n⚠️ Some demos had issues. This is normal with free proxies.');
    console.log('The system will automatically handle failed proxies and rotate to working ones.');
  }

  console.log('\n📚 Usage Tips:');
  console.log('   • Use initializeProxySystem() before using proxies');
  console.log('   • Use proxyRotator.getNextProxy() to get a proxy');
  console.log('   • Use SimpleScraper with useFreeProxies: true');
  console.log('   • Check proxy statistics with proxyRotator.getStats()');
  console.log('   • Test proxies with proxyRotator.testProxy(proxy)');
}

// Export functions
export { basicProxyDemo, scraperProxyDemo, proxyConnectivityDemo, runCompleteDemo };

// Run complete demo if this file is executed directly
if (require.main === module) {
  runCompleteDemo().catch(console.error);
}
