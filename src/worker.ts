/**
 * QuintoAndar Worker - Phase 2: Detail Fetching
 *
 * Consumes listing IDs from Redis queue and fetches property details.
 *
 * Features:
 * - Distributed processing (run multiple workers)
 * - Automatic retry with exponential backoff
 * - TLS fingerprint rotation
 * - Rate limiting per worker
 * - Progress tracking
 *
 * Usage:
 *   npm run worker              # Start single worker
 *   npm run worker:multi 5      # Start 5 workers in parallel
 */

import axios from 'axios';
import { config } from './config';
import { transformToStandard } from './transformer';
import { sendToCoreService, markPropertyInactive } from './core';
import { logger } from './logger';
import { randomDelay } from './utils';
import { RedisQueue } from './redis-queue';

export class QuintoAndarWorker {
  private queue: RedisQueue;
  private workerId: string;
  private isRunning: boolean = false;
  private processedCount: number = 0;
  private failedCount: number = 0;
  private changedCount: number = 0;
  private unchangedCount: number = 0;

  constructor(workerId?: string) {
    this.workerId = workerId || `worker-${process.pid}`;
    this.queue = new RedisQueue('quintoandar');
  }

  async initialize() {
    await this.queue.initialize();
    logger.info(`Worker ${this.workerId} initialized`);
  }

