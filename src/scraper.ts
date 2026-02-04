import { createLogger } from './logger';
/**
 * Zillow Scraper - Uses Playwright to intercept API calls
 *
 * Based on APK analysis, Zillow uses:
 * - Base URL: https://zm.zillow.com/web-services/
 * - GraphQL Federation for data
 * - PerimeterX for bot detection
 *
 * Key endpoints discovered:
 * - /web-services/GetZRectResults2 - Map search with geo-bounding box
 * - /web-services/HomeLookup - Single property details
 * - /web-services/HomeLookupList - Multiple properties by ZPID
 * - /web-services/LocationLookup - Location autocomplete
 */

import { chromium, Browser, BrowserContext, Page, Route, Request } from 'playwright';

// US locations for scraping
const US_LOCATIONS = [
  { city: 'New York', lat: 40.7128, lon: -74.0060 },
  { city: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { city: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { city: 'Houston', lat: 29.7604, lon: -95.3698 },
  { city: 'Phoenix', lat: 33.4484, lon: -112.0740 },
  { city: 'Miami', lat: 25.7617, lon: -80.1918 },
  { city: 'Seattle', lat: 47.6062, lon: -122.3321 },
  { city: 'Denver', lat: 39.7392, lon: -104.9903 },
  { city: 'Austin', lat: 30.2672, lon: -97.7431 },
  { city: 'San Francisco', lat: 37.7749, lon: -122.4194 },
];

interface ZillowListing {
  zpid: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  livingArea: number;
  lotSize?: number;
  yearBuilt?: number;
  homeType: string;
  listingStatus: string;
  latitude: number;
  longitude: number;
  zestimate?: number;
  rentZestimate?: number;
  imageUrl?: string;
  detailUrl: string;
  daysOnZillow?: number;
  priceHistory?: Array<{ date: string; price: number; event: string }>;
}

interface InterceptedApiCall {
  url: string;
  method: string;
  requestBody?: any;
  responseBody?: any;
  timestamp: Date;
}

export class ZillowScraper {
  private logger = createLogger(this.constructor.name);
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private interceptedCalls: InterceptedApiCall[] = [];

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    // Apply stealth scripts
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }

  /**
   * Intercept and log all API calls
   */
  private async setupApiInterception(page: Page): Promise<void> {
    // Intercept requests to Zillow API endpoints
    await page.route('**/*', async (route: Route, request: Request) => {
      const url = request.url();

      // Log interesting API calls
      if (url.includes('zm.zillow.com') ||
          url.includes('/web-services/') ||
          url.includes('api/') ||
          url.includes('graphql') ||
          url.includes('async-create-search-page-state')) {

        const call: InterceptedApiCall = {
          url,
          method: request.method(),
          timestamp: new Date(),
        };

        // Capture POST body
        if (request.method() === 'POST') {
          try {
            call.requestBody = request.postData();
          } catch (e) {
            // Ignore
          }
        }

        this.interceptedCalls.push(call);
        this.logger.info(`[API] ${request.method()} ${url.substring(0, 100)}...`);
      }

      await route.continue();
    });

    // Intercept responses
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('zm.zillow.com') ||
          url.includes('/web-services/') ||
          url.includes('async-create-search-page-state')) {
        try {
          const body = await response.json();
          const call = this.interceptedCalls.find(c => c.url === url && !c.responseBody);
          if (call) {
            call.responseBody = body;
          }
        } catch (e) {
          // Not JSON response
        }
      }
    });
  }

  /**
   * Extract listings from __NEXT_DATA__ script tag
   */
  private async extractListingsFromPage(page: Page): Promise<ZillowListing[]> {
    const listings: ZillowListing[] = [];

    try {
      // Try to get data from __NEXT_DATA__ script
      const nextData = await page.evaluate(() => {
        const script = document.querySelector('script#__NEXT_DATA__');
        if (script) {
          try {
            return JSON.parse(script.textContent || '{}');
          } catch {
            return null;
          }
        }
        return null;
      });

      if (nextData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults) {
        const results = nextData.props.pageProps.searchPageState.cat1.searchResults.listResults;

        for (const result of results) {
          listings.push({
            zpid: result.zpid?.toString() || result.id?.toString() || '',
            address: result.address || result.streetAddress || '',
            city: result.addressCity || '',
            state: result.addressState || '',
            zipcode: result.addressZipcode || '',
            price: result.price || result.unformattedPrice || 0,
            bedrooms: result.beds || 0,
            bathrooms: result.baths || 0,
            livingArea: result.area || result.livingArea || 0,
            lotSize: result.lotAreaValue,
            yearBuilt: result.yearBuilt,
            homeType: result.homeType || result.propertyType || 'unknown',
            listingStatus: result.listingStatus || result.statusType || 'unknown',
            latitude: result.latLong?.latitude || result.latitude || 0,
            longitude: result.latLong?.longitude || result.longitude || 0,
            zestimate: result.zestimate,
            rentZestimate: result.rentZestimate,
            imageUrl: result.imgSrc || result.image,
            detailUrl: result.detailUrl || `https://www.zillow.com/homedetails/${result.zpid}_zpid/`,
            daysOnZillow: result.daysOnZillow,
          });
        }
      }

      // Also try Apollo cache data
      const apolloData = await page.evaluate(() => {
        const script = document.querySelector('script#hdpApolloPreloadedData');
        if (script) {
          try {
            return JSON.parse(script.textContent || '{}');
          } catch {
            return null;
          }
        }
        return null;
      });

      if (apolloData) {
        this.logger.info('[DEBUG] Found Apollo cache data');
        // Parse Apollo cache format if available
      }

    } catch (e) {
      this.logger.error('[ERROR] Failed to extract listings:', e);
    }

    return listings;
  }

  /**
   * Search for listings in a specific location
   */
  async searchLocation(location: string, listingType: 'for_sale' | 'for_rent' | 'sold' = 'for_sale'): Promise<ZillowListing[]> {
    if (!this.context) throw new Error('Browser not initialized');

    const page = await this.context.newPage();
    await this.setupApiInterception(page);

    try {
      // Build search URL
      const searchPath = listingType === 'for_rent'
        ? `${location.replace(/\s+/g, '-').toLowerCase()}-rentals/`
        : listingType === 'sold'
        ? `${location.replace(/\s+/g, '-').toLowerCase()}/sold/`
        : `${location.replace(/\s+/g, '-').toLowerCase()}/`;

      const url = `https://www.zillow.com/${searchPath}`;
      this.logger.info(`[SCRAPE] Navigating to: ${url}`);

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      // Wait for results to load
      await page.waitForTimeout(3000);

      // Handle cookie consent
      try {
        const acceptBtn = page.locator('button:has-text("Accept")').first();
        if (await acceptBtn.isVisible({ timeout: 2000 })) {
          await acceptBtn.click();
          await page.waitForTimeout(1000);
        }
      } catch {
        // No cookie banner
      }

      // Check for CAPTCHA/blocking
      const pageContent = await page.content();
      if (pageContent.includes('captcha') || pageContent.includes('blocked')) {
        this.logger.warn('[WARN] Possible CAPTCHA detected');
      }

      // Extract listings
      const listings = await this.extractListingsFromPage(page);
      this.logger.info(`[SCRAPE] Found ${listings.length} listings for ${location}`);

      return listings;

    } finally {
      await page.close();
    }
  }

  /**
   * Get detailed property information by ZPID
   */
  async getPropertyDetails(zpid: string): Promise<any> {
    if (!this.context) throw new Error('Browser not initialized');

    const page = await this.context.newPage();
    await this.setupApiInterception(page);

    try {
      const url = `https://www.zillow.com/homedetails/${zpid}_zpid/`;
      this.logger.info(`[SCRAPE] Getting details for ZPID: ${zpid}`);

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      await page.waitForTimeout(2000);

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

    } finally {
      await page.close();
    }
  }

  /**
   * Get all intercepted API calls for analysis
   */
  getInterceptedCalls(): InterceptedApiCall[] {
    return this.interceptedCalls;
  }

  /**
   * Test the discovered API endpoints directly
   */
  async testApiEndpoint(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    if (!this.context) throw new Error('Browser not initialized');

    const page = await this.context.newPage();

    try {
      // Build URL with params
      const url = new URL(endpoint, 'https://zm.zillow.com');
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

      this.logger.info(`[API TEST] ${url.toString()}`);

      const response = await page.goto(url.toString(), {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      if (response) {
        const body = await response.text();
        try {
          return JSON.parse(body);
        } catch {
          return body;
        }
      }
      return null;

    } finally {
      await page.close();
    }
  }
}

// Main execution
async function main(): Promise<void> {
  const scraper = new ZillowScraper();
  const logger = scraper['logger'];

  try {
    await scraper.init();
    logger.info('[ZILLOW] Scraper initialized');

    // Test search
    const listings = await scraper.searchLocation('New York NY', 'for_sale');
    logger.info(`\n[RESULTS] Found ${listings.length} listings`);

    if (listings.length > 0) {
      logger.info('\n[SAMPLE] First 3 listings:');
      listings.slice(0, 3).forEach((l, i) => {
        logger.info(`  ${i + 1}. ${l.address}, ${l.city} - $${l.price.toLocaleString()}`);
        logger.info(`     ${l.bedrooms}bd/${l.bathrooms}ba, ${l.livingArea} sqft`);
        logger.info(`     ZPID: ${l.zpid}`);
      });

      // Get details for first listing
      if (listings[0].zpid) {
        logger.info(`\n[DETAILS] Fetching details for ZPID: ${listings[0].zpid}`);
        const details = await scraper.getPropertyDetails(listings[0].zpid);
        if (details) {
          logger.info('[DETAILS] Successfully retrieved property details');
        }
      }
    }

    // Log intercepted API calls
    const calls = scraper.getInterceptedCalls();
    logger.info(`\n[API CALLS] Intercepted ${calls.length} API calls:`);
    calls.slice(0, 10).forEach((call) => {
      logger.info(`  ${call.method} ${call.url.substring(0, 80)}...`);
    });

  } catch (error) {
    logger.error('[ERROR]', error);
  } finally {
    await scraper.close();
  }
}

main();
