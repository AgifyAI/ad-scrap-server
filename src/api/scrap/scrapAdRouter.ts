import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';

import { createApiResponse } from '@/api-docs/openAPIResponseBuilders';
import { SimpleScraper } from '@/common/utils/scrapper';
import { ServiceResponse } from '@/common/models/serviceResponse';
import { StatusCodes } from 'http-status-codes';
import { Page } from 'puppeteer';
import { tokenAuth } from '@/common/middleware/tokenAuth';

export const scrapAdsRegistry = new OpenAPIRegistry();
export const scrapAdsRouter: Router = express.Router();

scrapAdsRegistry.registerPath({
  method: 'get',
  path: '/fbad',
  tags: ['Scrap Ads'],
  responses: createApiResponse(z.null(), 'Success'),
});

async function myScrapingLogic(page: Page): Promise<any> {
  const MAX_ITERATIONS = 2000;

  console.log('🔍 Starting scraping logic...');

  page.on('close', () => {
    console.error('⚠️ PAGE CLOSED EVENT DETECTED!');
  });

  page.on('error', (error) => {
    console.error('⚠️ PAGE ERROR EVENT:', error.message);
  });

  console.log('⏳ Waiting for body selector...');
  await page.waitForSelector('body', { timeout: 10000 });

  console.log('⏳ Initial wait for page load...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Simulate normal browsing behavior to avoid rate limiting
  console.log('🎭 Simulating normal browsing behavior...');

  // Random browsing simulation (scroll, wait, hover)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      // Random scroll
      const scrollHeight = Math.random() * document.body.scrollHeight * 0.3;
      window.scrollTo(0, scrollHeight);
    });

    // Random wait between 3-8 seconds
    const waitTime = 3000 + Math.random() * 2000;
    console.log(`🕐 Browsing simulation ${i + 1}/3 - waiting ${Math.round(waitTime)}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  console.log('✅ Browsing simulation completed');

  console.log('📄 Current URL:', await page.url());
  console.log('📄 Page title:', await page.title());

  const scrollPageToBottom = async () => {
    if (page.isClosed()) {
      throw new Error('Page was closed during scroll');
    }

    try {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error('Error during scroll:', error.message);
      throw error;
    }
  };

  let previousHeight = 0;
  let scrollAttempts = 0;
  const MAX_SCROLL_ATTEMPTS = 40;

  console.log('Starting scroll to load more ads...');

  while (scrollAttempts < MAX_SCROLL_ATTEMPTS) {
    try {
      await scrollPageToBottom();

      if (page.isClosed()) {
        throw new Error('Page was closed after scroll');
      }

      const newHeight = await page.evaluate(() => {
        const bodyHeight = document.body?.scrollHeight || 0;
        const htmlHeight = document.documentElement?.scrollHeight || 0;
        return Math.max(bodyHeight, htmlHeight);
      });

      console.log(`Scroll ${scrollAttempts + 1}: Height ${previousHeight} -> ${newHeight}`);

      if (newHeight === previousHeight) {
        console.log('No new content loaded, stopping scroll');
        break;
      }

      previousHeight = newHeight;
      scrollAttempts++;
    } catch (error: any) {
      console.error(`Scroll attempt ${scrollAttempts + 1} failed:`, error.message);
      break;
    }
  }

  console.log(`Completed scrolling after ${scrollAttempts} attempts`);

  // Add page stability check
  await page.waitForFunction(
    () => {
      return document.readyState === 'complete' && document.body !== null && document.body.children.length > 0;
    },
    { timeout: 30000 }
  );

  console.log('✅ Page is stable, proceeding with button scan...');

  const initialScan = await page.evaluate(() => {
    // Add additional safety checks
    if (!document || !document.body || !document.querySelectorAll) {
      return { totalFound: 0, buttons: [] };
    }

    const seeAdDetailsButtons: { index: number; buttonText: string }[] = [];
    const allButtonDivs = document.querySelectorAll('div[role="button"]');

    Array.from(allButtonDivs).forEach((buttonDiv, index) => {
      try {
        const allDescendantDivs = buttonDiv.querySelectorAll('div');
        const hasSeAdDetails = Array.from(allDescendantDivs).some(
          (div) => div.textContent && (div.textContent.trim() === 'See ad details' || div.textContent.trim() === 'Voir les détails de la publicité')
        );

        const selfHasText =
          buttonDiv.textContent &&
          (buttonDiv.textContent.includes('See ad details') || buttonDiv.textContent.includes('Voir les détails de la publicité'));

        if (hasSeAdDetails || selfHasText) {
          seeAdDetailsButtons.push({
            index: index,
            buttonText: buttonDiv.textContent?.trim() || '',
          });
        }
      } catch (error: any) {
        console.log('Error processing button:', error.message);
      }
    });

    return {
      totalFound: seeAdDetailsButtons.length,
      buttons: seeAdDetailsButtons,
    };
  });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log(`Found ${initialScan.totalFound} "See ad details" buttons`);
  console.log(`Will process ${Math.min(MAX_ITERATIONS, initialScan.totalFound)} buttons`);

  const clickResults: {
    iteration: number;
    seeAdDetailsClicked: any;
    transparencyLinkResult: any;
    extractedData: any;
    closeButtonResult: any;
    success: boolean;
  }[] = [];

  for (let i = 0; i < Math.min(MAX_ITERATIONS, initialScan.totalFound); i++) {
    console.log(`Processing button ${i + 1}/${Math.min(MAX_ITERATIONS, initialScan.totalFound)}`);

    try {
      // Check if page is still valid before each iteration
      if (page.isClosed()) {
        throw new Error('Page was closed');
      }

      // Wait longer and ensure page is completely stable (with randomness)
      const stabilityDelay = 500 + Math.random() * 500; // 0.5-1 seconds
      await new Promise((resolve) => setTimeout(resolve, stabilityDelay));

      // More robust page stability check
      const isPageStable = await page.evaluate(() => {
        return (
          document.readyState === 'complete' &&
          document.body !== null &&
          document.body.children.length > 0 &&
          typeof document.querySelectorAll === 'function'
        );
      });

      if (!isPageStable) {
        throw new Error('Page is not stable');
      }

      // Additional check to ensure we can access the DOM
      const canAccessDOM = await page.evaluate(() => {
        try {
          document.querySelectorAll('div');
          return true;
        } catch (error) {
          return false;
        }
      });

      if (!canAccessDOM) {
        throw new Error('Cannot access DOM');
      }

      const clickResult = await page.evaluate((buttonIndex) => {
        try {
          // Add safety checks
          if (!document || !document.querySelectorAll) {
            return null;
          }

          const allButtonDivs = document.querySelectorAll('div[role="button"]');
          let clickedButton = null;
          let currentIndex = 0;

          for (let buttonDiv of Array.from(allButtonDivs)) {
            try {
              const allDescendantDivs = buttonDiv.querySelectorAll('div');
              const hasSeAdDetails = Array.from(allDescendantDivs).some(
                (div) =>
                  div.textContent && (div.textContent.trim() === 'See ad details' || div.textContent.trim() === 'Voir les détails de la publicité')
              );

              const selfHasText =
                buttonDiv.textContent &&
                (buttonDiv.textContent.includes('See ad details') || buttonDiv.textContent.includes('Voir les détails de la publicité'));

              if (hasSeAdDetails || selfHasText) {
                if (currentIndex === buttonIndex) {
                  (buttonDiv as HTMLElement).click();
                  clickedButton = {
                    text: buttonDiv.textContent?.trim() || '',
                    clicked: true,
                  };
                  break;
                }
                currentIndex++;
              }
            } catch (innerError: any) {
              console.log('Error processing individual button:', innerError.message);
            }
          }

          return clickedButton;
        } catch (error: any) {
          console.log('Error in click evaluation:', error.message);
          return null;
        }
      }, i);

      if (!clickResult) {
        clickResults.push({
          iteration: i + 1,
          seeAdDetailsClicked: null,
          transparencyLinkResult: null,
          extractedData: null,
          closeButtonResult: null,
          success: false,
        });
        continue;
      }

      console.log(`Waiting with human-like delays for modal to load...`);

      // Add random delay to appear more human (2-5 seconds)
      const randomDelay = 500 + Math.random() * 500;
      console.log(`Using random delay: ${Math.round(randomDelay)}ms`);

      // Monitor network requests during modal loading
      const networkRequests: any[] = [];
      const requestListener = (request: any) => {
        if (request.url().includes('facebook.com') || request.url().includes('fbcdn.net')) {
          networkRequests.push({
            url: request.url(),
            method: request.method(),
            resourceType: request.resourceType(),
          });
        }
      };

      const responseListener = (response: any) => {
        if (response.url().includes('facebook.com') || response.url().includes('fbcdn.net')) {
          console.log(`📡 Network: ${response.status()} ${response.url().substring(0, 100)}...`);
        }
      };

      page.on('request', requestListener);
      page.on('response', responseListener);

      await new Promise((resolve) => setTimeout(resolve, randomDelay));

      // Stop monitoring and report
      page.off('request', requestListener);
      page.off('response', responseListener);

      console.log(`📊 Network requests during modal load: ${networkRequests.length}`);
      if (networkRequests.length > 0) {
        console.log('🔗 Request types:', networkRequests.map((r) => r.resourceType).join(', '));
      }

      // Simulate human interaction with the modal to avoid detection
      console.log('🎭 Simulating human interaction with modal...');
      try {
        await page.evaluate(() => {
          const modal = document.querySelector('div[role="dialog"]');
          if (modal) {
            // Simulate reading behavior - slow scroll through modal
            let scrollAmount = 0;
            const scrollInterval = setInterval(() => {
              scrollAmount += 50;
              modal.scrollTop = scrollAmount;

              if (scrollAmount > 200) {
                clearInterval(scrollInterval);
                // Scroll back to top
                modal.scrollTop = 0;
              }
            }, 200);

            // Add subtle mouse movements within modal
            const rect = modal.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Simulate hovering over different parts of the modal
            ['mousemove', 'mouseenter'].forEach((eventType) => {
              const event = new MouseEvent(eventType, {
                clientX: centerX + (Math.random() - 0.5) * 100,
                clientY: centerY + (Math.random() - 0.5) * 100,
                bubbles: true,
              });
              modal.dispatchEvent(event);
            });
          }
        });

        // Wait for "reading" time
        await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
        console.log('✅ Human interaction simulation completed');
      } catch (humanError: any) {
        console.log('⚠️ Human interaction simulation failed:', humanError.message);
      }

      // console.log('📸 Taking screenshot for debugging...');
      // try {
      //   const screenshotBuffer = await page.screenshot({
      //     fullPage: true,
      //   });
      //   console.log(`Screenshot taken (${screenshotBuffer.length} bytes)`);

      //   // Write screenshot to disk in /tmp (has write permissions)
      //   const fs = require('fs');
      //   const screenshotPath = `/tmp/modal_debug_${Date.now()}.png`;
      //   fs.writeFileSync(screenshotPath, screenshotBuffer);
      //   console.log(`Screenshot saved to: ${screenshotPath}`);
      // } catch (screenshotError: any) {
      //   console.error('Failed to take screenshot:', screenshotError.message);
      // }

      console.log(`Looking for European Union transparency link...`);
      let extractedData = null;

      // Debug: Comprehensive modal analysis
      const modalDebugInfo = await page.evaluate(() => {
        const dialogs = document.querySelectorAll('div[role="dialog"]');
        const debugInfo = [];

        for (let i = 0; i < dialogs.length; i++) {
          const dialog = dialogs[i];

          // Check for loading indicators
          const loadingElements = dialog.querySelectorAll('[data-testid*="loading"], .loading, [aria-busy="true"]');

          // Check for error messages
          const errorElements = dialog.querySelectorAll('[data-testid*="error"], .error-message');

          // Check for network requests indicators
          const networkElements = dialog.querySelectorAll('img[src*="static"], script[src*="static"]');

          debugInfo.push({
            index: i,
            innerHTML: dialog.innerHTML.substring(0, 1000), // More content
            textContent: dialog.textContent?.substring(0, 500), // More text
            childrenCount: dialog.children.length,
            hasContent: dialog.textContent && dialog.textContent.trim().length > 0,
            loadingIndicators: loadingElements.length,
            errorIndicators: errorElements.length,
            networkElements: networkElements.length,
            classNames: dialog.className,
            attributes: Array.from(dialog.attributes).map((attr) => `${attr.name}="${attr.value}"`),
          });
        }

        return {
          dialogsFound: dialogs.length,
          dialogsInfo: debugInfo,
          pageTitle: document.title,
          pageUrl: window.location.href,
          jsErrors: window.console ? 'Console available' : 'No console',
          userAgent: navigator.userAgent,
        };
      });

      // console.log('🔍 Modal debug info:', JSON.stringify(modalDebugInfo, null, 2));

      // If modal is empty, try to force content loading
      if (modalDebugInfo.dialogsFound > 0 && modalDebugInfo.dialogsInfo[0] && !modalDebugInfo.dialogsInfo[0].hasContent) {
        console.log('🔄 Modal appears empty, attempting to force content loading...');

        try {
          await page.evaluate(() => {
            const dialog = document.querySelector('div[role="dialog"]');
            if (dialog) {
              // Try to trigger various events that might cause content to load
              ['focus', 'mouseover', 'mouseenter', 'click'].forEach((eventType) => {
                const event = new Event(eventType, { bubbles: true });
                dialog.dispatchEvent(event);
              });

              // Try scrolling within the modal
              dialog.scrollTop = 10;
              dialog.scrollTop = 0;

              // Try to find and click any refresh/reload buttons
              const refreshButtons = dialog.querySelectorAll(
                '[aria-label*="refresh"], [aria-label*="reload"], [title*="refresh"], [title*="reload"]'
              );
              refreshButtons.forEach((btn) => {
                if (btn instanceof HTMLElement) {
                  btn.click();
                }
              });
            }
          });

          // Wait after attempting to trigger content
          await new Promise((resolve) => setTimeout(resolve, 1000));
          console.log('✅ Content loading triggers attempted');
        } catch (triggerError: any) {
          console.log('⚠️ Failed to trigger content loading:', triggerError.message);
        }
      }

      const transparencyResult = await page.evaluate(() => {
        const allLinkDivs = document.querySelectorAll('[role="link"]');
        let transparencyLink = null;
        let textContents: (string | undefined)[] = [];

        for (let linkDiv of Array.from(allLinkDivs)) {
          const allDescendantDivs = linkDiv.querySelectorAll('div');
          textContents = Array.from(allDescendantDivs).map((div) => div.textContent?.trim());

          const hasTransparencyText = Array.from(allDescendantDivs).some(
            (div) =>
              div.textContent &&
              (div.textContent.trim() === 'European Union transparency' ||
                div.textContent.trim() === 'Transparency by location' ||
                div.textContent.trim() === 'Transparence de l’Union européenne' ||
                div.textContent.trim() === 'Transparence par lieu')
          );

          const selfHasText =
            linkDiv.textContent &&
            (linkDiv.textContent.includes('European Union transparency') || linkDiv.textContent.includes('Transparence de l’Union européenne'));

          if (hasTransparencyText || selfHasText) {
            transparencyLink = linkDiv;
            break;
          }
        }

        if (!transparencyLink) {
          return { found: false, error: 'European Union transparency link not found', textContents, linkDivsLength: Array.from(allLinkDivs).length };
        }

        (transparencyLink as HTMLElement).click();
        return {
          found: true,
          clicked: true,
          transparencyText: transparencyLink.textContent?.trim(),
          textContents,
          linkDivsLength: Array.from(allLinkDivs).length,
        };
      });

      // const adBuyerResult = await page.evaluate(() => {
      //   const allLinkDivs = document.querySelectorAll('div[role="link"]');
      //   let adBuyerLink = null;

      //   for (let linkDiv of Array.from(allLinkDivs)) {
      //     const allDescendantDivs = linkDiv.querySelectorAll('div');
      //     const hasAdBuyerText = Array.from(allDescendantDivs).some(
      //       (div) =>
      //         div.textContent &&
      //         (div.textContent.trim() === 'About the advertiser' || div.textContent.trim() === 'À propos de l'annonceur')
      //     );

      //     const selfHasText =
      //       linkDiv.textContent &&
      //       (linkDiv.textContent.includes('About the advertiser') || linkDiv.textContent.includes('À propos de l'annonceur'));

      //     if (hasAdBuyerText || selfHasText) {
      //       adBuyerLink = linkDiv;
      //       break;
      //     }
      //   }

      //   if (!adBuyerLink) {
      //     return { found: false, error: 'Ad buyer link not found' };
      //   }

      //   adBuyerLink.click();
      //   return { found: true, clicked: true, adBuyerText: adBuyerLink.textContent?.trim() };
      // });

      console.log(`Transparency result:`, transparencyResult);
      // console.log(`Ad buyer result:`, adBuyerResult);

      if (transparencyResult.found) {
        console.log(`European Union transparency link clicked, waiting 1 second...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // Add page stability check
        console.log(`Waiting page to stabilize...`);
        await page.waitForFunction(
          () => {
            return document.readyState === 'complete' && document.body !== null && document.body.children.length > 0;
          },
          { timeout: 30000 }
        );
        console.log(`✅ Page is stable, proceeding with data extraction...`);

        extractedData = await page.evaluate(() => {
          const headingDivs = document.querySelectorAll('div[role="heading"]');
          let headingTexts = [];
          for (let headingDiv of Array.from(headingDivs)) {
            const headingText = headingDiv.textContent?.trim();
            headingTexts.push(headingText);
            if (!headingText || (!headingText.includes('Reach') && !headingText.includes('Couverture'))) {
              continue;
            }

            const parent = headingDiv.parentElement;
            if (parent) {
              const nextSibling = parent.nextElementSibling;
              if (nextSibling) {
                const text = nextSibling.textContent?.trim();
                if (text) {
                  let adId = null;
                  let divWithAdId = null;
                  let adDate = null;
                  let nickname = null;
                  let treeDotsFound = false;
                  let treeDotsSiblingFound = false;
                  let treeDotsParentFound = false;
                  const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));

                  for (const dialog of dialogs) {
                    const allDialogDivs = dialog.querySelectorAll('div');
                    for (const div of allDialogDivs) {
                      const span = div.querySelector('span');
                      const hasAdId =
                        span && span.textContent && (span.textContent.includes('Library ID') || span.textContent.includes('ID dans la bibliothèque'));
                      if (hasAdId) {
                        adId = span.textContent?.match(/\d+/)?.[0];
                        divWithAdId = div;
                        break;
                      }
                    }

                    const threeDots = dialog.querySelector('[aria-haspopup="menu"]');
                    if (threeDots) {
                      treeDotsFound = true;
                    }
                    if (threeDots) {
                      const threeDotsParent = threeDots.parentElement;
                      if (threeDotsParent) {
                        treeDotsParentFound = true;
                      }
                      const threeDotsPreviousSibling = threeDotsParent?.previousElementSibling;
                      if (threeDotsPreviousSibling) {
                        treeDotsSiblingFound = true;
                      }
                    }

                    if (adId && nickname) {
                      break;
                    }
                  }

                  if (divWithAdId) {
                    const dateDiv = divWithAdId.nextElementSibling;
                    if (dateDiv) {
                      adDate = dateDiv.textContent?.trim();
                    }
                  }

                  return {
                    found: true,
                    data: text,
                    headingText: headingText,
                    adId,
                    adDate,
                    nickname,
                    treeDotsFound,
                    treeDotsParentFound,
                    treeDotsSiblingFound,
                  };
                }
              }
            }
          }

          return {
            found: false,
            error: 'Could not find heading with "Reach" text or sibling data',
            headingDivsNumber: headingDivs.length,
            headingTexts: headingTexts,
          };
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        console.log(`Data extraction result:`, extractedData);
      } else {
        console.log(`European Union transparency link not found`);
      }

      const closeResult = await page.evaluate(() => {
        const allButtonDivs = document.querySelectorAll('div[role="button"]');

        for (let buttonDiv of allButtonDivs) {
          const allDescendantDivs = buttonDiv.querySelectorAll('div');
          const hasCloseText = Array.from(allDescendantDivs).some(
            (div) => div.textContent && (div.textContent.trim() === 'Close' || div.textContent.trim() === 'Fermer')
          );

          const selfHasClose = buttonDiv.textContent && (buttonDiv.textContent.includes('Close') || buttonDiv.textContent.includes('Fermer'));

          if (hasCloseText || selfHasClose) {
            (buttonDiv as HTMLElement).click();
            return {
              found: true,
              text: buttonDiv.textContent?.trim() || '',
            };
          }
        }

        return { found: false };
      });

      console.log(`Close result:`, closeResult);

      if (closeResult.found) {
        console.log(`Close button clicked, waiting 1 second...`);
      } else {
        console.log(`Close button not found`);
      }

      console.log(`Waiting 1 seconds for page to stabilize...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Add page stability check
      await page.waitForFunction(
        () => {
          return document.readyState === 'complete' && document.body !== null && document.body.children.length > 0;
        },
        { timeout: 30000 }
      );

      clickResults.push({
        iteration: i + 1,
        seeAdDetailsClicked: clickResult,
        transparencyLinkResult: transparencyResult,
        extractedData: extractedData,
        closeButtonResult: closeResult,
        success: closeResult.found,
      });

      console.log(`✅ Iteration ${i + 1} completed successfully`);
    } catch (error: any) {
      console.error(`Error in iteration ${i + 1}:`, error.message);
      clickResults.push({
        iteration: i + 1,
        seeAdDetailsClicked: null,
        transparencyLinkResult: null,
        extractedData: null,
        closeButtonResult: null,
        success: false,
      });
    }
  }

  const extractedTransparencyData = clickResults
    .filter((result) => result.extractedData && result.extractedData.found)
    .map((result, index) => ({
      adIndex: result.iteration,
      adId: result.extractedData.adId,
      adDate: result.extractedData.adDate,
      nickname: result.extractedData.nickname,
      data: result.extractedData.data,
      headingText: result.extractedData.headingText,
    }));

  return {
    maxIterations: MAX_ITERATIONS,
    totalButtonsFound: initialScan.totalFound,
    processedButtons: clickResults.length,
    clickResults: clickResults,
    successfulClicks: clickResults.filter((r) => r.success).length,
    extractedTransparencyData: extractedTransparencyData,
    totalDataExtracted: extractedTransparencyData.length,
  };
}

scrapAdsRouter.get('/', tokenAuth, async (req: Request, res: Response) => {
  const page_id = req.query.page_id as string;

  if (!page_id) {
    const response = ServiceResponse.failure('Page ID is required', null, StatusCodes.BAD_REQUEST);
    res.status(response.statusCode).send(response);
    return;
  }

  const scraper = new SimpleScraper({
    headless: false,
    timeout: 30000,
    useFreeProxies: false,
  });

  try {
    await scraper.init();
    if (!scraper.page) {
      const response = ServiceResponse.failure('Page not initialized', null, StatusCodes.INTERNAL_SERVER_ERROR);
      res.status(response.statusCode).send(response);
      return;
    }

    // Then navigate to ads library
    console.log('📚 Navigating to ads library...');
    await scraper.page.goto(
      `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=FR&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${page_id}`,
      { waitUntil: 'networkidle2' }
    );

    // Additional wait after reaching target page
    const postNavigationWait = 5000 + Math.random() * 3000;
    console.log(`⏳ Post-navigation wait: ${Math.round(postNavigationWait)}ms`);
    await new Promise((resolve) => setTimeout(resolve, postNavigationWait));

    const result = await myScrapingLogic(scraper.page);

    // Save cookies for future sessions to maintain warm state
    const savedCookies = await scraper.saveCookies();
    if (savedCookies.length > 0) {
      // In a real implementation, you'd save these to a database or file
      console.log('🍪 Session cookies saved for future use');
    }

    console.log('📊 Test Results:');
    console.log(JSON.stringify(result, null, 2));
    await scraper.close();
    const response = ServiceResponse.success('success', result);
    res.status(response.statusCode).send(response);
  } catch (error: any) {
    await scraper.close();
    console.error('❌ Test failed:', error.message);
    const response = ServiceResponse.failure('Error', null, StatusCodes.INTERNAL_SERVER_ERROR);
    res.status(response.statusCode).send(response);
  }
});
