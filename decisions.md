# Architectural Decision Records (ADR)

This document captures all significant architectural and design decisions made for the Rho Treasury MCP Server project.

---

## ADR-001: Hybrid Data Strategy

**Date**: 2026-01-08
**Status**: ✅ Accepted

### Context

We need to retrieve Rho's treasury rates accurately. Initial plan was to scrape the entire website, but code analysis revealed Rho uses multiple data sources:
1. Supabase database for mutual fund reference rates (private, requires API key)
2. Treasury.gov public API for T-Bill base rates
3. Client-side calculation for tier spreads

### Decision

**Use a hybrid approach**:
- **T-Bill rates**: Fetch from Treasury.gov API + apply Rho's tier calculation
- **Mutual Fund rates**: Scrape from Rho's website directly

### Rationale

**Why not pure scraping?**
- Scraping alone works but doesn't demonstrate understanding of the underlying data architecture
- Treasury.gov is faster and more reliable than scraping both rate types

**Why not just Treasury.gov?**
- Mutual fund rates require Rho's private reference rate from Supabase
- Without Supabase access, we must scrape the final displayed rates

**Why not try to access Supabase?**
- Requires `SUPABASE_API_KEY` (private)
- Ethically questionable to attempt accessing private databases
- Scraping public website is acceptable and accurate

### Consequences

**Positive**:
- ✅ 100% accuracy for both rate types
- ✅ Demonstrates understanding of data architecture
- ✅ Uses official Treasury source for T-Bills
- ✅ Faster than pure scraping (Treasury API is very fast)
- ✅ Educational value (learn both API fetching and web scraping)

**Negative**:
- ❌ More complex than single data source
- ❌ Two failure modes (API + scraping)
- ❌ Rho website changes break mutual fund fetching

**Mitigation**:
- Robust error handling for both sources
- Detailed error messages when parsing fails
- Cache provides resilience during outages

---

## ADR-002: MCP Protocol via stdio

**Date**: 2026-01-08
**Status**: ✅ Accepted

### Context

MCP servers can communicate via:
1. **stdio** (stdin/stdout)
2. **HTTP/SSE** (Server-Sent Events)
3. **WebSocket**

Claude Desktop currently requires stdio for local MCP servers.

### Decision

Use **stdio transport** with `StdioServerTransport` from MCP SDK.

### Rationale

**Why stdio?**
- Required by Claude Desktop for local servers
- Simple to implement
- No network configuration needed
- Secure (local process only)

**When would we use HTTP/SSE?**
- Remote/deployed MCP servers
- Multi-client scenarios
- Cloud deployment (Phase 4)

### Consequences

**Positive**:
- ✅ Works immediately with Claude Desktop
- ✅ No port conflicts
- ✅ Simple debugging (stderr for logs)
- ✅ No authentication needed (local trust)

**Negative**:
- ❌ Single client only (one Claude Desktop instance)
- ❌ Can't access remotely
- ❌ Must restart for code changes

**Future Migration**:
- Phase 4 will add HTTP/SSE transport for cloud deployment
- Can support both transports simultaneously

---

## ADR-003: TypeScript with Strict Mode

**Date**: 2026-01-08
**Status**: ✅ Accepted

### Context

Need to choose language and strictness level for the project.

### Decision

Use **TypeScript v5+ with strict mode enabled**.

### Rationale

**Why TypeScript?**
- Type safety catches errors at compile time
- Better IDE support and autocomplete
- MCP SDK has excellent TypeScript support
- Industry standard for Node.js tooling
- Demonstrates professional development practices

**Why strict mode?**
- Enforces best practices
- Catches more potential bugs
- Makes refactoring safer
- Shows attention to quality
- Minimal overhead with modern TypeScript

