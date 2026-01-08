# Rho Treasury MCP Server - Implementation Plan

## Project Overview

Build an MCP (Model Context Protocol) server that provides programmatic access to Rho's treasury rates across all deposit tiers and investment types.

### Goals
1. **Learning**: Master MCP server architecture and protocol
2. **Accuracy**: Return exact rates matching Rho's public website
3. **Reliability**: Robust error handling and caching
4. **Professional**: Production-ready code ready to demonstrate

---

## Data Strategy

### Hybrid Approach (Recommended)

Based on analysis of Rho's codebase, we'll use:

1. **Treasury.gov Public API** → T-Bill rates
   - Source: `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/{year}/all`
   - Data: Real 3-month Treasury rate
   - Calculation: Apply Rho's tier spreads (-0.15% to -0.60%)
   - Accuracy: ✅ Exact match to Rho's published T-Bill rates

2. **Web Scraping** → Mutual Fund rates
   - Source: `https://www.rho.co/product/treasury`
   - Data: All 5 tiers of mutual fund rates
   - Method: Parse HTML table
   - Accuracy: ✅ Exact match (scrapes what users see)

### Why This Approach?

**T-Bill Rates**: Treasury.gov is Rho's source, so we get identical data
**Mutual Fund Rates**: Rho stores reference rate in private Supabase DB, scraping ensures accuracy

---

## MCP Server Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Claude Desktop / Client                 │
└───────────────────────┬──────────────────────────────────┘
                        │
                        │ MCP Protocol (stdio)
                        │
┌───────────────────────▼──────────────────────────────────┐
│                Rho Treasury MCP Server                   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │            index.ts (Main Server)                │   │
│  │  • Tool registration                             │   │
│  │  • Request/response handling                     │   │
│  │  • Error formatting                              │   │
│  └────────────────────┬─────────────────────────────┘   │
│                       │                                   │
│  ┌────────────────────▼────────────────────────────┐   │
│  │         ratesService.ts (Orchestrator)          │   │
│  │  • Coordinates data fetching                    │   │
│  │  • Applies tier calculations                    │   │
│  │  • Formats final response                       │   │
│  └──────────┬──────────────────────┬─────────────┘   │
│             │                       │                   │
│  ┌──────────▼──────────┐ ┌─────────▼──────────────┐   │
│  │  treasuryGov.ts     │ │   rhoScraper.ts        │   │
│  │  • Fetch CSV data   │ │   • Fetch Rho page     │   │
│  │  • Parse rates      │ │   • Parse HTML table   │   │
│  │  • Calculate tiers  │ │   • Extract MF rates   │   │
│  └──────────┬──────────┘ └─────────┬──────────────┘   │
│             │                       │                   │
│  ┌──────────▼───────────────────────▼──────────────┐   │
│  │              cache.ts (Layer)                    │   │
│  │  • In-memory storage                             │   │
│  │  • TTL: 1 hour for Treasury, 24h for Rho        │   │
│  │  • Timestamp tracking                            │   │
│  │  • Stale data handling                           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │            types.ts (Definitions)                │   │
│  │  • Rate structures                               │   │
│  │  • API responses                                 │   │
│  │  • Error types                                   │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
           │                            │
           │                            │
