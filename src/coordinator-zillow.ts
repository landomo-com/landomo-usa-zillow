/**
 * Zillow Coordinator - Phase 1: ID Discovery
 *
 * Discovers all listing IDs and pushes them to Redis queue for workers to process.
 *
 * Strategy: City-based discovery for 50+ major US cities
 *
 * Usage:
 *   npm run coordinator
 */

import { config } from './config';
import { logger } from './logger';
import { sleep } from './utils';
import { ZillowScraper, ZillowSearchParams } from './scraper-zillow';
import { RedisQueue } from './redis-queue';
// import { metrics } from './metrics';

export class ZillowCoordinator {
  private scraper: ZillowScraper;
  private queue: RedisQueue;
  private totalDiscovered: number = 0;
  private totalQueued: number = 0;

  constructor() {
    this.scraper = new ZillowScraper();
    this.queue = new RedisQueue('zillow');
  }

  async initialize() {
    await this.scraper.init();
    await this.queue.initialize();
    logger.info('Zillow Coordinator initialized');
  }

  async close() {
    await this.scraper.close();
    await this.queue.close();
  }

  /**
   * Discover listings for a single city
   */
  async discoverCity(city: string, state: string) {
    logger.info(`Discovering listings in ${city}, ${state}`);
    let totalForCity = 0;
    let page = 1;
    const maxPages = 10; // Zillow typically shows max 10 pages

    try {
      while (page <= maxPages) {
        const params: ZillowSearchParams = {
          city,
          state,
          listingType: config.LISTING_TYPE,
          page,
        };

        const listings = await this.scraper.searchLocation(params);

        if (listings.length === 0) {
          logger.info(`No more listings found for ${city}, ${state} at page ${page}`);
          break;
        }

        // Queue each listing ID
        for (const listing of listings) {
          const zpid = listing.zpid?.toString();
          if (zpid) {
            await this.queue.addProperty(zpid, { zpid, city, state });
            totalForCity++;
            this.totalQueued++;
          }
        }

        logger.info(`Discovered ${listings.length} listings on page ${page} for ${city}, ${state}`);

        // Update metrics
        // metrics.incrementDiscovered(listings.length);
        this.totalDiscovered += listings.length;

        // Rate limiting
        await sleep(config.REQUEST_DELAY_MS);

        page++;
      }

      logger.info(`Total discovered for ${city}, ${state}: ${totalForCity}`);
      return totalForCity;

    } catch (error) {
      logger.error(`Failed to discover listings for ${city}, ${state}`, { error });
      // metrics.incrementErrors('discovery_error');
      return 0;
    }
  }

  /**
   * Discover all cities
   */
  async discoverAllCities() {
    logger.info(`Starting discovery for ${config.LOCATIONS.length} cities`);
    const startTime = Date.now();

    for (const location of config.LOCATIONS) {
      const count = await this.discoverCity(location.city, location.state);
      logger.info(`Progress: ${this.totalDiscovered} total discovered, ${this.totalQueued} queued`);

      // Rate limiting between cities
      await sleep(config.REQUEST_DELAY_MS * 2);
    }

    const duration = Date.now() - startTime;
    logger.info('Discovery completed', {
      totalDiscovered: this.totalDiscovered,
      totalQueued: this.totalQueued,
      durationMs: duration,
      cities: config.LOCATIONS.length,
    });

    // Update metrics
    // metrics.recordRunDuration(duration / 1000);
  }

  /**
   * Discover specific cities (for testing)
   */
  async discoverSpecificCities(cityNames: string[]) {
    logger.info(`Starting discovery for ${cityNames.length} specific cities`);

    for (const cityName of cityNames) {
      const location = config.LOCATIONS.find(
        loc => loc.city.toLowerCase() === cityName.toLowerCase()
      );

      if (!location) {
        logger.warn(`City not found: ${cityName}`);
        continue;
      }

      await this.discoverCity(location.city, location.state);
      await sleep(config.REQUEST_DELAY_MS * 2);
    }

    logger.info('Discovery completed', {
      totalDiscovered: this.totalDiscovered,
      totalQueued: this.totalQueued,
    });
  }
}

/**
 * Main execution
 */
async function main() {
  const coordinator = new ZillowCoordinator();

  try {
    await coordinator.initialize();

    // Check command line arguments
    const args = process.argv.slice(2);
    const specificCities = args.filter(arg => !arg.startsWith('--'));

    if (specificCities.length > 0) {
      // Discover specific cities
      logger.info(`Discovering specific cities: ${specificCities.join(', ')}`);
      await coordinator.discoverSpecificCities(specificCities);
    } else {
      // Discover all cities
      await coordinator.discoverAllCities();
    }

  } catch (error) {
    logger.error('Coordinator failed', { error });
    process.exit(1);
  } finally {
    await coordinator.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export default ZillowCoordinator;
