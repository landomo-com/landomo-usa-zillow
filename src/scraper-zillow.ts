/**
 * Zillow Scraper - USA
 *
 * Uses Playwright to intercept API calls and extract property data
 *
 * Key Features:
 * - Intercepts Zillow's internal API calls (__NEXT_DATA__)
 * - Extracts listings from search results
 * - Handles PerimeterX bot detection
 * - Supports for_sale, for_rent, and sold listings
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { logger } from './logger';
import { config } from './config';
import { getRandomUserAgent } from './user-agents';
import { sleep } from './utils';

export interface ZillowRawListing {
  zpid: string | number;
  address?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  price?: number;
  unformattedPrice?: number;
  beds?: number;
  bedrooms?: number;
  baths?: number;
  bathrooms?: number;
  area?: number;
  livingArea?: number;
  lotAreaValue?: number;
  lotSize?: number;
  yearBuilt?: number;
  homeType?: string;
  propertyType?: string;
  listingStatus?: string;
  statusType?: string;
  latLong?: { latitude: number; longitude: number };
  latitude?: number;
  longitude?: number;
  zestimate?: number;
  rentZestimate?: number;
  imgSrc?: string;
  detailUrl?: string;
  daysOnZillow?: number;
  description?: string;
  agentName?: string;
  brokerName?: string;
  features?: string[];
  homeStatus?: string;
  virtualTourUrl?: string;
  priceHistory?: Array<{ date: string; price: number; event: string }>;
}

export interface ZillowSearchParams {
  city: string;
  state: string;
  listingType?: 'for_sale' | 'for_rent' | 'sold';
  page?: number;
}

export class ZillowScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async init(): Promise<void> {
    logger.info('Initializing Zillow scraper');

    this.browser = await chromium.launch({
      headless: config.HEADLESS,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    this.context = await this.browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    // Apply stealth scripts
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    logger.info('Zillow scraper initialized');
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    logger.info('Zillow scraper closed');
  }

  /**
   * Extract listings from __NEXT_DATA__ script tag
   */
  private async extractFromNextData(page: Page): Promise<ZillowRawListing[]> {
    try {
      const listings: ZillowRawListing[] = [];

      const nextData = await page.evaluate(() => {
        const script = document.querySelector('script#__NEXT_DATA__');
        if (script && script.textContent) {
          try {
            return JSON.parse(script.textContent);
          } catch {
            return null;
          }
        }
        return null;
      });

      if (!nextData) {
        logger.warn('No __NEXT_DATA__ found on page');
        return listings;
      }

      // Navigate the Next.js data structure
      const searchResults =
        nextData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults || [];

      for (const result of searchResults) {
        const listing: ZillowRawListing = {
          zpid: result.zpid?.toString() || result.id?.toString() || '',
          address: result.address || result.streetAddress || '',
          city: result.addressCity || result.city || '',
          state: result.addressState || result.state || '',
          zipcode: result.addressZipcode || result.zipcode || '',
          price: result.price || result.unformattedPrice || 0,
          beds: result.beds || 0,
          baths: result.baths || 0,
          area: result.area || result.livingArea || 0,
          lotAreaValue: result.lotAreaValue,
          yearBuilt: result.yearBuilt,
          homeType: result.homeType || result.propertyType || 'unknown',
          listingStatus: result.listingStatus || result.statusType || 'unknown',
          latitude: result.latLong?.latitude || result.latitude || 0,
          longitude: result.latLong?.longitude || result.longitude || 0,
          zestimate: result.zestimate,
          rentZestimate: result.rentZestimate,
          imgSrc: result.imgSrc || result.image,
          detailUrl: result.detailUrl || `https://www.zillow.com/homedetails/${result.zpid}_zpid/`,
          daysOnZillow: result.daysOnZillow,
          description: result.description || result.shortDescription,
          agentName: result.agentName,
          brokerName: result.brokerName,
          features: result.features || [],
          homeStatus: result.homeStatus,
          virtualTourUrl: result.virtualTourUrl,
        };

        listings.push(listing);
      }

      logger.info(`Extracted ${listings.length} listings from __NEXT_DATA__`);
      return listings;
    } catch (error) {
      logger.error('Failed to extract from __NEXT_DATA__', { error });
      return [];
    }
  }

  /**
   * Search for listings in a specific location
   */
  async searchLocation(params: ZillowSearchParams): Promise<ZillowRawListing[]> {
    if (!this.context) throw new Error('Browser not initialized');

    const { city, state, listingType = 'for_sale', page = 1 } = params;
    const locationName = `${city}, ${state}`;

    logger.info('Searching location', { locationName, listingType, page });

    const browserPage = await this.context.newPage();

    try {
      // Build search URL
      const searchPath = listingType === 'for_rent'
        ? `${city.replace(/\s+/g, '-').toLowerCase()}-${state.toLowerCase()}-rentals/`
        : listingType === 'sold'
        ? `${city.replace(/\s+/g, '-').toLowerCase()}-${state.toLowerCase()}/sold/`
        : `${city.replace(/\s+/g, '-').toLowerCase()}-${state.toLowerCase()}/`;

      const pageParam = page > 1 ? `${page}_p/` : '';
      const url = `${config.BASE_URL}/${searchPath}${pageParam}`;

      logger.info('Navigating to URL', { url });

      await browserPage.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.NAVIGATION_TIMEOUT,
      });

      // Wait for content to load
      await sleep(3000);

      // Handle cookie consent
      try {
        const acceptBtn = browserPage.locator('button:has-text("Accept")').first();
        if (await acceptBtn.isVisible({ timeout: 2000 })) {
          await acceptBtn.click();
          await sleep(1000);
        }
      } catch {
        // No cookie banner
      }

      // Check for CAPTCHA/blocking
      const pageContent = await browserPage.content();
      if (pageContent.includes('captcha') || pageContent.includes('blocked')) {
        logger.warn('Possible CAPTCHA detected', { locationName });
        return [];
      }

      // Extract listings
      const listings = await this.extractFromNextData(browserPage);
      logger.info(`Found ${listings.length} listings`, { locationName });

      return listings;

    } catch (error) {
      logger.error('Failed to search location', { locationName, error });
      return [];
    } finally {
      await browserPage.close();
    }
  }

  /**
   * Get detailed property information by ZPID
   */
  async getPropertyDetails(zpid: string): Promise<any> {
    if (!this.context) throw new Error('Browser not initialized');

    const page = await this.context.newPage();

    try {
      const url = `https://www.zillow.com/homedetails/${zpid}_zpid/`;
      logger.info('Getting property details', { zpid });

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.NAVIGATION_TIMEOUT,
      });

      await sleep(2000);

      // Extract detailed data from __NEXT_DATA__
      const details = await page.evaluate(() => {
        const script = document.querySelector('script#__NEXT_DATA__');
        if (script) {
          try {
            const data = JSON.parse(script.textContent || '{}');
            return data?.props?.pageProps?.initialReduxState?.gdp?.building ||
                   data?.props?.pageProps?.componentProps?.gdpClientCache ||
                   data;
          } catch {
            return null;
          }
        }
        return null;
      });

      return details;

    } catch (error) {
      logger.error('Failed to get property details', { zpid, error });
      return null;
    } finally {
      await page.close();
    }
  }
}
