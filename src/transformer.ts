/**
 * Zillow Transformer - Converts Zillow data to StandardProperty format
 *
 * Handles US-specific property data including:
 * - Lot size in sqft (standard US unit)
 * - Garage spaces
 * - Number of stories
 * - HOA information
 * - School district data
 */

interface ZillowRawProperty {
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
  images?: string[];
  detailUrl: string;
  daysOnZillow?: number;
  priceHistory?: Array<{ date: string; price: number; event: string }>;
  description?: string;

  // Detailed property fields (from details page)
  garageSpaces?: number;
  parkingSpaces?: number;
  stories?: number;
  hoaFee?: number;
  hoaName?: string;
  hoaFeeFrequency?: string;
  schoolDistrict?: string;
  elementarySchool?: string;
  middleSchool?: string;
  highSchool?: string;
  propertyTaxRate?: number;
  annualTaxAmount?: number;
  heating?: string;
  cooling?: string;
  appliances?: string[];
  flooring?: string[];
  roof?: string;
  foundation?: string;
  exteriorFeatures?: string[];
  interiorFeatures?: string[];
  communityFeatures?: string[];
  lotFeatures?: string[];
  constructionMaterials?: string[];
  architecturalStyle?: string;
  hasSpa?: boolean;
  hasPool?: boolean;
  hasFireplace?: boolean;
  hasWaterfrontView?: boolean;
  hasCityView?: boolean;
  county?: string;
  parcelNumber?: string;
  mlsNumber?: string;

  // Rental-specific
  rentPrice?: number;
  depositAmount?: number;
  petPolicy?: string;
  leaseTerm?: string;
  availableDate?: string;
}

interface StandardProperty {
  title: string;
  price: number;
  currency: string;
  property_type: string;
  transaction_type: 'sale' | 'rent';

  location: {
    address?: string;
    city: string;
    region?: string;
    postal_code?: string;
    country: string;
    county?: string;
    coordinates?: {
      lat: number;
      lon: number;
    };
  };

  details: {
    bedrooms?: number;
    bathrooms?: number;
    sqm?: number;
    sqft?: number;
    rooms?: number;
    floor?: number;
    total_floors?: number;
    construction_year?: number;
    available_from?: string;
    parking_spaces?: number;
  };

  features: string[];

  amenities?: {
    has_parking?: boolean;
    has_garage?: boolean;
    has_balcony?: boolean;
    has_terrace?: boolean;
    has_garden?: boolean;
    has_pool?: boolean;
    has_elevator?: boolean;
    has_air_conditioning?: boolean;
    has_heating?: boolean;
    has_fireplace?: boolean;
    has_security?: boolean;
    has_storage?: boolean;
    pet_friendly?: boolean;
    furnished?: boolean;
    wheelchair_accessible?: boolean;
  };

  financial?: {
    price_per_sqm?: number;
    price_per_sqft?: number;
    hoa_fee?: number;
    hoa_fee_frequency?: string;
    property_tax?: number;
    estimated_value?: number;
    price_history?: Array<{
      date: string;
      price: number;
      event: string;
    }>;
  };

  images: string[];
  description?: string;

  listing_details?: {
    days_on_market?: number;
    listing_date?: string;
    last_updated?: string;
    status?: string;
    mls_number?: string;
  };

  country_specific: {
    lot_size_sqft?: number;
    garage_spaces?: number;
    stories?: number;
    hoa_name?: string;
    hoa_fee_frequency?: string;
    school_district?: string;
    elementary_school?: string;
    middle_school?: string;
    high_school?: string;
    county?: string;
    parcel_number?: string;
    zestimate?: number;
    rent_zestimate?: number;
    heating_type?: string;
    cooling_type?: string;
    roof_type?: string;
    foundation_type?: string;
    architectural_style?: string;
    has_spa?: boolean;
    has_waterfront_view?: boolean;
    has_city_view?: boolean;
    pet_policy?: string;
    lease_term?: string;
    deposit_amount?: number;
  };
}

/**
 * Normalize Zillow home type to standard property type
 */