┌──────────▼────────────┐   ┌───────────▼──────────────┐
│   Treasury.gov API    │   │   Rho Website            │
│   (Public, No Auth)   │   │   (Public HTML)          │
└───────────────────────┘   └──────────────────────────┘
```

---

## MCP Tool Definition

### Tool: `get_rho_treasury_rates`

**Description**: Retrieve current treasury yield rates offered by Rho across all deposit tiers and investment types.

**Input Schema**:
```typescript
{
  type: "object",
  properties: {
    tier: {
      type: "string",
      enum: ["350K-2M", "2-5M", "5-10M", "10-20M", "20M+", "all"],
      description: "Deposit tier (default: 'all')",
      default: "all"
    },
    investment_type: {
      type: "string",
      enum: ["mutual_fund", "tbills", "both"],
      description: "Investment type (default: 'both')",
      default: "both"
    },
    force_refresh: {
      type: "boolean",
      description: "Bypass cache and fetch fresh data",
      default: false
    }
  }
}
```

**Output Schema**:
```typescript
{
  success: boolean;
  data?: {
    mutual_fund_rates?: {
      "350K-2M": string;    // e.g., "3.48%"
      "2-5M": string;       // e.g., "3.63%"
      "5-10M": string;      // e.g., "3.73%"
      "10-20M": string;     // e.g., "3.83%"
      "20M+": string;       // e.g., "3.93%"
    };
    tbill_rates?: {
      "350K-2M": string;
      "2-5M": string;
      "5-10M": string;
      "10-20M": string;
      "20M+": string;
    };
    metadata: {
      as_of_date: string;           // ISO 8601 date
      last_updated: string;         // ISO 8601 timestamp
      source_url: string;           // Rho website URL
      treasury_source_date: string; // Treasury.gov date
      cache_hit: boolean;           // Was this cached?
    };
  };
  error?: {
    code: string;
    message: string;
    timestamp: string;
  };
}
```

**Example Responses**:

```typescript
// Success - All rates
{
  "success": true,
  "data": {
    "mutual_fund_rates": {
      "350K-2M": "3.48%",
      "2-5M": "3.63%",
      "5-10M": "3.73%",
      "10-20M": "3.83%",
      "20M+": "3.93%"
    },
    "tbill_rates": {
      "350K-2M": "3.35%",
      "2-5M": "3.50%",
      "5-10M": "3.60%",
      "10-20M": "3.70%",
      "20M+": "3.80%"
    },
    "metadata": {
      "as_of_date": "2026-01-08",
      "last_updated": "2026-01-08T18:01:00Z",
      "source_url": "https://www.rho.co/product/treasury",
      "treasury_source_date": "2026-01-07",
      "cache_hit": false
    }
  }
}

// Success - Single tier, T-Bills only
{
  "success": true,
  "data": {
    "tbill_rates": {
      "20M+": "3.80%"
    },
    "metadata": { /* ... */ }
  }
}

// Error - Scraping failed
{
  "success": false,
  "error": {
    "code": "SCRAPE_FAILED",
    "message": "Failed to fetch rates from Rho website: HTTP 503",
    "timestamp": "2026-01-08T18:01:00Z"
  }
}

// Error - Parsing failed
{
  "success": false,
  "error": {
    "code": "PARSE_ERROR",
    "message": "Unable to parse rate data - website structure may have changed",
    "timestamp": "2026-01-08T18:01:00Z"
  }
}
```

---

## Technology Stack

### Core Dependencies
- **Runtime**: Node.js v18+ (LTS)
- **Language**: TypeScript v5+
- **MCP SDK**: `@modelcontextprotocol/sdk`

### Data Fetching
- **HTTP Client**: `node-fetch` (native in Node 18+)
- **HTML Parser**: `cheerio` (jQuery-like syntax)
- **CSV Parser**: Built-in string parsing

### Development
- **Build**: `tsx` (TypeScript execution)
- **Type Checking**: `tsc` (TypeScript compiler)
- **Linting**: `eslint` + `@typescript-eslint` (optional)
- **Formatting**: `prettier` (optional)

### Testing (Phase 2)
- **Unit Tests**: `vitest` (fast, modern)
- **Integration Tests**: Manual via Claude Desktop

---

## Implementation Roadmap

### Phase 1: Foundation (Days 1-2)

#### Step 1.1: Project Setup
**Goal**: Initialize project with proper structure

**Tasks**:
- [x] Create `rho-treasury-mcp` directory
- [ ] Initialize npm project (`npm init`)
- [ ] Install dependencies
- [ ] Configure TypeScript (`tsconfig.json`)
- [ ] Create directory structure:
  ```
  rho-treasury-mcp/
  ├── src/
  │   ├── index.ts          # Main MCP server
  │   ├── types.ts          # Type definitions
  │   ├── services/
  │   │   ├── ratesService.ts     # Main orchestrator
  │   │   ├── treasuryGov.ts      # Treasury.gov fetcher
  │   │   └── rhoScraper.ts       # Rho website scraper
  │   ├── utils/
  │   │   ├── cache.ts            # Caching layer
  │   │   └── errors.ts           # Error utilities
  │   └── config.ts         # Configuration
  ├── package.json
  ├── tsconfig.json
  ├── README.md
  └── [planning docs - claude.md, decisions.md, plan.md]
  ```

**Deliverable**: Working TypeScript project structure

---

#### Step 1.2: Type Definitions
**Goal**: Define all interfaces and types

**File**: `src/types.ts`

**Content**:
```typescript
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