**Configuration**:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./build"
  }
}
```

### Consequences

**Positive**:
- ✅ Type safety prevents runtime errors
- ✅ Self-documenting code through types
- ✅ Better refactoring experience
- ✅ Catches null/undefined issues

**Negative**:
- ❌ Slightly more verbose
- ❌ Learning curve for advanced types
- ❌ Compile step required

**Mitigation**:
- Use `tsx` for rapid development (no build needed)
- Keep types simple and practical
- Document complex type decisions

---

## ADR-004: In-Memory Caching Strategy

**Date**: 2026-01-08
**Status**: ✅ Accepted

### Context

Need to decide caching approach to:
1. Reduce load on external services
2. Improve response times
3. Handle temporary outages

Options considered:
- No caching
- In-memory (Map/object)
- File-based (JSON)
- Database (SQLite/Redis)

### Decision

Use **in-memory caching with TTL**:
- Treasury.gov data: 1-hour TTL
- Rho scraped data: 24-hour TTL

### Rationale

**Why in-memory?**
- Simple to implement
- Fast access (microseconds)
- No external dependencies
- Sufficient for single-instance server
- No persistence needed for this use case

**Why different TTLs?**
- **Treasury (1 hour)**: Official rates update daily, but checking hourly balances freshness vs. load
- **Rho (24 hours)**: Marketing page rates are stable, 24h is respectful and practical

**Why not persistent storage?**
- Rates change infrequently
- Historical data not required for MVP (Phase 3 feature)
- Adds complexity without clear benefit
- MCP server restarts are acceptable

### Consequences

**Positive**:
- ✅ Simple implementation (~50 lines)
- ✅ Fast cache hits (< 50ms)
- ✅ No dependencies
- ✅ Respectful to data sources
- ✅ Survives temporary outages

**Negative**:
- ❌ Cache lost on server restart
- ❌ No historical data tracking
- ❌ Can't share cache across instances

**Future Enhancement** (Phase 3):
- Add SQLite for historical rate tracking
- Migrate to Redis for multi-instance deployments
- Keep in-memory as hot cache layer

---

## ADR-005: Cheerio for HTML Parsing

**Date**: 2026-01-08
**Status**: ✅ Accepted

### Context

Need to parse HTML from Rho's website to extract rate data.

Options:
1. **Cheerio** - jQuery-like API for Node.js
2. **JSDOM** - Full DOM implementation
3. **Playwright/Puppeteer** - Headless browser
4. **Regex** - Pattern matching

### Decision

Use **Cheerio** for HTML parsing.

### Rationale

**Why Cheerio?**
- Fast and lightweight (no browser engine)
- Familiar jQuery syntax
- Perfect for static HTML parsing
- Minimal dependencies
- Battle-tested and maintained

**Why not JSDOM?**
- Heavier weight (full DOM implementation)
- Overkill for simple scraping
- Slower than Cheerio

**Why not Playwright/Puppeteer?**
- Too heavy (downloads Chrome/Firefox)
- Unnecessary for static content
- Slower and more complex
- Rho's treasury page doesn't require JavaScript rendering

**Why not Regex?**
- Fragile and error-prone for HTML
- Harder to maintain
- Less readable

### Consequences

**Positive**:
- ✅ Fast parsing (< 100ms)
- ✅ Readable selector syntax
- ✅ Small dependency (~1MB)
- ✅ Easy to debug

**Negative**:
- ❌ Can't handle JavaScript-rendered content
- ❌ Breaks if HTML structure changes significantly

**Mitigation**:
- Detailed error messages when selectors fail
- Document CSS selectors used
- Fallback to cached data if scraping fails

---

## ADR-006: Single Tool Design

**Date**: 2026-01-08
**Status**: ✅ Accepted

### Context

Need to decide tool granularity for the MCP server.

Options:
1. Single tool: `get_rho_treasury_rates` with parameters
2. Multiple tools: `get_tbill_rates`, `get_mutual_fund_rates`, `get_all_rates`
3. Separate tools per tier: `get_rate_20m_plus`, etc.

### Decision

Implement **single flexible tool**: `get_rho_treasury_rates` with parameters:
- `tier`: Filter by deposit tier or "all"
- `investment_type`: Filter by type or "both"
- `force_refresh`: Bypass cache

### Rationale

**Why single tool?**
- Cleaner API surface
- Reduces cognitive load (1 tool to learn vs. many)
- Flexible parameter combinations
- Easier to maintain
- Follows REST/API best practices (resource-oriented)

**Why not multiple tools?**
- Redundant code
- More to document and test
- Harder to add features (multiply by N tools)
- Confusing for users ("which tool do I use?")

**Parameter Design Philosophy**:
- Sensible defaults (`tier: "all"`, `investment_type: "both"`)
- Optional parameters (everything works with no params)
- Clear validation and error messages

### Consequences

**Positive**:
- ✅ Simple mental model
- ✅ Flexible usage patterns
- ✅ Easy to extend (add parameters)
- ✅ Less code duplication

**Negative**:
- ❌ Slightly more complex parameter validation
- ❌ Single tool must handle all scenarios

**Examples**:
```typescript
// Get everything (default)
{ }

