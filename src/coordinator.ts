/**
 * QuintoAndar Coordinator - Phase 1: ID Discovery
 *
 * Discovers all listing IDs and pushes them to Redis queue for workers to process.
 *
 * Supports two strategies:
 * - City-based: 73 known cities
 * - Geo grid: 6,241 grid cells (entire Brazil)
 *
 * Usage:
 *   npm run coordinator          # City-based discovery
 *   npm run coordinator:geo      # Geo grid discovery
 */

import { config, CITY_COORDS } from './config';
import { logger } from './logger';
import { randomDelay } from './utils';
import { TLSClient } from './tls-client';
import { RedisQueue } from './redis-queue';
import { APIResponse } from './types';

// ALL 73 Brazilian cities
const ALL_CITIES = [
  'americana-sp', 'aparecida-de-goiania-go', 'barueri-sp', 'belford-roxo-rj',
  'belo-horizonte-mg', 'betim-mg', 'brasilia-df', 'brumadinho-mg',
  'campinas-sp', 'canoas-rs', 'carapicuiba-sp', 'contagem-mg',
  'cotia-sp', 'curitiba-pr', 'diadema-sp', 'duque-de-caxias-rj',
  'embu-das-artes-sp', 'ferraz-de-vasconcelos-sp', 'florianopolis-sc', 'goiania-go',
  'guaruja-sp', 'guarulhos-sp', 'hortolandia-sp', 'indaiatuba-sp',
  'itabirito-mg', 'itaquaquecetuba-sp', 'jacarei-sp', 'jundiai-sp',
  'lagoa-santa-mg', 'maua-sp', 'mesquita-rj', 'mogi-das-cruzes-sp',
  'nilopolis-rj', 'niteroi-rj', 'nova-iguacu-rj', 'nova-lima-mg',
  'novo-hamburgo-rs', 'osasco-sp', 'paulinia-sp', 'pinhais-pr',
  'poa-sp', 'porto-alegre-rs', 'praia-grande-sp', 'ribeirao-das-neves-mg',
  'ribeirao-pires-sp', 'ribeirao-preto-sp', 'rio-de-janeiro-rj', 'sabara-mg',
  'salvador-ba', 'santana-de-parnaiba-sp', 'santo-andre-sp', 'santos-sp',
  'sao-bernardo-do-campo-sp', 'sao-caetano-do-sul-sp', 'sao-goncalo-rj', 'sao-jose-dos-campos-sp',
  'sao-jose-dos-pinhais-pr', 'sao-jose-sc', 'sao-leopoldo-rs', 'sao-paulo-sp',
  'sao-vicente-sp', 'sorocaba-sp', 'sumare-sp', 'suzano-sp',
  'taboao-da-serra-sp', 'taubate-sp', 'uberlandia-mg', 'valinhos-sp',
  'varzea-paulista-sp', 'vespasiano-mg', 'viamao-rs', 'vinhedo-sp',
  'votorantim-sp',
];

// Brazil geographic boundaries
const BRAZIL_BOUNDS = {
  north: 5.27,
  south: -33.75,
  east: -34.79,
  west: -73.99,
};

export class QuintoAndarCoordinator {
  private client: TLSClient;
  private queue: RedisQueue;

  constructor() {
    this.client = new TLSClient();
    this.queue = new RedisQueue('quintoandar');
  }

  async initialize() {
    await this.client.initialize();
    await this.queue.initialize();
    logger.info('Coordinator initialized');
  }

  /**
   * Get city info (coordinates and viewport)
   */
  private getCityInfo(slug: string) {
    if (CITY_COORDS[slug + '-brasil']) {
      return CITY_COORDS[slug + '-brasil'];
    }
    return CITY_COORDS['sao-paulo-sp-brasil'];
  }