function normalizePropertyType(zillowType: string): string {
  const type = zillowType.toLowerCase();

  if (type.includes('single') || type.includes('sfr')) return 'house';
  if (type.includes('condo') || type.includes('condominium')) return 'apartment';
  if (type.includes('townhouse') || type.includes('townhome')) return 'townhouse';
  if (type.includes('multi') || type.includes('duplex') || type.includes('triplex')) return 'multi_family';
  if (type.includes('land') || type.includes('lot')) return 'land';
  if (type.includes('mobile') || type.includes('manufactured')) return 'mobile_home';
  if (type.includes('farm') || type.includes('ranch')) return 'farm';
  if (type.includes('commercial')) return 'commercial';
  if (type.includes('apartment')) return 'apartment';

  return 'other';
}

/**
 * Determine transaction type from listing status and price fields
 */
function getTransactionType(raw: ZillowRawProperty): 'sale' | 'rent' {
  if (raw.rentPrice || raw.rentZestimate) return 'rent';
  if (raw.listingStatus?.toLowerCase().includes('rent')) return 'rent';
  return 'sale';
}

/**
 * Generate property title from address and type
 */
function generateTitle(raw: ZillowRawProperty): string {
  const type = normalizePropertyType(raw.homeType);
  const typeLabel = type === 'house' ? 'House' :
                    type === 'apartment' ? 'Condo' :
                    type === 'townhouse' ? 'Townhouse' :
                    type;

  const bedInfo = raw.bedrooms > 0 ? `${raw.bedrooms} Bedroom ` : '';

  return `${bedInfo}${typeLabel} in ${raw.city}, ${raw.state}`;
}

/**
 * Extract all features from Zillow property data
 */
function extractFeatures(raw: ZillowRawProperty): string[] {
  const features: string[] = [];

  // Basic features
  if (raw.garageSpaces && raw.garageSpaces > 0) {
    features.push(`${raw.garageSpaces} Car Garage`);
  }

  if (raw.parkingSpaces && raw.parkingSpaces > 0) {
    features.push(`${raw.parkingSpaces} Parking Spaces`);
  }

  if (raw.stories) {
    features.push(`${raw.stories} Story`);
  }

  if (raw.yearBuilt) {
    features.push(`Built in ${raw.yearBuilt}`);
  }

  if (raw.hasPool) {
    features.push('Swimming Pool');
  }

  if (raw.hasSpa) {
    features.push('Spa');
  }

  if (raw.hasFireplace) {
    features.push('Fireplace');
  }

  if (raw.hasWaterfrontView) {
    features.push('Waterfront View');
  }

  if (raw.hasCityView) {
    features.push('City View');
  }

  // Add feature arrays
  if (raw.interiorFeatures) {
    features.push(...raw.interiorFeatures);
  }

  if (raw.exteriorFeatures) {
    features.push(...raw.exteriorFeatures);
  }

  if (raw.communityFeatures) {
    features.push(...raw.communityFeatures);
  }

  if (raw.lotFeatures) {
    features.push(...raw.lotFeatures);
  }

  if (raw.appliances) {
    features.push(...raw.appliances);
  }

  if (raw.flooring) {
    features.push(...raw.flooring.map(f => `${f} Flooring`));
  }

  // Remove duplicates and return
  return [...new Set(features)];
}

/**
 * Convert square feet to square meters
 */
function sqftToSqm(sqft: number): number {
  return Math.round(sqft * 0.092903 * 100) / 100;
}

/**
 * Calculate price per square foot
 */
function calculatePricePerSqft(price: number, sqft: number): number | undefined {
  if (!price || !sqft || sqft === 0) return undefined;
  return Math.round(price / sqft * 100) / 100;
}

/**
 * Transform Zillow property to StandardProperty format
 */
