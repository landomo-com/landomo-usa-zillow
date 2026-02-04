# Changelog

All notable changes to the Zillow USA scraper will be documented in this file.

## [1.0.0] - 2026-02-04

### Added

- **Initial migration from old/usa/zillow to new multi-repo architecture**
- **Full Phase 2 Architecture**:
  - Redis queue system for distributed processing
  - PostgreSQL database for raw data storage and change tracking
  - Coordinator for property discovery
  - Workers for property detail scraping
  - Verifier worker for failed property re-processing
  - Queue statistics monitoring
  - Prometheus metrics server
- **Zillow-specific scraper**:
  - API interception using Playwright (__NEXT_DATA__ extraction)
  - Supports for_sale, for_rent, and sold listings
  - Handles PerimeterX bot protection
  - Stealth mode enabled
- **USA-specific fields**:
  - ZPID (Zillow Property ID)
  - Zestimate and Rent Zestimate
  - Lot size in square feet
  - Garage spaces
  - Number of stories
  - HOA information (fee, name, frequency)
  - School district data (elementary, middle, high school)
  - County and parcel number
  - Heating/cooling types
  - Roof and foundation types
  - Architectural style
  - View types (waterfront, city)
  - Pet policy and lease terms (for rentals)
- **Multi-city coverage**: 50+ major US cities
- **Data transformer**: Converts Zillow raw data to standardized format
- **Docker deployment**: Complete docker-compose setup
- **Documentation**:
  - README with full setup instructions
  - Phase 2 architecture documentation
  - Database schema with change tracking
- **CI/CD**: GitHub Actions workflows for testing and deployment

### Technical Details

- TypeScript with strict mode
- Node.js 20+
- Playwright for browser automation
- Redis for queue management
- PostgreSQL for data persistence
- Winston for logging
- Prometheus for metrics

### Coverage

Cities: New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas, San Jose, Austin, Jacksonville, Fort Worth, Columbus, Charlotte, San Francisco, Indianapolis, Seattle, Denver, Washington DC, Boston, El Paso, Nashville, Detroit, Oklahoma City, Portland, Las Vegas, Memphis, Louisville, Baltimore, Milwaukee, Albuquerque, Tucson, Fresno, Mesa, Sacramento, Atlanta, Kansas City, Colorado Springs, Raleigh, Omaha, Miami, Long Beach, Virginia Beach, Oakland, Minneapolis, Tulsa, Tampa, Arlington, New Orleans.

### Migration Notes

Migrated from `/old/usa/zillow/` with the following improvements:
- Moved from single-file scraper to full Phase 2 architecture
- Added Redis queue for scalability
- Added PostgreSQL for change tracking
- Added comprehensive USA-specific field extraction
- Added multi-city coordinator
- Added worker system for distributed processing
- Added metrics and monitoring
- Implemented transformer for data standardization

## Future Improvements

- [ ] Add geographic grid discovery (similar to Brazil)
- [ ] Add school ratings extraction
- [ ] Add neighborhood data
- [ ] Add property tax history
- [ ] Add HOA details from documents
- [ ] Add price history tracking
- [ ] Add market trends analysis
- [ ] Implement adaptive scheduling based on change rates
- [ ] Add proxy rotation for better anti-bot evasion
- [ ] Add CAPTCHA solving integration
