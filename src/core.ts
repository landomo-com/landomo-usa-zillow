/**
 * Temporary stub for @landomo/core package
 * TODO: Replace with actual @landomo/core package when published
 */

import axios from 'axios';
import { config } from './config';

export interface StandardProperty {
  title: string;
  price?: number;
  currency: string;
  property_type: string;
  transaction_type: 'sale' | 'rent';
  location: {
    address?: string;
    city?: string;
    country: string;
    state?: string;
    postal_code?: string;
    coordinates?: {
      lat: number;
      lon: number;
    };
  };
  details: {
    bedrooms?: number;
    bathrooms?: number;
    sqm?: number;
    rooms?: number;
  };
  features?: string[];
  amenities?: {
    has_parking?: boolean;
    has_balcony?: boolean;
    has_garden?: boolean;
    has_pool?: boolean;
  };
  country_specific?: Record<string, any>;
  images?: string[];
  description?: string;
  url?: string;
  status?: string;
}

export interface IngestionPayload {
  portal: string;
  portal_id: string;
  country: string;
  data: StandardProperty | null;  // null for status-only updates
  raw_data?: any;
  status?: 'active' | 'inactive';
  inactive_reason?: string;
  last_seen?: number;
}

/**
 * Send property data to Landomo Core Service
 */
export async function sendToCoreService(payload: IngestionPayload): Promise<void> {
  if (!config.apiKey) {
    console.warn('LANDOMO_API_KEY not set - skipping Core Service ingestion');
    return;
  }

  try {
    await axios.post(
      `${config.apiUrl}/properties/ingest`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  } catch (error) {
    console.error('Failed to send to Core Service:', error);
    throw error;
  }
}

/**
 * Mark property as inactive in Core Service
 */
export async function markPropertyInactive(
  portal: string,
  portalId: string,
  country: string,
  reason: string = 'not_found'
): Promise<void> {
  await sendToCoreService({
    portal,
    portal_id: portalId,
    country,
    data: null,
    status: 'inactive',
    inactive_reason: reason,
    last_seen: Date.now(),
  });
}