  /**
   * Fetch listing IDs for a location using coordinates endpoint
   */
  async fetchListingIds(
    lat: number,
    lng: number,
    viewport?: { north: number; south: number; east: number; west: number },
    offset: number = 0,
    pageSize: number = 100
  ): Promise<{ ids: string[]; total: number }> {
    const params: Record<string, string> = {
      'context.mapShowing': 'true',
      'context.listShowing': 'true',
      'context.deviceId': 'coordinator-' + Math.random().toString(36).substring(7),
      'context.numPhotos': '12',
      'context.isSSR': 'false',
      'filters.businessContext': config.businessContext,
      'filters.location.coordinate.lat': String(lat),
      'filters.location.coordinate.lng': String(lng),
      'filters.location.countryCode': 'BR',
      'filters.availability': 'ANY',
      'filters.occupancy': 'ANY',
      'filters.enableFlexibleSearch': 'true',
      'pagination.offset': String(offset),
      'pagination.pageSize': String(pageSize),
    };

    if (viewport) {
      params['filters.location.viewport.north'] = String(viewport.north);
      params['filters.location.viewport.south'] = String(viewport.south);
      params['filters.location.viewport.east'] = String(viewport.east);
      params['filters.location.viewport.west'] = String(viewport.west);
    }

    const fullUrl = `${config.baseApiUrl}${config.coordinatesEndpoint}`;
    const response = await this.client.get(fullUrl, params);
    const data: APIResponse = response.data;

    if (!data.hits || !data.hits.hits) {
      return { ids: [], total: 0 };
    }

    const ids = data.hits.hits.map(hit => hit._id);
    const total = data.hits.total.value;

    return { ids, total };
  }

  /**
   * Discover IDs for a single city and push to queue
   */
  async discoverCity(citySlug: string): Promise<number> {
    const cityInfo = this.getCityInfo(citySlug);
    const parts = citySlug.split('-');
    const state = parts[parts.length - 1].toUpperCase();
    const cityParts = parts.slice(0, -1);
    const city = cityParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

    logger.info(`Discovering IDs for ${city}, ${state}`);

    let offset = 0;
    const pageSize = 100;
    let totalAdded = 0;

    try {
      // Fetch first page
      const firstPage = await this.fetchListingIds(
        cityInfo.lat,
        cityInfo.lng,
        cityInfo.viewport,
        0,
        pageSize
      );

      if (firstPage.total === 0) {
        logger.info(`${city}: No listings found`);
        return 0;
      }

      // Push IDs to queue
      const added = await this.queue.pushListingIds(firstPage.ids);
      totalAdded += added;

      logger.info(`${city}: Found ${firstPage.total} listings, queued ${added} new IDs`);

      // Fetch remaining pages
      offset += pageSize;
      while (offset < firstPage.total) {
        await randomDelay(config.requestDelayMs * 0.5, config.requestDelayMs * 1.0);

        const page = await this.fetchListingIds(
          cityInfo.lat,
          cityInfo.lng,
          cityInfo.viewport,
          offset,
          pageSize
        );

        const pageAdded = await this.queue.pushListingIds(page.ids);
        totalAdded += pageAdded;
        offset += pageSize;

        // Rotate TLS every 3 pages
        if (offset % (pageSize * 3) === 0) {
          await this.client.rotateProfile();
        }
      }

      logger.info(`${city}: Queued ${totalAdded} new IDs (${firstPage.total - totalAdded} duplicates)`);
      return totalAdded;

    } catch (error) {
      logger.error(`Failed to discover ${city}:`, error);
      return 0;
    }
  }

  /**
   * Discover IDs for all 73 cities
   */
  async discoverAllCities(): Promise<void> {
    logger.info('=== CITY-BASED DISCOVERY: 73 Cities ===');

    let totalAdded = 0;
    let citiesProcessed = 0;

    for (const citySlug of ALL_CITIES) {
      const added = await this.discoverCity(citySlug);
      totalAdded += added;
      citiesProcessed++;

      if (citiesProcessed % 10 === 0) {
        const stats = await this.queue.getStats();
        logger.info(`Progress: ${citiesProcessed}/${ALL_CITIES.length} cities | ${stats.totalDiscovered} total IDs`);
      }

      await randomDelay(config.requestDelayMs * 0.5, config.requestDelayMs);
    }

    const finalStats = await this.queue.getStats();
    logger.info('=== DISCOVERY COMPLETE ===', {
      citiesProcessed,
      totalDiscovered: finalStats.totalDiscovered,
      newIdsQueued: totalAdded,
    });

    // Find and queue missing properties (not seen in last 12 hours)
    await this.identifyMissingProperties();
  }

  /**
   * Identify properties not seen recently and queue for verification
   */
  async identifyMissingProperties(hoursThreshold: number = 12): Promise<void> {
    logger.info(`\n=== IDENTIFYING MISSING PROPERTIES (>${hoursThreshold}h) ===`);

    const missingIds = await this.queue.findMissingProperties(hoursThreshold);

    if (missingIds.length === 0) {
      logger.info('No missing properties found');
      return;
    }

    logger.info(`Found ${missingIds.length} properties not seen in last ${hoursThreshold} hours`);

    // Push to missing verification queue
    const queued = await this.queue.pushToMissingQueue(missingIds);

    logger.info(`Queued ${queued} properties for verification (${missingIds.length - queued} already verified inactive)`);
  }