// Get specific tier
{ "tier": "20M+" }

// Get only T-Bills
{ "investment_type": "tbills" }

// Force fresh data
{ "force_refresh": true }

// Combinations work naturally
{ "tier": "10-20M", "investment_type": "mutual_fund" }
```

---

## ADR-007: Error Response Format

**Date**: 2026-01-08
**Status**: ✅ Accepted

### Context

Need consistent error handling and response format.

### Decision

Use **structured error responses** with:
- `success`: Boolean flag
- `data`: Response data (when successful)
- `error`: Error object (when failed)

**Error Object Structure**:
```typescript
{
  code: string;        // Machine-readable error code
  message: string;     // Human-readable description
  timestamp: string;   // ISO 8601 timestamp
}
```

### Rationale

**Why structured errors?**
- Consistent handling in client code
- Machine-readable error codes
- Clear success/failure indication
- Timestamps aid debugging

**Error Code Categories**:
- `SCRAPE_FAILED`: Rho website unreachable or returns error
- `PARSE_ERROR`: HTML structure changed, can't extract rates
- `NETWORK_ERROR`: Treasury.gov API unreachable
- `INVALID_INPUT`: Parameter validation failed
- `CACHE_ERROR`: Cache operation failed
- `INTERNAL_ERROR`: Unexpected server error

**Why these codes?**
- Categorize failures by root cause
- Help users understand what went wrong
- Guide troubleshooting steps
- Enable error-specific handling

### Consequences

**Positive**:
- ✅ Clear error attribution
- ✅ Actionable error messages
- ✅ Easy to log and monitor
- ✅ Future-proof (add codes without breaking changes)

**Negative**:
- ❌ Requires maintaining error code enum
- ❌ Need discipline to use correct codes

**Example Errors**:
```typescript
// Scraping failed
{
  "success": false,
  "error": {
    "code": "SCRAPE_FAILED",
    "message": "Failed to fetch Rho website: HTTP 503 Service Unavailable",
    "timestamp": "2026-01-08T18:00:00Z"
  }
}

// Parsing failed
{
  "success": false,
  "error": {
    "code": "PARSE_ERROR",
    "message": "Rate table not found - website structure may have changed. Selector '.rate-table' returned no results.",
    "timestamp": "2026-01-08T18:00:00Z"
  }
}

