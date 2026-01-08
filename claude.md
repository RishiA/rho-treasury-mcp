# Claude Context: Rho Treasury MCP Server

This document provides comprehensive context for Claude to assist with this project effectively.

---

## Project Identity

**Name**: Rho Treasury MCP Server
**Type**: Model Context Protocol (MCP) Server
**Purpose**: Programmatic access to Rho's treasury rates via MCP
**Status**: Planning → Implementation
**Developer**: Rishi Athanikar
**Context**: Learning project + interview demonstration for Rho Platform Product role

---

## What This Project Does

### End-User Perspective
A Claude Desktop user can ask:
> "What are the current Rho treasury rates for a $15M deposit?"

Claude (via this MCP server) responds:
> "For a $15M deposit (tier: 10-20M), Rho offers:
> - Mutual Fund: 3.83%
> - T-Bills: 3.70%
>
> As of January 8, 2026"

### Technical Perspective
This is an MCP server that:
1. Fetches real treasury rates from two sources
2. Formats data according to user parameters
3. Returns structured JSON via MCP protocol
4. Integrates seamlessly with Claude Desktop

---

## Why This Project Exists

### 1. **Learning Objective**
- Master MCP server architecture and protocol
- Understand tool definition and request handling
- Practice TypeScript async patterns
- Learn web scraping best practices

