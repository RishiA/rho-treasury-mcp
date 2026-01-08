/**
 * Treasury.gov API client
 * Fetches current Treasury rates and calculates T-Bill tiers
 */

import { TreasuryGovData, TierRates } from "../types.js";
import { TREASURY_GOV_URL, TIER_SPREADS, REQUEST_TIMEOUT, USER_AGENT } from "../config.js";

/**
 * Fetch current Treasury rates from Treasury.gov
 * Returns the most recent 3-month, 6-month, and 1-year rates
 */
export async function fetchTreasuryRates(): Promise<TreasuryGovData> {
  const currentYear = new Date().getFullYear();
  const url = `${TREASURY_GOV_URL}/${currentYear}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${currentYear}&page&_format=csv`;

  console.error(`[Treasury.gov] Fetching from: ${url}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const csvText = await response.text();
    return parseTreasuryCSV(csvText);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`);
    }
    throw error;
  }
}

/**
 * Parse Treasury.gov CSV data
 * Format: Date,1 Mo,2 Mo,3 Mo,4 Mo,6 Mo,1 Yr,2 Yr,3 Yr,5 Yr,7 Yr,10 Yr,20 Yr,30 Yr
 */
function parseTreasuryCSV(csvText: string): TreasuryGovData {
  const lines = csvText.trim().split("\n");

  if (lines.length < 2) {
    throw new Error("Invalid CSV data: less than 2 lines");
  }

  // Most recent data is on line 1 (line 0 is headers)
  const mostRecent = lines[1].split(",");

  if (mostRecent.length < 8) {
    throw new Error(`Invalid CSV data: expected at least 8 columns, got ${mostRecent.length}`);
  }

  const date = mostRecent[0].trim();

  // Column indices (0-based):
  // 0: Date, 1: 1 Mo, 2: 2 Mo, 3: 3 Mo, 4: 4 Mo, 5: 6 Mo, 6: 1 Yr, ...
  const threeMonthRate = parseFloat(mostRecent[3]);
  const sixMonthRate = parseFloat(mostRecent[5]);
  const oneYearRate = parseFloat(mostRecent[6]);

  if (isNaN(threeMonthRate)) {
    throw new Error(`Invalid 3-month rate at column 3: "${mostRecent[3]}"`);
  }

  console.error(`[Treasury.gov] Parsed: date=${date}, 3-month=${threeMonthRate}%`);

  return {
    date,
    threeMonthRate,
    sixMonthRate: isNaN(sixMonthRate) ? undefined : sixMonthRate,
    oneYearRate: isNaN(oneYearRate) ? undefined : oneYearRate,
  };
}

/**
 * Calculate T-Bill rates across all tiers using Rho's spread formula
 * Formula: T-Bill Rate = Treasury 3-month Rate - Spread
 * Returns tiers in descending order (largest deposits first)
 */
export function calculateTBillTiers(threeMonthRate: number): TierRates {
  const tiers: TierRates = {
    "20M+": formatRate(threeMonthRate - TIER_SPREADS["20M+"]),
    "10-20M": formatRate(threeMonthRate - TIER_SPREADS["10-20M"]),
    "5-10M": formatRate(threeMonthRate - TIER_SPREADS["5-10M"]),
    "2-5M": formatRate(threeMonthRate - TIER_SPREADS["2-5M"]),
    "350K-2M": formatRate(threeMonthRate - TIER_SPREADS["350K-2M"]),
  };

  console.error(`[Treasury.gov] Calculated T-Bill tiers:`, tiers);

  return tiers;
}

/**
 * Format rate to "X.XX%" string
 */
function formatRate(rate: number): string {
  return rate.toFixed(2) + "%";
}
