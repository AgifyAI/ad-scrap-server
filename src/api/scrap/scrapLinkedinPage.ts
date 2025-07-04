import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';

import { createApiResponse } from '@/api-docs/openAPIResponseBuilders';
import { SimpleScraper } from '@/common/utils/scrapper';
import { ServiceResponse } from '@/common/models/serviceResponse';
import { StatusCodes } from 'http-status-codes';
import { Page } from 'puppeteer';
import { tokenAuth } from '@/common/middleware/tokenAuth';

export const scrapLinkedinPageRegistry = new OpenAPIRegistry();
export const scrapLinkedinPageRouter: Router = express.Router();

scrapLinkedinPageRegistry.registerPath({
  method: 'get',
  path: '/lkd',
  tags: ['Scrap Linkedin Page'],
  responses: createApiResponse(z.null(), 'Success'),
});

async function myScrapingLogic(page: Page): Promise<any> {
  const MAX_ITERATIONS = 4000;

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
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Simulate normal browsing behavior to avoid rate limiting
  console.log('🎭 Simulating normal browsing behavior...');

  // Random browsing simulation (scroll, wait, hover)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      // Random scroll
      const scrollHeight = Math.random() * document.body.scrollHeight * 0.3;
      window.scrollTo(0, scrollHeight);
    });

    // Random wait between 1-2 seconds
    const waitTime = 1000 + Math.random() * 1000;
    console.log(`🕐 Browsing simulation ${i + 1}/3 - waiting ${Math.round(waitTime)}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  console.log('✅ Browsing simulation completed');

  console.log('📄 Current URL:', await page.url());
  console.log('📄 Page title:', await page.title());

  // Add page stability check
  await page.waitForFunction(
    () => {
      return document.readyState === 'complete' && document.body !== null && document.body.children.length > 0;
    },
    { timeout: 30000 }
  );

  console.log('✅ Page is stable, proceeding with button scan...');

  return {
    message: 'success',
  };
}

scrapLinkedinPageRouter.get('/lkd', tokenAuth, async (req: Request, res: Response) => {
  const page_url = req.query.page_url as string;

  if (!page_url) {
    const response = ServiceResponse.failure('Page URL is required', null, StatusCodes.BAD_REQUEST);
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

    // Then navigate to linkedin page
    console.log('📚 Navigating to linkedin page...');
    await scraper.page.goto(page_url, { waitUntil: 'networkidle2' });

    // Additional wait after reaching target page
    const postNavigationWait = 1000 + Math.random() * 1000;
    console.log(`⏳ Post-navigation wait: ${Math.round(postNavigationWait)}ms`);
    await new Promise((resolve) => setTimeout(resolve, postNavigationWait));

    const result = await myScrapingLogic(scraper.page);

    console.log('📊 Results:');
    console.log(JSON.stringify(result, null, 2));
    await scraper.close();
    const response = ServiceResponse.success('success', result);
    res.status(response.statusCode).send(response);
  } catch (error: any) {
    await scraper.close();
    console.error('❌ Failed:', error.message);
    const response = ServiceResponse.failure('Error', null, StatusCodes.INTERNAL_SERVER_ERROR);
    res.status(response.statusCode).send(response);
  }
});