### 2. **Strategic Context**
Rishi is joining Rho as a Platform Product Manager. This project demonstrates:
- **Technical depth**: Can build functional prototypes
- **Product thinking**: Identifies gaps (Ramp has MCP, Rho doesn't)
- **Customer empathy**: Validates demand for programmatic access
- **Execution**: Ships working code in 7 days

### 3. **Competitive Context**
- **Ramp**: Has MCP server
- **Mercury**: Has public API
- **Brex**: Has public API
- **Rho**: No MCP, no public API ❌

This prototype validates the opportunity.

---

## Key Insights from Codebase Analysis

### Discovery 1: Rho's Rate Architecture
From analyzing `UnderTechnologies/marketing-website`:

**File**: `src/app/_providers/TreasureRatesProvider.tsx`
```typescript
// Rho calculates rates using this formula:
const tier1Rate = referenceRate - 0.15;  // 20M+
const tier2Rate = referenceRate - 0.25;  // 10-20M
const tier3Rate = referenceRate - 0.35;  // 5-10M
const tier4Rate = referenceRate - 0.45;  // 2-5M
const tier5Rate = referenceRate - 0.60;  // 350K-2M
```

**Key Insight**: Rates are calculated, not hardcoded!

### Discovery 2: Data Sources
**File**: `src/app/[lang]/layout.tsx`
```typescript
const [supabaseRates, treasuryRates] = await Promise.allSettled([
  getRatesFromSupabase(),      // Private DB, has reference rate
  getTreasuryRatesFromGov()    // Public API, has T-Bill base rate
]);
```

**Two sources**:
1. **Supabase**: Reference rate for mutual funds (private)
2. **Treasury.gov**: 3-month rate for T-Bills (public)

### Discovery 3: Implication for Our MCP Server
- ✅ We can access Treasury.gov (public API)
- ❌ We can't access Supabase (requires API key)
- ✅ We can calculate T-Bill rates exactly (formula + public data)
- ❌ We can't calculate Mutual Fund rates (need private reference rate)
- ✅ Solution: Scrape final Mutual Fund rates from Rho's website

---

## Architecture Overview

### High-Level Flow
```
User asks Claude → Claude calls MCP tool → MCP server fetches data → Returns formatted response
```

### Data Flow (Detailed)
```
┌──────────────────────────────────────────────────────┐
│ User: "Get Rho rates for $12M"                       │
└────────────────────┬─────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────┐
│ Claude Desktop calls:                                │
│ get_rho_treasury_rates({                             │
│   tier: "10-20M",                                    │
│   investment_type: "both"                            │
│ })                                                   │
└────────────────────┬─────────────────────────────────┘
                     │ MCP Protocol (stdio)
┌────────────────────▼─────────────────────────────────┐
│ Rho Treasury MCP Server                              │
│                                                      │
│ 1. Check cache                                       │
│    ├─ Hit? Return cached data                       │
│    └─ Miss? Fetch fresh data                        │
│                                                      │
│ 2. Fetch (parallel):                                 │
│    ├─ treasuryGov.ts → Get 3-month rate            │
│    │   └─ Calculate T-Bill tiers                    │
│    │                                                 │
│    └─ rhoScraper.ts → Scrape Rho website           │
│        └─ Parse Mutual Fund rate table              │
│                                                      │
│ 3. Cache results (1h for Treasury, 24h for Rho)    │
│                                                      │
│ 4. Format response:                                  │
│    └─ Filter by tier (10-20M)                       │
│    └─ Include both rate types                       │
│    └─ Add metadata                                   │
└────────────────────┬─────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────┐
│ Response:                                            │
│ {                                                    │
│   "mutual_fund_rates": { "10-20M": "3.83%" },      │
│   "tbill_rates": { "10-20M": "3.70%" },            │
│   "metadata": { ... }                               │
│ }                                                    │
└──────────────────────────────────────────────────────┘
```

---

## Project Structure

```
rho-treasury-mcp/
├── src/
│   ├── index.ts                    # Main MCP server entry point
│   │                               # - Registers tools
│   │                               # - Handles tool calls
│   │                               # - Stdio transport
│   │
│   ├── types.ts                    # TypeScript type definitions
│   │                               # - RateTier, InvestmentType
│   │                               # - TreasuryGovData, RhoScrapedData
│   │                               # - GetRatesInput, RatesResponse
│   │                               # - ErrorCode enum
│   │
│   ├── services/
│   │   ├── ratesService.ts        # Main orchestrator
│   │   │                          # - getRates() - main entry point
│   │   │                          # - Coordinates fetchers
│   │   │                          # - Applies tier filtering
│   │   │                          # - Formats responses
│   │   │
│   │   ├── treasuryGov.ts         # Treasury.gov API client
│   │   │                          # - Fetches CSV from Treasury.gov
│   │   │                          # - Parses 3-month rate
│   │   │                          # - Calculates T-Bill tiers
│   │   │
│   │   └── rhoScraper.ts          # Rho website scraper
│   │                               # - Fetches Rho treasury page
│   │                               # - Parses HTML table (Cheerio)
│   │                               # - Extracts Mutual Fund rates
│   │
│   ├── utils/
│   │   ├── cache.ts               # In-memory cache implementation
│   │   │                          # - TTL management
│   │   │                          # - get/set/clear methods
│   │   │
│   │   └── errors.ts              # Error utilities
│   │                               # - formatError()
│   │                               # - Error message templates
│   │
│   └── config.ts                  # Configuration constants
│                                   # - URLs, TTLs, timeouts
│
├── build/                         # Compiled JavaScript (gitignored)
├── package.json                   # Dependencies & scripts
├── tsconfig.json                  # TypeScript config
├── README.md                      # User-facing documentation
├── plan.md                        # Implementation roadmap
├── decisions.md                   # Architecture decisions
└── claude.md                      # This file
```

---

## Data Sources Deep Dive

### Source 1: Treasury.gov API

**URL**:
```
https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv
```

**Format**: CSV
**Update Frequency**: Daily (business days)
**Authentication**: None (public)
**Rate Used**: 3-month Treasury rate

**Example Response**:
```csv
Date,1 Mo,2 Mo,3 Mo,4 Mo,6 Mo,1 Yr,2 Yr,3 Yr,5 Yr,7 Yr,10 Yr,20 Yr,30 Yr
01/07/2026,4.35,4.40,4.45,4.47,4.50,4.55,4.60,4.65,4.70,4.75,4.80,4.85,4.90
01/06/2026,4.33,4.38,4.43,...
```

**Parsing**:
- Split by newline → get line index 1 (most recent)
- Split by comma → get column index 4 (3 Mo)
- Parse as float → `4.45`

**T-Bill Calculation**:
```typescript
threeMonthRate = 4.45;

tierRates = {
  "20M+":    (4.45 - 0.15).toFixed(2) + "%" // "4.30%"
  "10-20M":  (4.45 - 0.25).toFixed(2) + "%" // "4.20%"
  "5-10M":   (4.45 - 0.35).toFixed(2) + "%" // "4.10%"
  "2-5M":    (4.45 - 0.45).toFixed(2) + "%" // "4.00%"
  "350K-2M": (4.45 - 0.60).toFixed(2) + "%" // "3.85%"
}
```

---

### Source 2: Rho Website

**URL**: `https://www.rho.co/product/treasury`

**Format**: HTML
**Update Frequency**: As needed (infrequent)
**Authentication**: None (public page)
**Data**: All 5 tiers of Mutual Fund rates

**HTML Structure** (inspect to confirm):
```html
<!-- Hypothetical structure - need to verify -->
<div class="rate-table">
  <table>
    <tr>
      <td>$20M+</td>
      <td>3.93%</td>
    </tr>
    <tr>
      <td>$10M-$20M</td>
      <td>3.83%</td>
    </tr>
    <!-- ... -->
  </table>
</div>
```

**Parsing Strategy** (Cheerio):
```typescript
import * as cheerio from 'cheerio';

const $ = cheerio.load(html);

// Find the rate table (selector TBD - inspect page)
const rates = {};
$('.rate-table tr').each((i, elem) => {
  const tier = $(elem).find('td').eq(0).text();  // "$20M+"
  const rate = $(elem).find('td').eq(1).text();  // "3.93%"

  // Normalize tier format: "$20M+" → "20M+"
  const normalizedTier = normalizeTierName(tier);
  rates[normalizedTier] = rate;
});
```

**Edge Cases**:
1. Table selector changes → Descriptive parse error
2. Rate format varies ("3.93%" vs "3.93") → Normalize
3. Missing tiers → Partial data or error
4. "As of" date missing → Use current date + warning

---

## MCP Tool Specification

### Tool Name
`get_rho_treasury_rates`

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tier` | string | No | `"all"` | Deposit tier filter |
| `investment_type` | string | No | `"both"` | Investment type filter |
| `force_refresh` | boolean | No | `false` | Bypass cache |

**Valid `tier` values**:
- `"350K-2M"` - Smallest tier
- `"2-5M"`
- `"5-10M"`
- `"10-20M"`
- `"20M+"` - Largest tier
- `"all"` - All tiers (default)

**Valid `investment_type` values**:
- `"mutual_fund"` - Only mutual fund rates
- `"tbills"` - Only T-Bill rates
- `"both"` - Both types (default)

### Output Format

**Success Response**:
```typescript
{
  success: true,
  data: {
    mutual_fund_rates?: {
      "350K-2M": "3.48%",
      "2-5M": "3.63%",
      "5-10M": "3.73%",
      "10-20M": "3.83%",
      "20M+": "3.93%"
    },
    tbill_rates?: {
      "350K-2M": "3.35%",
      "2-5M": "3.50%",
      "5-10M": "3.60%",
      "10-20M": "3.70%",
      "20M+": "3.80%"
    },
    metadata: {
      as_of_date: "2026-01-08",
      last_updated: "2026-01-08T18:00:00Z",
      source_url: "https://www.rho.co/product/treasury",
      treasury_source_date: "2026-01-07",
      cache_hit: false
    }
  }
}
```

**Error Response**:
```typescript
{
  success: false,
  error: {
    code: "SCRAPE_FAILED" | "PARSE_ERROR" | "NETWORK_ERROR" | "INVALID_INPUT" | "CACHE_ERROR",
    message: "Human-readable error description",
    timestamp: "2026-01-08T18:00:00Z"
  }
}
```

---

## Development Workflow

### Setup
```bash
cd rho-treasury-mcp
npm install
```

### Development (Hot Reload)
```bash
npm run dev
# Uses tsx for instant TypeScript execution
```

### Build (Production)
```bash
npm run build
# Compiles TypeScript → JavaScript in build/
```

### Testing with Claude Desktop

**1. Build the project**:
```bash
npm run build
```

**2. Configure Claude Desktop**:

Edit: `~/Library/Application Support/Claude/claude_desktop_config.json`

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

**3. Restart Claude Desktop**

**4. Test queries**:
- "What are Rho's current treasury rates?"
- "Show me Rho's T-Bill rates for $15M"
- "Get mutual fund rates for the 20M+ tier"

### Debugging

**Logs**: Check stderr output
```bash
# Claude Desktop logs (macOS)
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Manual Testing** (without Claude):
```bash
# Send MCP request via stdin
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node build/index.js
```

---

## Common Tasks & Commands

### When Implementation Begins

**Initialize project**:
```bash
npm init -y
npm install @modelcontextprotocol/sdk cheerio node-fetch
npm install -D typescript @types/node tsx
```

**Create tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./build"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Add scripts to package.json**:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node build/index.js"
  },
  "type": "module"
}
```

---

## Testing Strategy

### Unit Tests (Phase 2)
```typescript
// Example test structure
describe('treasuryGov', () => {
  it('fetches current 3-month rate', async () => {
    const data = await fetchTreasuryRates();
    expect(data.threeMonthRate).toBeGreaterThan(0);
  });

  it('calculates T-Bill tiers correctly', () => {
    const tiers = calculateTBillTiers(4.45);
    expect(tiers["20M+"]).toBe("4.30%");
    expect(tiers["350K-2M"]).toBe("3.85%");
  });
});
```

### Integration Tests
Test with Claude Desktop:
1. All rates (default)
2. Single tier filter
3. Investment type filter
4. Combination filters
5. Force refresh
6. Error scenarios (network off, invalid input)

### Accuracy Tests
Compare MCP output to Rho's live website:
```bash
# Automated comparison script (Phase 2)
npm run test:accuracy
```

---

## Error Scenarios & Handling

### 1. Treasury.gov Unreachable
**Cause**: Network issue, API down
**Response**: Return cached T-Bill data with staleness warning
**Fallback**: If no cache, return error with `NETWORK_ERROR` code

### 2. Rho Website Unreachable
**Cause**: Network issue, website down, rate limited
**Response**: Return cached Mutual Fund data with warning
**Fallback**: If no cache, return error with `SCRAPE_FAILED` code

### 3. HTML Structure Changed
**Cause**: Rho updated their website
**Response**: `PARSE_ERROR` with specific selector that failed
**Action**: Developer needs to inspect page and update selectors

### 4. Invalid Input
**Cause**: User provided invalid tier or investment type
**Response**: `INVALID_INPUT` with list of valid options
**Example**: "Invalid tier '100M+'. Valid: 350K-2M, 2-5M, 5-10M, 10-20M, 20M+, all"

### 5. Partial Failure
**Cause**: One source succeeds, other fails
**Response**: Return successful data with metadata indicating partial response
```typescript
{
  "success": true,
  "data": {
    "tbill_rates": { /* ... */ },
    // mutual_fund_rates missing
    "metadata": {
      "partial_response": true,
      "failed_sources": ["mutual_fund"],
      "error_details": "Failed to scrape Rho website: HTTP 503"
    }
  }
}
```

---

## Performance Expectations

| Operation | Target | Notes |
|-----------|--------|-------|
| Cache hit | < 50ms | In-memory lookup |
| Treasury.gov fetch | < 2s | Usually ~500ms |
| Rho scrape | < 3s | Usually ~1s |
| Combined fetch (both) | < 4s | Parallel execution |
| Tool response time (cached) | < 100ms | Formatting overhead |
| Tool response time (fresh) | < 5s | Fetch + format |

---

## Future Roadmap Context

### Phase 2: Competitor Comparison (Weeks 2-3)
Add scrapers for:
- Mercury treasury rates
- Ramp treasury rates
- Brex treasury rates

New tool: `compare_treasury_rates`
```typescript
{
  "providers": ["rho", "mercury", "ramp", "brex"],
  "tier": "20M+",
  "investment_type": "both"
}
```

### Phase 3: Historical Data (Week 4)
- Store rates in SQLite
- Track changes over time
- New tool: `get_rate_history`

### Phase 4: Cloud Deployment (Week 5)
- Deploy to Vercel
- Switch to HTTP/SSE transport
- Public MCP endpoint
- Add rate limiting

---

## Key Files to Reference

1. **plan.md**: Step-by-step implementation roadmap
2. **decisions.md**: All architectural decisions with rationale
3. **Rho's codebase** (for reference):
   - `TreasureRatesProvider.tsx`: Rate calculation logic
   - `getTreasureRatesSupabase.ts`: Supabase integration (can't use)
   - `getTreasuryRatesFromGov.ts`: Treasury.gov fetcher (can replicate)

---

## Questions Claude Might Need Answered

### "What CSS selectors should I use for scraping?"
**Answer**: Inspect `https://www.rho.co/product/treasury` and look for:
- Rate table container (likely `.rate-table`, `[data-rates]`, or similar)
- Individual rate rows
- Tier labels and rate values
- "As of" date element

