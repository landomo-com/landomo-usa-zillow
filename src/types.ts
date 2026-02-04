/**
 * Zillow Scraper - Type Definitions
 */

// Legacy Property interface (for compatibility with old code)
export interface Property {
  id: string;
  title: string;
  price: number;
  currency: string;
  propertyType: string;
  transactionType: string;
  source?: string;
  location: {
    address?: string;
    city: string;
    region?: string;
    postcode?: string;
    country: string;
    coordinates?: { lat: number; lon: number };
  };
  details?: {
    sqm?: number;
    rooms?: number;
    bedrooms?: number;
    bathrooms?: number;
    floor?: number;
    totalFloors?: number;
    constructionYear?: number;
    availableFrom?: string;
    description?: string;
  };
  features: string[];
  amenities?: any;
  agent?: {
    name?: string;
    agency?: string;
    phone?: string;
    email?: string;
    isPrivate?: boolean;
  };
  metadata?: any;
  images?: string[];
  description?: string;
  url: string;
  scrapedAt?: string;
}

export interface ScraperResult {
  properties: Property[];
  totalFound: number;
  pagesScraped: number;
  errors: string[];
}

export interface ScraperConfig {
  portal: string;
  country?: string;
  baseUrl: string;
  transactionTypes?: ('sale' | 'rent')[];
  propertyTypes?: string[];
  useStealthBrowser?: boolean;
  needsProxy?: boolean;
  requestDelay?: number;
  rateLimit?: number;
  maxRetries?: number;
  maxConcurrent?: number;
  navigationTimeout?: number;
  detailTimeout?: number;
  recheckAfterDays?: number;
  recheckBatchSize?: number;
  [key: string]: any;  // Allow additional fields
}

// Additional types for Zillow compatibility
export interface PropertyListing extends Property {}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  nextPageUrl?: string;
}

export interface ScraperLogger {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
  performance: (metric: string, value: number) => void;
}

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
}