export function transformToStandard(raw: ZillowRawProperty): StandardProperty {
  const transactionType = getTransactionType(raw);
  const actualPrice = transactionType === 'rent' ? (raw.rentPrice || raw.price) : raw.price;

  // Collect all images
  const images: string[] = [];
  if (raw.imageUrl) images.push(raw.imageUrl);
  if (raw.images) images.push(...raw.images);

  const standardized: StandardProperty = {
    title: generateTitle(raw),
    price: actualPrice || 0,
    currency: 'USD',
    property_type: normalizePropertyType(raw.homeType),
    transaction_type: transactionType,

    location: {
      address: raw.address,
      city: raw.city,
      region: raw.state,
      postal_code: raw.zipcode,
      country: 'united states',
      county: raw.county,
      coordinates: (raw.latitude && raw.longitude) ? {
        lat: raw.latitude,
        lon: raw.longitude
      } : undefined
    },

    details: {
      bedrooms: raw.bedrooms || undefined,
      bathrooms: raw.bathrooms || undefined,
      sqft: raw.livingArea || undefined,
      sqm: raw.livingArea ? sqftToSqm(raw.livingArea) : undefined,
      rooms: raw.bedrooms || undefined, // Total rooms could be bedrooms + other rooms
      construction_year: raw.yearBuilt || undefined,
      parking_spaces: raw.parkingSpaces || raw.garageSpaces || undefined,
      total_floors: raw.stories || undefined,
      available_from: raw.availableDate || undefined
    },

    features: extractFeatures(raw),

    amenities: {
      has_parking: (raw.parkingSpaces || raw.garageSpaces) ? true : undefined,
      has_garage: raw.garageSpaces ? raw.garageSpaces > 0 : undefined,
      has_pool: raw.hasPool || undefined,
      has_fireplace: raw.hasFireplace || undefined,
      has_air_conditioning: raw.cooling ? true : undefined,
      has_heating: raw.heating ? true : undefined,
      pet_friendly: raw.petPolicy ? !raw.petPolicy.toLowerCase().includes('no pets') : undefined
    },

    financial: {
      price_per_sqft: raw.livingArea ? calculatePricePerSqft(actualPrice, raw.livingArea) : undefined,
      price_per_sqm: raw.livingArea ? calculatePricePerSqft(actualPrice, sqftToSqm(raw.livingArea)) : undefined,
      hoa_fee: raw.hoaFee || undefined,
      hoa_fee_frequency: raw.hoaFeeFrequency || undefined,
      property_tax: raw.annualTaxAmount || undefined,
      estimated_value: raw.zestimate || undefined,
      price_history: raw.priceHistory || undefined
    },

    images: [...new Set(images)], // Remove duplicates
    description: raw.description,

    listing_details: {
      days_on_market: raw.daysOnZillow || undefined,
      status: raw.listingStatus || undefined,
      mls_number: raw.mlsNumber || undefined
    },

    // US-specific fields
    country_specific: {
      lot_size_sqft: raw.lotSize || undefined,
      garage_spaces: raw.garageSpaces || undefined,
      stories: raw.stories || undefined,
      hoa_name: raw.hoaName || undefined,
      hoa_fee_frequency: raw.hoaFeeFrequency || undefined,
      school_district: raw.schoolDistrict || undefined,
      elementary_school: raw.elementarySchool || undefined,
      middle_school: raw.middleSchool || undefined,
      high_school: raw.highSchool || undefined,
      county: raw.county || undefined,
      parcel_number: raw.parcelNumber || undefined,
      zestimate: raw.zestimate || undefined,
      rent_zestimate: raw.rentZestimate || undefined,
      heating_type: raw.heating || undefined,
      cooling_type: raw.cooling || undefined,
      roof_type: raw.roof || undefined,
      foundation_type: raw.foundation || undefined,
      architectural_style: raw.architecturalStyle || undefined,
      has_spa: raw.hasSpa || undefined,
      has_waterfront_view: raw.hasWaterfrontView || undefined,
      has_city_view: raw.hasCityView || undefined,
      pet_policy: raw.petPolicy || undefined,
      lease_term: raw.leaseTerm || undefined,
      deposit_amount: raw.depositAmount || undefined
    }
  };

  return standardized;
}

/**
 * Transform and prepare for Core Service ingestion
 */
export function prepareForIngestion(raw: ZillowRawProperty) {
  const standardized = transformToStandard(raw);

  return {
    portal: 'zillow',
    portal_id: raw.zpid,
    country: 'united states',
    data: standardized,
    raw_data: raw,
    url: raw.detailUrl
  };
}

/**
 * Batch transform multiple properties
 */
export function transformBatch(rawProperties: ZillowRawProperty[]): StandardProperty[] {
  return rawProperties.map(transformToStandard);
}

/**
 * Validate transformed property has required fields
 */
export function validateStandardProperty(property: StandardProperty): boolean {
  if (!property.title) return false;
  if (!property.price || property.price <= 0) return false;
  if (!property.currency) return false;
  if (!property.property_type) return false;
  if (!property.transaction_type) return false;
  if (!property.location?.city) return false;
  if (!property.location?.country) return false;

  return true;
}
