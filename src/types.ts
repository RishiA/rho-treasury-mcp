/**
 * Type definitions for Rho Treasury MCP Server
 */

// Rate tier type
export type RateTier = "350K-2M" | "2-5M" | "5-10M" | "10-20M" | "20M+";

// Investment type
export type InvestmentType = "mutual_fund" | "tbills" | "both";

// Treasury.gov data structure
export interface TreasuryGovData {
  date: string;
  threeMonthRate: number;
  sixMonthRate?: number;
  oneYearRate?: number;
}

// Rho scraped data structure
export interface RhoScrapedData {
  mutualFundRates: Record<RateTier, string>;
  asOfDate: string;
}

// Tier rates structure (descending order: largest deposits first)
export interface TierRates {
  "20M+": string;
  "10-20M": string;
  "5-10M": string;
  "2-5M": string;
  "350K-2M": string;
}

// Tool input parameters
export interface GetRatesInput {
  tier?: RateTier | "all";
  investment_type?: InvestmentType;
  force_refresh?: boolean;
}

// Tool output metadata
export interface RatesMetadata {
  as_of_date: string;
  last_updated: string;
  source_url: string;
  treasury_source_date: string;
  cache_hit: boolean;
  partial_response?: boolean;
  failed_sources?: string[];
  error_details?: string;
}

// Tool output structure
export interface RatesResponse {
  success: boolean;
  data?: {
    mutual_fund_rates?: Partial<TierRates>;
    tbill_rates?: Partial<TierRates>;
    metadata: RatesMetadata;
  };
  error?: {
    code: string;
    message: string;
    timestamp: string;
  };
}

// Error codes enum
export enum ErrorCode {
  SCRAPE_FAILED = "SCRAPE_FAILED",
  PARSE_ERROR = "PARSE_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  CACHE_ERROR = "CACHE_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

// Cache entry structure
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}
