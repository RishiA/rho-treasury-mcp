/**
 * Rho website scraper
 * Scrapes mutual fund rates from Rho's treasury page
 */

import * as cheerio from "cheerio";
import { RhoScrapedData, RateTier } from "../types.js";
import { RHO_TREASURY_URL, REQUEST_TIMEOUT, USER_AGENT } from "../config.js";

/**
 * Scrape mutual fund rates from Rho's website
 */
export async function scrapeRhoRates(): Promise<RhoScrapedData> {
  console.error(`[Rho Scraper] Fetching from: ${RHO_TREASURY_URL}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(RHO_TREASURY_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return parseRhoHTML(html);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`);
    }
    throw error;
  }
}

/**
 * Parse Rho's HTML to extract mutual fund rates and as-of date
 */
function parseRhoHTML(html: string): RhoScrapedData {
  const $ = cheerio.load(html);

  // Extract as-of date from disclaimers
  const asOfDate = extractAsOfDate($, html);

  // Find the rate table - look for table with "Mutual Fund" header
  const mutualFundRates = extractMutualFundRates($);

  console.error(`[Rho Scraper] Parsed ${Object.keys(mutualFundRates).length} rates, as of: ${asOfDate}`);

  return {
    mutualFundRates,
    asOfDate,
  };
}

/**
 * Extract mutual fund rates from the table
 */
function extractMutualFundRates($: cheerio.CheerioAPI): Record<RateTier, string> {
  const rates: Partial<Record<RateTier, string>> = {};

  // Look for table containing rate data
  // The table has headers with "Mutual Fund Net Yield" text
  $("table").each((_, table) => {
    const tableText = $(table).text();
    if (tableText.includes("Mutual Fund") || tableText.includes("Net Yield")) {
      // Found the right table, now extract rows
      $(table)
        .find("tr")
        .each((_, row) => {
          const cells = $(row).find("td");
          if (cells.length >= 2) {
            const tierText = $(cells[0]).text().trim();
            const rateText = $(cells[1]).text().trim();

            // Normalize tier text to our format
            const tier = normalizeTierName(tierText);
            if (tier) {
              rates[tier] = normalizeRate(rateText);
              console.error(`[Rho Scraper] Found ${tier}: ${rateText} -> ${rates[tier]}`);
            }
          }
        });
    }
  });

  // Validate we got all 5 tiers
  const expectedTiers: RateTier[] = ["20M+", "10-20M", "5-10M", "2-5M", "350K-2M"];
  const missingTiers = expectedTiers.filter((tier) => !rates[tier]);

  if (missingTiers.length > 0) {
    throw new Error(
      `Failed to extract all rate tiers. Missing: ${missingTiers.join(", ")}. ` +
        `Found: ${Object.keys(rates).join(", ")}. ` +
        `The website structure may have changed.`
    );
  }

  // Return in descending order (largest deposits first)
  return {
    "20M+": rates["20M+"]!,
    "10-20M": rates["10-20M"]!,
    "5-10M": rates["5-10M"]!,
    "2-5M": rates["2-5M"]!,
    "350K-2M": rates["350K-2M"]!,
  };
}

/**
 * Extract as-of date from the page
 */
function extractAsOfDate($: cheerio.CheerioAPI, html: string): string {
  // Look for "as of MM/DD/YYYY" pattern in text
  const asOfMatch = html.match(/as of (\d{2}\/\d{2}\/\d{4})/i);
  if (asOfMatch) {
    // Convert MM/DD/YYYY to YYYY-MM-DD
    const [month, day, year] = asOfMatch[1].split("/");
    const isoDate = `${year}-${month}-${day}`;
    console.error(`[Rho Scraper] Found as-of date: ${isoDate}`);
    return isoDate;
  }

  // Fallback to current date if not found
  const fallbackDate = new Date().toISOString().split("T")[0];
  console.error(`[Rho Scraper] Warning: Could not find as-of date, using current date: ${fallbackDate}`);
  return fallbackDate;
}

/**
 * Normalize tier name from various formats to our standard format
 * Examples:
 *   "> $20M" -> "20M+"
 *   "$10-20M" -> "10-20M"
 *   "$350K-2M" -> "350K-2M"
 */
function normalizeTierName(tierText: string): RateTier | null {
  const cleaned = tierText.replace(/\$/g, "").replace(/\s+/g, "").trim();

  // Match patterns
  if (cleaned.match(/^>20M/i) || cleaned.match(/^20M\+/i)) {
    return "20M+";
  }
  if (cleaned.match(/^10-?20M/i)) {
    return "10-20M";
  }
  if (cleaned.match(/^5-?10M/i)) {
    return "5-10M";
  }
  if (cleaned.match(/^2-?5M/i)) {
    return "2-5M";
  }
  if (cleaned.match(/^350K-?2M/i)) {
    return "350K-2M";
  }

  return null;
}

/**
 * Normalize rate format to "X.XX%"
 * Examples:
 *   "3.93%" -> "3.93%"
 *   "3.93" -> "3.93%"
 *   "3.9%" -> "3.90%"
 */
function normalizeRate(rateText: string): string {
  // Remove everything except digits and decimal point
  const numeric = rateText.replace(/[^\d.]/g, "");
  const parsed = parseFloat(numeric);

  if (isNaN(parsed)) {
    throw new Error(`Invalid rate format: "${rateText}"`);
  }

  return parsed.toFixed(2) + "%";
}
