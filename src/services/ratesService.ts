/**
 * Rates service - main orchestrator
 * Coordinates data fetching, caching, and response formatting
 */

import {
  GetRatesInput,
  RatesResponse,
  TierRates,
  RateTier,
  ErrorCode,
  TreasuryGovData,
  RhoScrapedData,
} from "../types.js";
import { fetchTreasuryRates, calculateTBillTiers } from "./treasuryGov.js";
import { scrapeRhoRates } from "./rhoScraper.js";
import { cache } from "../utils/cache.js";
import { formatError, networkErrorMessage, parseErrorMessage, invalidInputMessage } from "../utils/errors.js";
import { TREASURY_CACHE_TTL, RHO_CACHE_TTL, RHO_TREASURY_URL } from "../config.js";

// Cache keys
const TREASURY_CACHE_KEY = "treasury_rates";
const RHO_CACHE_KEY = "rho_rates";

/**
 * Main entry point: Get rates based on user parameters
 */
export async function getRates(params: GetRatesInput): Promise<RatesResponse> {
  console.error(`[RatesService] Request: ${JSON.stringify(params)}`);

  try {
    // Validate input
    validateInput(params);

    const { tier = "all", investment_type = "both", force_refresh = false } = params;

    // Determine what to fetch
    const needTBills = investment_type === "both" || investment_type === "tbills";
    const needMutualFunds = investment_type === "both" || investment_type === "mutual_fund";

    // Fetch data (parallel if needed)
    const [tbillResult, mutualFundResult] = await Promise.allSettled([
      needTBills ? getTBillRates(force_refresh) : null,
      needMutualFunds ? getMutualFundRates(force_refresh) : null,
    ]);

    // Process results
    let tbillRates: Partial<TierRates> | undefined;
    let mutualFundRates: Partial<TierRates> | undefined;
    let treasurySourceDate: string | undefined;
    let asOfDate: string | undefined;
    const failedSources: string[] = [];
    let errorDetails: string | undefined;

    if (needTBills) {
      if (tbillResult.status === "fulfilled" && tbillResult.value) {
        const fullRates = tbillResult.value.rates;
        tbillRates = tier !== "all" ? filterByTier(fullRates, tier) : fullRates;
        treasurySourceDate = tbillResult.value.date;
      } else {
        failedSources.push("tbills");
        errorDetails = tbillResult.status === "rejected" ? tbillResult.reason?.message : "Unknown error";
      }
    }

    if (needMutualFunds) {
      if (mutualFundResult.status === "fulfilled" && mutualFundResult.value) {
        const fullRates = mutualFundResult.value.rates;
        mutualFundRates = tier !== "all" ? filterByTier(fullRates, tier) : fullRates;
        asOfDate = mutualFundResult.value.asOfDate;
      } else {
        failedSources.push("mutual_fund");
        if (!errorDetails) {
          errorDetails = mutualFundResult.status === "rejected" ? mutualFundResult.reason?.message : "Unknown error";
        }
      }
    }

    // If both failed, return error
    if (failedSources.length > 0 && !tbillRates && !mutualFundRates) {
      return formatError(ErrorCode.NETWORK_ERROR, `Failed to fetch rate data: ${errorDetails}`);
    }

    // Format response
    return {
      success: true,
      data: {
        ...(tbillRates && { tbill_rates: tbillRates }),
        ...(mutualFundRates && { mutual_fund_rates: mutualFundRates }),
        metadata: {
          as_of_date: asOfDate || treasurySourceDate || new Date().toISOString().split("T")[0],
          last_updated: new Date().toISOString(),
          source_url: RHO_TREASURY_URL,
          treasury_source_date: treasurySourceDate || "N/A",
          cache_hit: false, // Will be set by cache layer
          ...(failedSources.length > 0 && {
            partial_response: true,
            failed_sources: failedSources,
            error_details: errorDetails,
          }),
        },
      },
    };
  } catch (error) {
    console.error(`[RatesService] Error:`, error);

    if (error instanceof ValidationError) {
      return formatError(ErrorCode.INVALID_INPUT, error.message);
    }

    return formatError(
      ErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
}

/**
 * Get T-Bill rates (cached or fresh)
 */
async function getTBillRates(
  forceRefresh: boolean
): Promise<{ rates: TierRates; date: string } | null> {
  if (!forceRefresh) {
    const cached = cache.get<{ rates: TierRates; date: string }>(TREASURY_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  try {
    const treasuryData = await fetchTreasuryRates();
    const rates = calculateTBillTiers(treasuryData.threeMonthRate);
    const result = { rates, date: treasuryData.date };

    cache.set(TREASURY_CACHE_KEY, result, TREASURY_CACHE_TTL);
    return result;
  } catch (error) {
    console.error(`[RatesService] Failed to fetch T-Bill rates:`, error);
    throw error;
  }
}

/**
 * Get Mutual Fund rates (cached or fresh)
 */
async function getMutualFundRates(
  forceRefresh: boolean
): Promise<{ rates: TierRates; asOfDate: string } | null> {
  if (!forceRefresh) {
    const cached = cache.get<{ rates: TierRates; asOfDate: string }>(RHO_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  try {
    const rhoData = await scrapeRhoRates();
    const result = { rates: rhoData.mutualFundRates, asOfDate: rhoData.asOfDate };

    cache.set(RHO_CACHE_KEY, result, RHO_CACHE_TTL);
    return result;
  } catch (error) {
    console.error(`[RatesService] Failed to fetch Mutual Fund rates:`, error);
    throw error;
  }
}

/**
 * Filter rates by specific tier
 */
function filterByTier(rates: TierRates, tier: RateTier): Partial<TierRates> {
  return { [tier]: rates[tier] };
}

/**
 * Validate input parameters
 */
function validateInput(params: GetRatesInput): void {
  const validTiers = ["20M+", "10-20M", "5-10M", "2-5M", "350K-2M", "all"];
  const validInvestmentTypes = ["mutual_fund", "tbills", "both"];

  if (params.tier && !validTiers.includes(params.tier)) {
    throw new ValidationError(invalidInputMessage("tier", params.tier, validTiers));
  }

  if (params.investment_type && !validInvestmentTypes.includes(params.investment_type)) {
    throw new ValidationError(
      invalidInputMessage("investment_type", params.investment_type, validInvestmentTypes)
    );
  }
}

/**
 * Custom validation error
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