**Action**: Use browser DevTools → Inspect → find stable selectors

### "How should I handle rate format variations?"
**Answer**: Normalize all rates to "X.XX%" format:
```typescript
function normalizeRate(rate: string): string {
  // Remove non-numeric except decimal point
  const numeric = rate.replace(/[^\d.]/g, '');
  const parsed = parseFloat(numeric);
  return parsed.toFixed(2) + "%";
}

// "3.93%" → "3.93%"
// "3.93" → "3.93%"
// "3.9%" → "3.90%"
```

### "What if Treasury.gov changes their CSV format?"
**Answer**:
1. Current format has 3-month rate at index 4 (column 5)
2. If it changes, error will be descriptive: "Expected numeric rate at column 4, got: [value]"
3. Quick fix: Update column index in `treasuryGov.ts`
4. Long-term: Parse CSV header row to find column dynamically

### "How do I test without waiting for cache to expire?"
**Answer**: Use `force_refresh: true` parameter or call `cache.clear()` manually:
```typescript
// In ratesService.ts or testing code
import { cache } from './utils/cache';
cache.clear('treasury_rates');
cache.clear('rho_rates');
```

---

## Critical Reminders

1. **Always check cache first** (unless `force_refresh`)
2. **Log to stderr, not stdout** (stdout is for MCP protocol)
3. **Validate inputs** before processing
4. **Handle errors gracefully** - never crash the server
5. **Format consistently** - ISO 8601 dates, "X.XX%" rates
6. **Be respectful** - 24h cache for Rho, proper User-Agent
7. **Test accuracy** - compare output to Rho's live website

