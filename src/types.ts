/**
 * QuintoAndar-specific types
 */

export interface CityCoordinates {
  lat: number;
  lng: number;
  viewport: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface SearchPayload {
  context: {
    mapShowing: boolean;
    listShowing: boolean;
    deviceId: string;
    numPhotos: number;
    isSSR: boolean;
  };
  filters: {
    businessContext: string;
    blocklist: any[];
    selectedHouses: any[];
    location: {
      coordinate: { lat: number; lng: number };
      viewport: any;
      neighborhoods: any[];
      countryCode: string;
    };
    priceRange: any[];
    specialConditions: any[];
    excludedSpecialConditions: any[];
    houseSpecs: {
      area: { range: any };
      houseTypes: any[];
      amenities: any[];
      installations: any[];
      bathrooms: { range: any };
      bedrooms: { range: any };
      parkingSpace: { range: any };
      suites: { range: any };
    };
    availability: string;
    occupancy: string;
    partnerIds: any[];
    categories: any[];
    enableFlexibleSearch: boolean;
  };
  pagination: any;
  slug: string;
  fields: string[];
  locationDescriptions: { description: string }[];
  topics: any[];
}

export interface QuintoAndarListing {
  _id: string;
  _source: {
    id?: string;
    rent?: number;
    totalCost?: number;
    iptuPlusCondominium?: number;
    area?: number;
    bedrooms?: number;
    bathrooms?: number;
    parkingSpaces?: number;
    address?: string;
    regionName?: string;
    city?: string;
    neighbourhood?: string;
    coverImage?: string;
    forSale?: boolean;
    salePrice?: number;
    type?: string;
    visitStatus?: string;
    location?: {
      lat?: number;
      lon?: number;
    };
  };
}

export interface APIResponse {
  hits: {
    total: {
      value: number;
    };
    hits: QuintoAndarListing[];
  };
}

export interface ScraperConfig {
  baseUrl: string;
  businessContext: 'RENT' | 'SALE';
  cities: { city: string; state: string }[];
  pageSize: number;
}

export interface ScraperResult {
  total: number;
  scraped: number;
  failed: number;
  city: string;
  state: string;
  properties: any[];
}