// Tier rates structure
export interface TierRates {
  "350K-2M": string;
  "2-5M": string;
  "5-10M": string;
  "10-20M": string;
  "20M+": string;
}

// Tool input parameters
export interface GetRatesInput {
  tier?: RateTier | "all";
  investment_type?: InvestmentType;
  force_refresh?: boolean;
}

// Tool output structure
export interface RatesResponse {
  success: boolean;
  data?: {
    mutual_fund_rates?: Partial<TierRates>;
    tbill_rates?: Partial<TierRates>;
    metadata: {
      as_of_date: string;
      last_updated: string;
      source_url: string;
      treasury_source_date: string;
      cache_hit: boolean;
    };
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
}

// Cache entry structure
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}
```

**Deliverable**: Complete type definitions

---

### Phase 2: Data Fetchers (Days 2-4)

#### Step 2.1: Treasury.gov Fetcher
**Goal**: Fetch and parse Treasury rates from official API

**File**: `src/services/treasuryGov.ts`

**Key Functions**:
```typescript
/**
 * Fetch current 3-month Treasury rate from Treasury.gov
 * Returns: { date, threeMonthRate, sixMonthRate, oneYearRate }
 */
export async function fetchTreasuryRates(): Promise<TreasuryGovData>

/**
 * Calculate T-Bill rates across all tiers using Rho's spread formula
 * Spreads: tier1 (-0.15%), tier2 (-0.25%), tier3 (-0.35%),
 *          tier4 (-0.45%), tier5 (-0.60%)
 */
export function calculateTBillTiers(baseRate: number): TierRates
```

**Implementation Details**:
- Fetch CSV from Treasury.gov
- Parse first data row (most recent date)
- Extract 3-month rate from column index 4
- Apply error handling for network/parse failures
- Return structured data

**Test Cases**:
1. Successful fetch → returns valid rate data
2. Network failure → throws descriptive error
3. Malformed CSV → throws parse error
4. Missing rate data → handles gracefully

**Deliverable**: Working Treasury.gov fetcher with tier calculation

---

#### Step 2.2: Rho Website Scraper
**Goal**: Scrape mutual fund rates from Rho's treasury page

**File**: `src/services/rhoScraper.ts`

**Key Functions**:
```typescript
/**
 * Scrape mutual fund rates from Rho's website
 * Returns: { mutualFundRates: { tier: rate }, asOfDate }
 */
export async function scrapeRhoRates(): Promise<RhoScrapedData>

/**
 * Parse HTML table to extract rate values
 * Handles various table structures and formats
 */
function parseRateTable(html: string): Record<RateTier, string>
```

**Implementation Details**:
- Fetch HTML from `https://www.rho.co/product/treasury`
- Use Cheerio to parse DOM
- Locate rate table (inspect page for CSS selectors)
- Extract all 5 tier rates
- Extract "as of" date
- Format rates consistently (e.g., "3.48%")

**Edge Cases**:
- Rate table not found → throw descriptive error
- Malformed rate values → handle/sanitize
- Missing tiers → partial data or error
- "as of" date missing → use current date with warning