---

## Success Metrics

### Technical
- ✅ Server runs without crashes for 24+ hours
- ✅ Rates match Rho's website exactly (test 10+ times)
- ✅ Cache hit rate > 80% (most requests cached)
- ✅ Response times meet targets (95th percentile)
- ✅ All error scenarios tested and handled

### Product
- ✅ Claude can answer rate questions naturally
- ✅ Non-technical user could install and use
- ✅ Documentation is clear and complete
- ✅ Code is maintainable by others
- ✅ Demonstrates platform product thinking

---

## When Things Go Wrong

### Server won't start
1. Check `package.json` scripts
2. Verify all dependencies installed (`npm install`)
3. Check TypeScript compilation (`npm run build`)
4. Look for syntax errors in `index.ts`

### Rates don't match Rho's website
1. Verify Treasury.gov rate is current
2. Check spread calculations (-0.15%, -0.25%, etc.)
3. For Mutual Funds: Inspect Rho's page, verify selectors
4. Check rate formatting logic

### Claude Desktop doesn't show the tool
1. Verify `claude_desktop_config.json` path is correct
2. Check server builds without errors (`npm run build`)
3. Restart Claude Desktop
4. Check Claude's MCP logs for errors

### Cache not working
1. Verify TTL is set correctly
2. Check timestamps (system clock correct?)
3. Ensure cache isn't being cleared unintentionally
4. Add debug logs to cache get/set