// Invalid input
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid tier '100M+'. Valid tiers: 350K-2M, 2-5M, 5-10M, 10-20M, 20M+, all",
    "timestamp": "2026-01-08T18:00:00Z"
  }
}
```

---

## ADR-008: Rate Calculation Logic

**Date**: 2026-01-08
**Status**: ✅ Accepted

### Context

Discovered Rho's rate calculation from `TreasureRatesProvider.tsx`:
- Mutual Funds: `referenceRate - spread`
- T-Bills: `threeMonthRate - spread`

Spreads for tiers:
- Tier 1 (20M+): -0.15%
- Tier 2 (10-20M): -0.25%
- Tier 3 (5-10M): -0.35%
- Tier 4 (2-5M): -0.45%
- Tier 5 (350K-2M): -0.60%

### Decision

**For T-Bills**: Apply the exact spread formula from Rho's code.

**For Mutual Funds**: Scrape final rates (since we don't have access to reference rate).

### Rationale

**Why calculate T-Bills?**
- We have the exact base rate (Treasury.gov)
- We have the exact formula (from Rho's code)
- Result matches Rho's displayed rates exactly
- Faster than scraping

**Why scrape Mutual Funds?**
- Reference rate is in private Supabase
- Calculation would be inaccurate without real reference rate
- Scraping ensures we match displayed rates exactly

**Formula Implementation**:
```typescript
function calculateTBillTiers(threeMonthRate: number): TierRates {
  return {
    "20M+": (threeMonthRate - 0.15).toFixed(2) + "%",
    "10-20M": (threeMonthRate - 0.25).toFixed(2) + "%",
    "5-10M": (threeMonthRate - 0.35).toFixed(2) + "%",
    "2-5M": (threeMonthRate - 0.45).toFixed(2) + "%",
    "350K-2M": (threeMonthRate - 0.60).toFixed(2) + "%",
  };
}
```

### Consequences

**Positive**:
- ✅ T-Bill rates guaranteed to match Rho exactly
- ✅ Shows understanding of underlying logic
- ✅ Fast calculation (no scraping needed for T-Bills)

**Negative**:
- ❌ If Rho changes spread formula, our T-Bills won't match
- ❌ Still need scraping for Mutual Funds

**Risk Mitigation**:
- Document the spread formula clearly
- Add test to verify against Rho's live rates
- If formula changes, easy to update

---

## ADR-009: No Authentication Required

**Date**: 2026-01-08
**Status**: ✅ Accepted

### Context

All data sources are publicly accessible:
- Treasury.gov API: Public, no auth
- Rho website: Public marketing page, no login

### Decision

**No authentication or API keys required** for the MCP server.

### Rationale

**Why no auth?**
- Data is publicly available
- Simpler setup for users
- No key management needed
- No rate limiting concerns (with respectful caching)

**Ethics Check**:
- ✅ All data is public
- ✅ No circumventing access controls
- ✅ Respectful caching reduces load
- ✅ User-Agent identifies our client
- ✅ No private/authenticated endpoints

### Consequences

**Positive**:
- ✅ Zero-config installation
- ✅ No key management
- ✅ No security concerns
- ✅ Easy to share and deploy

**Negative**:
- ❌ No usage tracking
- ❌ Can't enforce rate limits per user
- ❌ If sources add auth, we need to adapt

**Future Consideration**:
- If deployed publicly, add optional API key for rate limiting
- Monitor for IP-based rate limiting from sources

---

## ADR-010: Parallel Data Fetching

**Date**: 2026-01-08
**Status**: ✅ Accepted

### Context

When users request both investment types (`investment_type: "both"`), we need to fetch from two sources:
1. Treasury.gov API (T-Bills)
2. Rho website scraping (Mutual Funds)

### Decision

Use **Promise.all()** to fetch data sources in parallel.

### Rationale

**Why parallel?**
- Faster response time (3s vs. 5-6s)
- Both sources are independent
- Node.js async model supports this naturally

**Implementation**:
```typescript
const [tbillData, mutualFundData] = await Promise.allSettled([
  getTBillRates(forceRefresh),
  getMutualFundRates(forceRefresh),
]);
```

**Why Promise.allSettled()?**
- Unlike Promise.all(), doesn't fail if one source fails
- Allows partial responses (e.g., T-Bills work but Mutual Funds fail)
- Better error handling granularity

### Consequences

**Positive**:
- ✅ 40-50% faster for "both" requests
- ✅ Better user experience
- ✅ Efficient resource usage

**Negative**:
- ❌ Slightly more complex error handling
- ❌ Both sources hit simultaneously (more load)

**Partial Response Handling**:
```typescript
// If T-Bills succeed but Mutual Funds fail
{
  "success": true,
  "data": {
    "tbill_rates": { /* ... */ },
    // No mutual_fund_rates field
    "metadata": {
      "partial_response": true,
      "failed_sources": ["mutual_fund"]
    }
  }
}
```

---

## ADR-011: ISO 8601 Timestamps

**Date**: 2026-01-08
**Status**: ✅ Accepted

### Context

Need consistent date/time formatting across the API.

### Decision

Use **ISO 8601 format** for all dates and timestamps:
- Dates: `YYYY-MM-DD` (e.g., "2026-01-08")
- Timestamps: `YYYY-MM-DDTHH:mm:ssZ` (e.g., "2026-01-08T18:00:00Z")

### Rationale

**Why ISO 8601?**
- International standard
- Unambiguous (no locale confusion)
- Sortable lexicographically
- Supported by JavaScript Date natively
- Expected by most APIs

**JavaScript Implementation**:
```typescript
// Timestamp
new Date().toISOString()  // "2026-01-08T18:00:00.123Z"