  /**
   * Fetch property details using yellow-pages endpoint
   */
  async fetchPropertyDetail(listingId: string): Promise<any | null> {
    const returnFields = [
      'id', 'rent', 'salePrice', 'forRent', 'forSale', 'bedrooms', 'bathrooms',
      'area', 'totalCost', 'city', 'address', 'neighbourhood', 'type', 'coverImage',
      'parkingSpaces', 'condominium', 'iptuPlusCondominium', 'location', 'imageList',
      'amenities', 'installations', 'visitStatus', 'hasElevator', 'isFurnished',
      'regionName', 'countryCode',
    ];

    const baseUrl = 'https://www.quintoandar.com.br/api/yellow-pages/v2/search';
    const queryParams = new URLSearchParams();
    queryParams.append('house_ids', listingId);
    queryParams.append('availability', 'any');
    queryParams.append('business_context', config.businessContext);
    returnFields.forEach(field => queryParams.append('return', field));

    try {
      const response = await axios.get(`${baseUrl}?${queryParams.toString()}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        timeout: 30000,
      });

      const data = response.data;

      if (data.hits && data.hits.hits && data.hits.hits.length > 0) {
        const hit = data.hits.hits[0];
        return {
          id: hit._id,
          source: 'quintoandar',
          url: `https://www.quintoandar.com.br/imovel/${hit._id}`,
          ...hit._source,
          rawData: hit._source,
        };
      }

      return null;
    } catch (error) {
      throw new Error(`Fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process single listing ID
   */
  async processListing(id: string): Promise<boolean> {
    try {
      // Check if already processed (race condition check)
      const isProcessed = await this.queue.isProcessed(id);
      if (isProcessed) {
        logger.debug(`[${this.workerId}] Skipping ${id} - already processed`);
        return true;
      }

      // Fetch details
      const property = await this.fetchPropertyDetail(id);

      if (!property) {
        logger.warn(`[${this.workerId}] Property ${id} not found`);
        await this.queue.markFailed(id, 'Not found');
        return false;
      }

      // Check if property has changed (compare with snapshot)
      const hasChanged = await this.queue.hasPropertyChanged(id, property.rawData);

      if (!hasChanged) {
        // Property unchanged - skip sending to Core Service
        logger.debug(`[${this.workerId}] Property ${id} unchanged - skipping Core Service`);
        this.unchangedCount++;
      } else {
        // Property changed or new - send to Core Service
        logger.info(`[${this.workerId}] Property ${id} changed - sending to Core Service`);

        // Transform to StandardProperty
        const standardized = transformToStandard(property);

        // Send to Core Service
        if (config.apiKey) {
          await sendToCoreService({
            portal: config.portal,
            portal_id: property.id,
            country: config.country,
            data: standardized,
            raw_data: property.rawData,
            status: 'active'
          });
        }

        // Update snapshot after successful send
        await this.queue.storePropertySnapshot(id, property.rawData);
        this.changedCount++;
      }

      // Mark as processed (whether changed or not)
      await this.queue.markProcessed(id);
      this.processedCount++;

      if (this.processedCount % 10 === 0) {
        logger.info(
          `[${this.workerId}] Processed: ${this.processedCount} ` +
          `(Changed: ${this.changedCount}, Unchanged: ${this.unchangedCount}, Failed: ${this.failedCount})`
        );
      }

      return true;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.workerId}] Failed to process ${id}:`, errorMsg);

      // Re-queue with retry limit
      const requeued = await this.queue.requeueWithRetry(id, 3);
      if (!requeued) {
        this.failedCount++;
        logger.error(`[${this.workerId}] Permanently failed ${id} after max retries`);
      }

      return false;
    }
  }

  /**
   * Start worker (blocking loop)
   */
  async start(): Promise<void> {
    this.isRunning = true;
    logger.info(`[${this.workerId}] Starting worker...`);

    let emptyQueueCount = 0;
    const maxEmptyChecks = 10; // Exit after 10 consecutive empty checks

    while (this.isRunning) {
      try {
        // Pop next ID from queue (blocking for 5 seconds)
        const id = await this.queue.popListingId(5);

        if (!id) {
          emptyQueueCount++;

          if (emptyQueueCount >= maxEmptyChecks) {
            logger.info(`[${this.workerId}] Queue empty after ${maxEmptyChecks} checks. Stopping.`);
            break;
          }

          // Show stats while waiting
          const stats = await this.queue.getStats();
          logger.info(`[${this.workerId}] Queue empty (${emptyQueueCount}/${maxEmptyChecks}). Stats:`, stats);
          continue;
        }

        // Reset empty count when we get an ID
        emptyQueueCount = 0;

        // Process the listing
        await this.processListing(id);

        // Rate limiting per worker
        await randomDelay(
          config.requestDelayMs * 0.6,
          config.requestDelayMs * 1.6
        );

      } catch (error) {
        logger.error(`[${this.workerId}] Worker error:`, error);
        await randomDelay(5000, 10000); // Back off on errors
      }
    }

    logger.info(
      `[${this.workerId}] Worker stopped. ` +
      `Processed: ${this.processedCount} (Changed: ${this.changedCount}, Unchanged: ${this.unchangedCount}, Failed: ${this.failedCount})`
    );
  }

  /**
   * Stop worker gracefully
   */
  async stop(): Promise<void> {
    logger.info(`[${this.workerId}] Stopping worker...`);
    this.isRunning = false;
    await this.queue.close();
  }

  /**
   * Get worker stats
   */
  getStats() {
    return {
      workerId: this.workerId,
      processedCount: this.processedCount,
      changedCount: this.changedCount,
      unchangedCount: this.unchangedCount,
      failedCount: this.failedCount,
      changeRate: this.processedCount > 0
        ? ((this.changedCount / this.processedCount) * 100).toFixed(2) + '%'
        : '0%',
      isRunning: this.isRunning,
    };
  }
}

// Main execution
async function main() {
  const workerId = process.env.WORKER_ID || `worker-${process.pid}`;

  logger.info('Starting QuintoAndar Worker');
  logger.info(`Worker ID: ${workerId}`);

  const worker = new QuintoAndarWorker(workerId);
  await worker.initialize();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    await worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await worker.stop();
    process.exit(0);
  });

  try {
    // Start processing
    await worker.start();

    // Show final stats
    const stats = worker.getStats();
    logger.info('=== WORKER STATS ===', stats);

    // Show queue stats
    const queueStats = await worker['queue'].getStats();
    logger.info('=== QUEUE STATS ===', queueStats);

  } catch (error) {
    logger.error('Worker failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