---

## Context for Future Claude Sessions

When resuming work on this project:

1. **Read this file first** (claude.md) - provides full context
2. **Check plan.md** - see what phase/step we're on
3. **Review decisions.md** - understand why things are built this way
4. **Check completed tasks** - avoid redoing work

**Current Status**: Planning complete, ready for implementation

**Next Step**: Phase 1, Step 1.1 - Project Setup (see plan.md)

---

## Useful Commands Quick Reference

```bash
# Install dependencies
npm install

# Development with hot reload
npm run dev

# Build for production
npm run build

# Run built server
npm start

# Test MCP tool listing
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node build/index.js

# Test tool execution (after building)
echo '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_rho_treasury_rates",
    "arguments": {"tier": "20M+"}
  }
}' | node build/index.js

# Check Claude Desktop logs (macOS)
tail -f ~/Library/Logs/Claude/mcp*.log

# Inspect Rho's website structure
open https://www.rho.co/product/treasury
```

---

## Final Notes

This project is:
- ✅ **Well-defined**: Clear goals, scope, and success criteria
- ✅ **Well-architected**: Decisions documented with rationale
- ✅ **Achievable**: 7-day timeline with clear milestones
- ✅ **Professional**: Production-ready code and documentation
- ✅ **Strategic**: Demonstrates product thinking for interview

**Remember**: The goal isn't just a working MCP server—it's demonstrating:
1. Technical ability to build prototypes
2. Product thinking (identifying opportunities)
3. User empathy (API design, error messages)
4. Execution (ships working code quickly)

Good luck building! 🚀
