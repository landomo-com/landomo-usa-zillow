# Landomo USA Zillow Scraper

Production-ready scraper for Zillow (USA) with Phase 2 architecture (Redis Queue + PostgreSQL).

## Features

- **Full Phase 2 Architecture**: Redis-based queue system with PostgreSQL storage
- **API Interception**: Extracts data from Zillow's internal API (__NEXT_DATA__)
- **Multi-city Coverage**: Supports 50+ major US cities
- **Worker System**: Distributed processing with coordinator and workers
- **Change Detection**: Tracks property changes over time
- **USA-Specific Fields**: Lot size, HOA fees, school districts, garage spaces, etc.
- **Metrics**: Prometheus metrics for monitoring
- **Bot Protection**: Handles PerimeterX detection with stealth mode

## Architecture

```
Coordinator → Redis Queue → Workers → PostgreSQL
                 ↓
            Queue Stats
                 ↓
          Metrics Server
```

### Components

1. **Coordinator** (`coordinator.ts`): Discovers properties and queues them
2. **Workers** (`worker.ts`): Process queued properties and extract details
3. **Verifier** (`worker-verifier.ts`): Validates and re-scrapes failed properties
4. **Queue Stats** (`queue-stats.ts`): Monitor queue health
5. **Metrics Server** (`metrics-server.ts`): Prometheus metrics endpoint

## Quick Start

### Prerequisites

- Node.js 20+
- Redis
- PostgreSQL
- TypeScript

### Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Create database
createdb scraper_usa_zillow
psql scraper_usa_zillow < database/schema.sql
```

### Running

```bash
# Start coordinator (discovers properties)
npm run coordinator

# Start workers (process properties)
npm run worker

# Start verifier (re-process failed)
npm run worker:verifier

# Start metrics server
npm run metrics

# Check queue stats
npm run queue:stats
```

## USA-Specific Fields

The scraper extracts comprehensive USA-specific property data:

```typescript
country_specific: {
  zpid: string;                    // Zillow Property ID
  zestimate: number;               // Zillow's estimated value
  rent_zestimate: number;          // Estimated rental value
  lot_size_sqft: number;           // Lot size in square feet
  garage_spaces: number;           // Number of garage spaces
  stories: number;                 // Number of floors/stories
  hoa_fee: number;                 // HOA monthly fee
  hoa_name: string;                // HOA organization name
  school_district: string;         // School district
  elementary_school: string;       // Elementary school name
  middle_school: string;           // Middle school name
  high_school: string;             // High school name
  county: string;                  // County name
  parcel_number: string;           // Tax parcel number
  heating_type: string;            // Heating system type
  cooling_type: string;            // Cooling system type
  roof_type: string;               // Roof material
  foundation_type: string;         // Foundation type
  architectural_style: string;     // Architectural style
  has_spa: boolean;                // Has spa/hot tub
  has_waterfront_view: boolean;    // Waterfront view
  has_city_view: boolean;          // City view
  pet_policy: string;              // Pet policy (for rentals)
  lease_term: string;              // Lease term (for rentals)
  deposit_amount: number;          // Security deposit
}
```

## Configuration

Key environment variables:

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=scraper_usa_zillow

# Worker
WORKER_CONCURRENCY=5
WORKER_BATCH_SIZE=10

# Rate Limiting
RATE_LIMIT_PER_SECOND=5
REQUEST_DELAY_MS=2000

# Browser
HEADLESS=true
STEALTH_MODE=true

# Listing Type
LISTING_TYPE=for_sale  # or for_rent, sold
```

## Queue Management

```bash
# View queue statistics
npm run queue:stats

# Clear all queues (careful!)
npm run queue:clear

# Retry failed items
npm run queue:retry-failed

# Show failed items
npm run queue:show-failed
```

## Monitoring

### Prometheus Metrics

Available at `http://localhost:9090/metrics`:

- `zillow_properties_discovered_total`
- `zillow_properties_processed_total`
- `zillow_properties_failed_total`
- `zillow_queue_size`
- `zillow_processing_duration_seconds`

### Database Queries

```sql
-- Recent changes
SELECT * FROM recent_changes LIMIT 100;

-- High-change properties
SELECT * FROM high_change_properties LIMIT 50;

-- Scrape run statistics
SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 10;
```

## Coverage

### Cities (50+)

New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas, San Jose, Austin, Jacksonville, Fort Worth, Columbus, Charlotte, San Francisco, Indianapolis, Seattle, Denver, Washington DC, Boston, El Paso, Nashville, Detroit, Oklahoma City, Portland, Las Vegas, Memphis, Louisville, Baltimore, Milwaukee, Albuquerque, Tucson, Fresno, Mesa, Sacramento, Atlanta, Kansas City, Colorado Springs, Raleigh, Omaha, Miami, Long Beach, Virginia Beach, Oakland, Minneapolis, Tulsa, Tampa, Arlington, New Orleans.

## Development

```bash
# Build TypeScript
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Watch mode
npm run dev
```

## Docker Deployment

```bash
# Build image
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Test specific city
LISTING_TYPE=for_sale npm run coordinator -- --city "New York"
```

## Troubleshooting

### Bot Detection

If you encounter bot detection:

1. Enable stealth mode: `STEALTH_MODE=true`
2. Increase delays: `REQUEST_DELAY_MS=3000`
3. Reduce concurrency: `WORKER_CONCURRENCY=2`
4. Use proxies (configure in `.env`)

### Rate Limiting

If hitting rate limits:

1. Reduce rate: `RATE_LIMIT_PER_SECOND=2`
2. Increase delays: `REQUEST_DELAY_MS=5000`
3. Use fewer workers: `WORKER_CONCURRENCY=3`

### Memory Issues

If running out of memory:

1. Reduce batch size: `WORKER_BATCH_SIZE=5`
2. Reduce concurrency: `WORKER_CONCURRENCY=3`
3. Increase worker delay between batches

## License

UNLICENSED - Proprietary Landomo software

## Support

For issues or questions, contact the Landomo development team.