**Test Cases**:
1. Successful scrape → returns all 5 rates
2. HTTP error → throws with status code
3. Table structure changed → descriptive parse error
4. Rate format variation → handles gracefully

**Deliverable**: Working Rho scraper with robust parsing

---

#### Step 2.3: Cache Layer
**Goal**: Implement caching to minimize external requests

**File**: `src/utils/cache.ts`

**Key Features**:
```typescript
class Cache<T> {
  /**
   * Store data with TTL
   */
  set(key: string, data: T, ttlMs: number): void

  /**
   * Retrieve data if not expired
   */
  get(key: string): T | null

  /**
   * Check if cache entry is still valid
   */
  isValid(key: string): boolean

  /**
   * Clear specific cache entry
   */
  clear(key: string): void

  /**
   * Clear all cache entries
   */
  clearAll(): void
}
```

**Cache Strategy**:
- Treasury.gov data: 1 hour TTL (updated daily, but check hourly)
- Rho scraped data: 24 hour TTL (rates update infrequently)
- Store timestamps for staleness detection
- In-memory storage (simple Map)

**Why These TTLs?**
- **Treasury**: Official rates update daily, 1-hour cache balances freshness vs. request volume
- **Rho**: Marketing page rates are stable, 24-hour cache is respectful

**Deliverable**: Reusable cache utility

---

### Phase 3: Service Orchestration (Day 4-5)

#### Step 3.1: Rates Service
**Goal**: Coordinate data fetching and formatting

**File**: `src/services/ratesService.ts`

**Key Functions**:
```typescript
/**
 * Main function to get rates based on user parameters
 */
export async function getRates(params: GetRatesInput): Promise<RatesResponse>

/**
 * Fetch T-Bill rates (cached or fresh)
 */
async function getTBillRates(forceRefresh: boolean): Promise<TierRates>

/**
 * Fetch Mutual Fund rates (cached or fresh)
 */
async function getMutualFundRates(forceRefresh: boolean): Promise<TierRates>

/**
 * Filter rates by tier if specified
 */
function filterByTier(rates: TierRates, tier: string): Partial<TierRates>

/**
 * Format final response with metadata
 */
function formatResponse(/* ... */): RatesResponse
```

**Logic Flow**:
1. Check `investment_type` parameter
2. Fetch required data (T-Bills and/or Mutual Funds)
3. Use cache unless `force_refresh = true`
4. Apply tier filtering if specified
5. Format response with metadata
6. Handle errors gracefully

**Error Handling**:
- Catch all errors from fetchers
- Return structured error responses
- Include helpful error messages
- Log errors for debugging

**Deliverable**: Complete rates orchestration service

---

### Phase 4: MCP Server (Day 5-6)

#### Step 4.1: MCP Server Implementation
**Goal**: Build the MCP server with tool registration

**File**: `src/index.ts`

**Structure**:
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getRates } from "./services/ratesService.js";

// Create MCP server instance
const server = new Server(
  {
    name: "rho-treasury-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool: get_rho_treasury_rates
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_rho_treasury_rates",
        description: "Retrieve current treasury yield rates from Rho across all deposit tiers",
        inputSchema: {
          type: "object",
          properties: {
            tier: {
              type: "string",
              enum: ["350K-2M", "2-5M", "5-10M", "10-20M", "20M+", "all"],
              description: "Deposit tier (default: 'all')",
            },
            investment_type: {
              type: "string",
              enum: ["mutual_fund", "tbills", "both"],
              description: "Investment type (default: 'both')",
            },
            force_refresh: {
              type: "boolean",
              description: "Bypass cache and fetch fresh data",
            },
          },
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_rho_treasury_rates") {
    const params = request.params.arguments as GetRatesInput;

    try {
      const result = await getRates(params);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      // Return formatted error
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: error.message,
                timestamp: new Date().toISOString(),
              },
            }, null, 2),
          },
        ],
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Rho Treasury MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