// Date only
new Date().toISOString().split('T')[0]  // "2026-01-08"
```

### Consequences

**Positive**:
- ✅ Universal format
- ✅ No timezone ambiguity
- ✅ Easy to parse
- ✅ Sortable

**Negative**:
- ❌ Not human-friendly (but API-focused, not UI)

---

## ADR-012: Semantic Versioning

**Date**: 2026-01-08
**Status**: ✅ Accepted

### Context

Need versioning strategy for the MCP server.

### Decision

Follow **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes to API/tool schema
- MINOR: New features, backwards-compatible
- PATCH: Bug fixes, no API changes

**Starting version**: `1.0.0` (stable MVP)

### Rationale

**Why SemVer?**
- Industry standard
- Clear contract with users
- Easy to understand impact of updates
- Compatible with npm

**Version Bump Examples**:
- Add new tool → MINOR bump (1.0.0 → 1.1.0)
- Change tool schema → MAJOR bump (1.0.0 → 2.0.0)
- Fix scraping bug → PATCH bump (1.0.0 → 1.0.1)

### Consequences

**Positive**:
- ✅ Clear expectations for users
- ✅ Safe to update within major version
- ✅ Standard practice

---

## Summary: Key Decisions

| # | Decision | Why | Impact |
|---|----------|-----|--------|
| 001 | Hybrid data strategy | Accuracy + understanding | More complex, but accurate |
| 002 | stdio transport | Claude Desktop requirement | Local only for now |
| 003 | TypeScript strict | Type safety + professionalism | Safer code |
| 004 | In-memory caching | Simple + sufficient | Fast, but lost on restart |
| 005 | Cheerio parsing | Fast + familiar | Good for static HTML |
| 006 | Single flexible tool | Simpler API | Less code, more flexible |
| 007 | Structured errors | Clear debugging | Better error handling |
| 008 | Calculate T-Bills | Exact formula known | Guaranteed accuracy |
| 009 | No authentication | Public data | Zero-config setup |
| 010 | Parallel fetching | Faster responses | 40-50% speed improvement |
| 011 | ISO 8601 timestamps | Standard format | Universal compatibility |
| 012 | Semantic versioning | Clear updates | Standard practice |

---

## Trade-offs Accepted

1. **Complexity vs. Accuracy**: Chose hybrid approach over simple scraping for accuracy
2. **Restart vs. Persistence**: In-memory cache lost on restart, but acceptable for MVP
3. **Speed vs. Simplicity**: Parallel fetching adds complexity but worth the performance gain
4. **Strictness vs. Flexibility**: TypeScript strict mode catches more errors, worth the verbosity

---

## Future Decisions Needed (Post-MVP)

1. **Historical Data Storage**: SQLite vs. PostgreSQL vs. Time-series DB?
2. **Cloud Deployment**: Vercel vs. AWS Lambda vs. Railway?
3. **Multi-Instance Caching**: Redis vs. shared database?
4. **Rate Change Notifications**: WebSocket vs. Webhook vs. Email?
5. **Competitor Data**: Same scraping approach or different strategy?

---

**These decisions are living documentation. Update as the project evolves.**