  /**
   * Generate geographic grid cells
   */
  generateGrid(gridSize: number = 0.5): Array<{ lat: number; lng: number; viewport: any; index: number; total: number }> {
    const cells = [];
    let index = 0;

    const latSteps = Math.ceil((BRAZIL_BOUNDS.north - BRAZIL_BOUNDS.south) / gridSize);
    const lngSteps = Math.ceil((BRAZIL_BOUNDS.east - BRAZIL_BOUNDS.west) / gridSize);
    const totalCells = latSteps * lngSteps;

    for (let lat = BRAZIL_BOUNDS.south; lat < BRAZIL_BOUNDS.north; lat += gridSize) {
      for (let lng = BRAZIL_BOUNDS.west; lng < BRAZIL_BOUNDS.east; lng += gridSize) {
        cells.push({
          lat: lat + (gridSize / 2),
          lng: lng + (gridSize / 2),
          viewport: {
            north: lat + gridSize,
            south: lat,
            east: lng + gridSize,
            west: lng,
          },
          index: ++index,
          total: totalCells,
        });
      }
    }

    return cells;
  }

  /**
   * Discover IDs using geographic grid (entire Brazil)
   */
  async discoverGeoGrid(gridSize: number = 0.5): Promise<void> {
    logger.info(`=== GEO GRID DISCOVERY: Grid size ${gridSize}° ===`);

    const grid = this.generateGrid(gridSize);
    logger.info(`Generated ${grid.length} grid cells`);

    let totalAdded = 0;
    let cellsWithListings = 0;

    for (const cell of grid) {
      try {
        const firstPage = await this.fetchListingIds(
          cell.lat,
          cell.lng,
          cell.viewport,
          0,
          100
        );

        if (firstPage.total === 0) {
          continue; // Empty cell
        }

        cellsWithListings++;
        const added = await this.queue.pushListingIds(firstPage.ids);
        totalAdded += added;

        logger.info(`Cell ${cell.index}/${cell.total}: ${firstPage.total} listings, ${added} new IDs`);

        // Fetch remaining pages if needed
        let offset = 100;
        while (offset < firstPage.total) {
          await randomDelay(config.requestDelayMs * 0.5, config.requestDelayMs);

          const page = await this.fetchListingIds(
            cell.lat,
            cell.lng,
            cell.viewport,
            offset,
            100
          );

          const pageAdded = await this.queue.pushListingIds(page.ids);
          totalAdded += pageAdded;
          offset += 100;
        }

        // Progress update every 50 cells
        if (cell.index % 50 === 0) {
          const stats = await this.queue.getStats();
          logger.info(`Progress: ${cell.index}/${grid.length} cells | ${stats.totalDiscovered} IDs | ${cellsWithListings} cells with listings`);
        }

      } catch (error) {
        logger.error(`Failed cell ${cell.index}:`, error);
      }

      await randomDelay(config.requestDelayMs * 0.3, config.requestDelayMs * 0.8);
    }

    const finalStats = await this.queue.getStats();
    logger.info('=== DISCOVERY COMPLETE ===', {
      totalCells: grid.length,
      cellsWithListings,
      totalDiscovered: finalStats.totalDiscovered,
      newIdsQueued: totalAdded,
    });
  }

  async cleanup() {
    await this.client.destroy();
    await this.queue.close();
  }
}

// Main execution
async function main() {
  const mode = process.argv[2] || 'city';

  logger.info('Starting QuintoAndar Coordinator');
  logger.info(`Mode: ${mode === 'geo' ? 'Geographic Grid' : 'City-Based'}`);

  const coordinator = new QuintoAndarCoordinator();
  await coordinator.initialize();

  try {
    if (mode === 'geo') {
      const gridSize = parseFloat(process.env.GRID_SIZE || '0.5');
      await coordinator.discoverGeoGrid(gridSize);
    } else {
      await coordinator.discoverAllCities();
    }

    const stats = await coordinator['queue'].getStats();
    logger.info('=== FINAL STATS ===', stats);

    await coordinator.cleanup();
  } catch (error) {
    logger.error('Coordinator failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