**Key Points**:
- Use stdio transport (Claude Desktop requirement)
- Register single tool with schema
- Handle tool calls and return formatted responses
- Comprehensive error handling
- Logging to stderr (stdout reserved for MCP protocol)

**Deliverable**: Complete MCP server implementation

---

### Phase 5: Testing & Configuration (Day 6-7)

#### Step 5.1: Local Testing Setup
**Goal**: Test server with Claude Desktop

**Configuration File**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "rho-treasury": {
      "command": "node",
      "args": [
        "/Users/rishi.athanikar/Documents/Github/rho-treasury-mcp/build/index.js"
      ]
    }
  }
}
```

**Build Command**:
```bash
npm run build  # Compile TypeScript to JavaScript
```

**Testing Checklist**:
- [ ] Server starts without errors
- [ ] Tool appears in Claude Desktop
- [ ] Fetch all rates (default parameters)
- [ ] Fetch single tier: `{"tier": "20M+"}`
- [ ] Fetch T-Bills only: `{"investment_type": "tbills"}`
- [ ] Fetch Mutual Funds only: `{"investment_type": "mutual_fund"}`
- [ ] Force refresh: `{"force_refresh": true}`
- [ ] Invalid tier → error handling
- [ ] Network failure simulation
- [ ] Cache behavior (second call should be faster)
- [ ] Verify rates match Rho's website

**Debugging**:
- Check stderr output for logs
- Verify JSON responses are valid
- Test error scenarios
- Validate rate accuracy against Rho website

**Deliverable**: Verified working MCP server in Claude Desktop

---

#### Step 5.2: Documentation
**Goal**: Comprehensive project documentation

**README.md Structure**:

```markdown
# Rho Treasury MCP Server

> Programmatic access to Rho's treasury rates via Model Context Protocol

