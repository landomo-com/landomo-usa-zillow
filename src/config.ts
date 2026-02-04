/**
 * Configuration for Zillow USA Scraper
 */

export interface ScraperConfig {
  // Redis Queue Configuration
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB: number;

  // PostgreSQL Database Configuration
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;

  // Scraper Configuration
  PORTAL_NAME: string;
  COUNTRY: string;
  BASE_URL: string;

  // Worker Configuration
  WORKER_CONCURRENCY: number;
  WORKER_BATCH_SIZE: number;
  MAX_RETRIES: number;
  RETRY_DELAY: number;

  // Rate Limiting
  RATE_LIMIT_PER_SECOND: number;
  RATE_LIMIT_PER_MINUTE: number;
  REQUEST_DELAY_MS: number;

  // Timeout Configuration
  PAGE_TIMEOUT: number;
  NAVIGATION_TIMEOUT: number;

  // Metrics Configuration
  METRICS_PORT: number;

  // Logging
  LOG_LEVEL: string;

  // Browser Configuration
  HEADLESS: boolean;
  STEALTH_MODE: boolean;

  // USA-Specific
  LOCATIONS: Array<{ city: string; state: string; lat: number; lon: number }>;
  LISTING_TYPE: 'for_sale' | 'for_rent' | 'sold';
}

