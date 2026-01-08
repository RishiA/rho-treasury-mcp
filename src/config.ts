/**
 * Configuration constants for Rho Treasury MCP Server
 */

// Data source URLs
export const TREASURY_GOV_URL = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv";
export const RHO_TREASURY_URL = "https://www.rho.co/product/treasury";

// Cache TTLs (in milliseconds)
export const TREASURY_CACHE_TTL = 60 * 60 * 1000; // 1 hour
export const RHO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Request timeouts (in milliseconds)
export const REQUEST_TIMEOUT = 10000; // 10 seconds

// Tier spreads (percentage points to subtract from base rate)
export const TIER_SPREADS = {
  "20M+": 0.15,
  "10-20M": 0.25,
  "5-10M": 0.35,
  "2-5M": 0.45,
  "350K-2M": 0.60,
} as const;

// User agent for web requests
export const USER_AGENT = "Rho-Treasury-MCP/1.0.0 (Educational Project)";