## Overview
[What it does, why it exists, who it's for]

## Features
- Real-time treasury rates from Rho
- Support for all 5 deposit tiers
- Mutual fund and T-Bill rates
- Built-in caching for performance
- Robust error handling

## Installation
[Step-by-step setup instructions]

## Usage
[How to use with Claude Desktop, example queries]

## API Reference
[Tool schema, parameters, responses]

## Architecture
[High-level design diagram and explanations]

## Data Sources
- Treasury.gov API (T-Bill rates)
- Rho website scraping (Mutual Fund rates)

## Development
[Local development, building, testing]

## Troubleshooting
[Common issues and solutions]

## Roadmap
[Future enhancements]

## License
MIT
```

**Additional Documentation**:
- API examples with real responses
- Architecture decision rationale
- Comparison with competitors (Ramp, Mercury, Brex)
- "Why I Built This" section for Rho interview

**Deliverable**: Complete README.md

---

## Error Handling Strategy

### Error Categories

1. **Network Errors**
   - Treasury.gov unreachable
   - Rho website down
   - Timeout scenarios
   - Response: Return cached data with staleness warning if available

2. **Parsing Errors**
   - CSV format changed (Treasury.gov)
   - HTML structure changed (Rho website)
   - Malformed rate values
   - Response: Detailed error message indicating what failed

3. **Validation Errors**
   - Invalid tier parameter
   - Invalid investment type
   - Response: Clear validation error with valid options

4. **Cache Errors**
   - Cache corruption
   - Memory issues
   - Response: Bypass cache, fetch fresh data

### Fallback Strategy

**Priority Order**:
1. Fresh fetch (if no cache or force_refresh)
2. Valid cache (within TTL)
3. Stale cache (with warning)
4. Error response (only if all above fail)

**Never**:
- Return empty/undefined without explanation
- Crash the server
- Return misleading data

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Cache hit response | < 50ms | In-memory lookup |
| Fresh fetch (T-Bills) | < 2s | Treasury.gov API |
| Fresh fetch (Mutual Funds) | < 3s | Rho scraping |
| Combined fetch (both) | < 4s | Parallel fetching |
| Cache TTL (Treasury) | 1 hour | Balance freshness/load |
| Cache TTL (Rho) | 24 hours | Respectful scraping |
| Error response time | < 100ms | Immediate failure |

---

## Security & Best Practices

### Web Scraping Ethics
- ✅ Public data only (no authentication required)
- ✅ Respectful caching (24-hour TTL for Rho)
- ✅ User-Agent header identifying our client
- ✅ Follow robots.txt (check if exists)
- ✅ No aggressive retry loops
- ❌ No circumventing rate limits
- ❌ No scraping private/authenticated pages

### Code Quality
- TypeScript strict mode enabled
- Async/await for all I/O operations
- Proper error types and messages
- Comprehensive input validation
- Clear logging for debugging
- No secrets in code (environment variables if needed)

---

## Success Criteria

### Technical Success
- [ ] MCP server runs without crashes
- [ ] Rates match Rho's website exactly
- [ ] Cache reduces fetch frequency
- [ ] All error scenarios handled gracefully
- [ ] Response times meet targets
- [ ] Works seamlessly with Claude Desktop

### Learning Success
- [ ] Can explain MCP protocol in detail
- [ ] Understand server architecture decisions
- [ ] Comfortable with TypeScript async patterns
- [ ] Know web scraping best practices
- [ ] Can debug MCP integration issues

### Professional Success
- [ ] Code is clean and maintainable
- [ ] Documentation is comprehensive
- [ ] Project demonstrates product thinking
- [ ] Ready to present to Rho team
- [ ] Foundation for future enhancements

---

## Timeline Summary

| Phase | Days | Focus | Key Deliverable |
|-------|------|-------|-----------------|
| 1 | 1-2 | Foundation | Project structure + types |
| 2 | 2-4 | Data Fetchers | Treasury + Rho scrapers working |
| 3 | 4-5 | Orchestration | Rates service complete |
| 4 | 5-6 | MCP Server | Full server implementation |
| 5 | 6-7 | Testing & Docs | Verified working + README |

**Total: 7 days to production-ready MCP server**

---

## Future Enhancements (Post-MVP)

### Phase 2: Competitor Comparison
- Add Mercury rates scraper
- Add Ramp rates scraper
- Add Brex rates scraper
- New tool: `compare_treasury_rates`

### Phase 3: Historical Data
- Store rate history in SQLite
- Track rate changes over time
- New tool: `get_rate_history`
- Trend analysis and insights

### Phase 4: Deployment
- Deploy to Vercel as serverless function
- Add monitoring and alerting
- Public MCP server endpoint
- Rate limiting and usage analytics

### Phase 5: Enhanced Features
- Email alerts for rate changes
- Rate change notifications
- Custom tier calculations
- Multi-currency support (if Rho expands)

---

## Risk Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Rho changes website structure | High | Medium | Robust selectors, detailed error messages, quick fix plan |
| Treasury.gov API unavailable | Medium | Low | Fallback to cached data, clear error messages |
| Rate limiting / IP blocking | Medium | Low | Respectful caching (24h), user-agent header |
| MCP SDK learning curve | Low | Medium | Study examples, start simple, iterate |
| Time constraints (7 days) | Medium | Medium | Focus on MVP, cut nice-to-haves |

---

## Definition of Done

Phase 1 (MVP) is complete when:

- [ ] MCP server successfully fetches Rho treasury rates
- [ ] Works with Claude Desktop locally
- [ ] All error cases handled gracefully
- [ ] Cache reduces unnecessary requests
- [ ] Rates exactly match Rho's website
- [ ] README is comprehensive and professional
- [ ] Code is clean, typed, and maintainable
- [ ] Ready to demonstrate on Day 1 at Rho

---

## Next Steps

1. ✅ Review this plan thoroughly
2. ✅ Review decisions.md for architectural choices
3. ✅ Review claude.md for context
4. ⏭️ Begin implementation: Step 1.1 (Project Setup)
5. Track progress daily against this plan
6. Adjust timeline based on actual progress

**Ready to build!**