// Load configuration from environment variables
export const config: ScraperConfig = {
  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: parseInt(process.env.REDIS_DB || '0'),

  // PostgreSQL
  POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
  POSTGRES_PORT: parseInt(process.env.POSTGRES_PORT || '5432'),
  POSTGRES_DB: process.env.POSTGRES_DB || 'scraper_usa_zillow',
  POSTGRES_USER: process.env.POSTGRES_USER || 'postgres',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'postgres',

  // Scraper
  PORTAL_NAME: 'Zillow',
  COUNTRY: 'usa',
  BASE_URL: 'https://www.zillow.com',

  // Worker
  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY || '5'),
  WORKER_BATCH_SIZE: parseInt(process.env.WORKER_BATCH_SIZE || '10'),
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),
  RETRY_DELAY: parseInt(process.env.RETRY_DELAY || '2000'),

  // Rate Limiting
  RATE_LIMIT_PER_SECOND: parseInt(process.env.RATE_LIMIT_PER_SECOND || '5'),
  RATE_LIMIT_PER_MINUTE: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '100'),
  REQUEST_DELAY_MS: parseInt(process.env.REQUEST_DELAY_MS || '2000'),

  // Timeout
  PAGE_TIMEOUT: parseInt(process.env.PAGE_TIMEOUT || '60000'),
  NAVIGATION_TIMEOUT: parseInt(process.env.NAVIGATION_TIMEOUT || '30000'),

  // Metrics
  METRICS_PORT: parseInt(process.env.METRICS_PORT || '9090'),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Browser
  HEADLESS: process.env.HEADLESS !== 'false',
  STEALTH_MODE: process.env.STEALTH_MODE !== 'false',

  // USA Major Cities (Top 50)
  LOCATIONS: [
    { city: 'New York', state: 'NY', lat: 40.7128, lon: -74.0060 },
    { city: 'Los Angeles', state: 'CA', lat: 34.0522, lon: -118.2437 },
    { city: 'Chicago', state: 'IL', lat: 41.8781, lon: -87.6298 },
    { city: 'Houston', state: 'TX', lat: 29.7604, lon: -95.3698 },
    { city: 'Phoenix', state: 'AZ', lat: 33.4484, lon: -112.0740 },
    { city: 'Philadelphia', state: 'PA', lat: 39.9526, lon: -75.1652 },
    { city: 'San Antonio', state: 'TX', lat: 29.4241, lon: -98.4936 },
    { city: 'San Diego', state: 'CA', lat: 32.7157, lon: -117.1611 },
    { city: 'Dallas', state: 'TX', lat: 32.7767, lon: -96.7970 },
    { city: 'San Jose', state: 'CA', lat: 37.3382, lon: -121.8863 },
    { city: 'Austin', state: 'TX', lat: 30.2672, lon: -97.7431 },
    { city: 'Jacksonville', state: 'FL', lat: 30.3322, lon: -81.6557 },
    { city: 'Fort Worth', state: 'TX', lat: 32.7555, lon: -97.3308 },
    { city: 'Columbus', state: 'OH', lat: 39.9612, lon: -82.9988 },
    { city: 'Charlotte', state: 'NC', lat: 35.2271, lon: -80.8431 },
    { city: 'San Francisco', state: 'CA', lat: 37.7749, lon: -122.4194 },
    { city: 'Indianapolis', state: 'IN', lat: 39.7684, lon: -86.1581 },
    { city: 'Seattle', state: 'WA', lat: 47.6062, lon: -122.3321 },
    { city: 'Denver', state: 'CO', lat: 39.7392, lon: -104.9903 },
    { city: 'Washington', state: 'DC', lat: 38.9072, lon: -77.0369 },
    { city: 'Boston', state: 'MA', lat: 42.3601, lon: -71.0589 },
    { city: 'El Paso', state: 'TX', lat: 31.7619, lon: -106.4850 },
    { city: 'Nashville', state: 'TN', lat: 36.1627, lon: -86.7816 },
    { city: 'Detroit', state: 'MI', lat: 42.3314, lon: -83.0458 },
    { city: 'Oklahoma City', state: 'OK', lat: 35.4676, lon: -97.5164 },
    { city: 'Portland', state: 'OR', lat: 45.5152, lon: -122.6784 },
    { city: 'Las Vegas', state: 'NV', lat: 36.1699, lon: -115.1398 },
    { city: 'Memphis', state: 'TN', lat: 35.1495, lon: -90.0490 },
    { city: 'Louisville', state: 'KY', lat: 38.2527, lon: -85.7585 },
    { city: 'Baltimore', state: 'MD', lat: 39.2904, lon: -76.6122 },
    { city: 'Milwaukee', state: 'WI', lat: 43.0389, lon: -87.9065 },
    { city: 'Albuquerque', state: 'NM', lat: 35.0844, lon: -106.6504 },
    { city: 'Tucson', state: 'AZ', lat: 32.2226, lon: -110.9747 },
    { city: 'Fresno', state: 'CA', lat: 36.7378, lon: -119.7871 },
    { city: 'Mesa', state: 'AZ', lat: 33.4152, lon: -111.8315 },
    { city: 'Sacramento', state: 'CA', lat: 38.5816, lon: -121.4944 },
    { city: 'Atlanta', state: 'GA', lat: 33.7490, lon: -84.3880 },
    { city: 'Kansas City', state: 'MO', lat: 39.0997, lon: -94.5786 },
    { city: 'Colorado Springs', state: 'CO', lat: 38.8339, lon: -104.8214 },
    { city: 'Raleigh', state: 'NC', lat: 35.7796, lon: -78.6382 },
    { city: 'Omaha', state: 'NE', lat: 41.2565, lon: -95.9345 },
    { city: 'Miami', state: 'FL', lat: 25.7617, lon: -80.1918 },
    { city: 'Long Beach', state: 'CA', lat: 33.7701, lon: -118.1937 },
    { city: 'Virginia Beach', state: 'VA', lat: 36.8529, lon: -75.9780 },
    { city: 'Oakland', state: 'CA', lat: 37.8044, lon: -122.2712 },
    { city: 'Minneapolis', state: 'MN', lat: 44.9778, lon: -93.2650 },
    { city: 'Tulsa', state: 'OK', lat: 36.1539, lon: -95.9928 },
    { city: 'Tampa', state: 'FL', lat: 27.9506, lon: -82.4572 },
    { city: 'Arlington', state: 'TX', lat: 32.7357, lon: -97.1081 },
    { city: 'New Orleans', state: 'LA', lat: 29.9511, lon: -90.0715 },
  ],

  LISTING_TYPE: (process.env.LISTING_TYPE as any) || 'for_sale',
};

export default config;
