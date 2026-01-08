# Rho Treasury MCP Server

> Programmatic access to Rho's treasury rates via Model Context Protocol

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-18+-green.svg)](https://nodejs.org/)

## Overview

A Model Context Protocol (MCP) server that provides Claude Desktop with real-time access to Rho's treasury rates across all deposit tiers and investment types. Combines data from Treasury.gov's official API and Rho's public website to deliver accurate, up-to-date rate information.

### Features

- ✅ **Real-time Rates**: Fetches current treasury rates from official sources
- ✅ **All Tiers**: Supports all 5 deposit tiers (350K-2M through 20M+)
- ✅ **Both Types**: Mutual Fund and T-Bill rates
- ✅ **Smart Caching**: 1-hour cache for T-Bills, 24-hour for Mutual Funds
- ✅ **Flexible Filtering**: Query by tier, investment type, or both
- ✅ **Robust Error Handling**: Graceful degradation and partial responses
- ✅ **Zero Configuration**: No API keys or authentication required

## Quick Start

### Prerequisites

- Node.js 18 or higher
- Claude Desktop
- npm or yarn

### Installation

```bash
# Clone the repository
cd rho-treasury-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Configure Claude Desktop

Edit your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "rho-treasury": {
      "command": "node",
      "args": [
        "/absolute/path/to/rho-treasury-mcp/build/index.js"
      ]
    }
  }
}
```

**Important**: Replace `/absolute/path/to/` with your actual path.

### Restart Claude Desktop

After saving the config, restart Claude Desktop completely.

## Usage

Once configured, you can ask Claude questions about Rho's treasury rates:

### Example Queries

**Get all rates**:
```
"What are Rho's current treasury rates?"
```

**Specific tier**:
```
"Show me Rho's rates for a $15M deposit"
```

**T-Bills only**:
```
"What are Rho's T-Bill rates?"
```

**Mutual Funds for large deposits**:
```
"Get mutual fund rates for the 20M+ tier"
```

### API Reference

#### Tool: `get_rho_treasury_rates`

**Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tier` | string | `"all"` | Deposit tier: `"350K-2M"`, `"2-5M"`, `"5-10M"`, `"10-20M"`, `"20M+"`, or `"all"` |
| `investment_type` | string | `"both"` | Investment type: `"mutual_fund"`, `"tbills"`, or `"both"` |
| `force_refresh` | boolean | `false` | Bypass cache and fetch fresh data |

**Response Structure**:

```json
{
  "success": true,
  "data": {
    "mutual_fund_rates": {
      "350K-2M": "3.34%",
      "2-5M": "3.49%",
      "5-10M": "3.59%",
      "10-20M": "3.69%",
      "20M+": "3.79%"
    },
    "tbill_rates": {
      "350K-2M": "3.02%",
      "2-5M": "3.17%",
      "5-10M": "3.27%",
      "10-20M": "3.37%",
      "20M+": "3.47%"
    },
    "metadata": {
      "as_of_date": "2026-01-08",
      "last_updated": "2026-01-08T18:00:00Z",
      "source_url": "https://www.rho.co/product/treasury",
      "treasury_source_date": "2026-01-07",
      "cache_hit": false
    }
  }
}
```

## Architecture

### Data Flow

```
Claude Desktop → MCP Server → [Treasury.gov API + Rho Website] → Cache → Response
```

### Components

1. **Treasury.gov Fetcher** (`services/treasuryGov.ts`)
   - Fetches 3-month Treasury rate from official CSV
   - Calculates T-Bill tiers using Rho's spread formula
   - Spreads: -0.15% to -0.60% based on tier

2. **Rho Scraper** (`services/rhoScraper.ts`)
   - Scrapes mutual fund rates from Rho's website
   - Parses HTML table with Cheerio
   - Extracts "as of" date

3. **Cache Layer** (`utils/cache.ts`)
   - In-memory cache with TTL
   - 1 hour for Treasury data
   - 24 hours for Rho data

4. **Rates Service** (`services/ratesService.ts`)
   - Orchestrates data fetching
   - Handles parallel requests
   - Formats responses

5. **MCP Server** (`index.ts`)
   - Registers MCP tools
   - Handles stdio transport
   - Error handling and logging

### Data Sources

**Treasury.gov API** (Public):
- URL: `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/{year}/all`
- Format: CSV
- Update: Daily (business days)
- Usage: T-Bill base rates

**Rho Website** (Public):
- URL: `https://www.rho.co/product/treasury`
- Format: HTML
- Update: As needed
- Usage: Mutual Fund rates

## Development

### Project Structure

```
rho-treasury-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── types.ts              # TypeScript definitions
│   ├── config.ts             # Configuration constants
│   ├── services/
│   │   ├── ratesService.ts   # Main orchestrator
│   │   ├── treasuryGov.ts    # Treasury.gov client
│   │   └── rhoScraper.ts     # Rho website scraper
│   └── utils/
│       ├── cache.ts          # Caching layer
│       └── errors.ts         # Error utilities
├── build/                    # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

### Scripts

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Run built server
npm start
```

### Testing

**Manual Test** (without Claude Desktop):

```bash
# List available tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node build/index.js

# Call the tool
echo '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_rho_treasury_rates",
    "arguments": {"tier": "20M+"}
  }
}' | node build/index.js
```

### Debugging

**Check logs**:

All logs go to stderr (stdout is for MCP protocol):
```bash
# macOS
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Common Issues**:

1. **Server won't start**: Check that all dependencies are installed (`npm install`)
2. **Tool not showing in Claude**: Verify config file path is absolute
3. **Rates don't match website**: Try `force_refresh: true` to bypass cache
4. **Scraping fails**: Rho's website structure may have changed (check logs)

## How It Works

### T-Bill Rate Calculation

Rho applies tier-based spreads to the Treasury 3-month rate:

```typescript
T-Bill Rate = Treasury 3-Month Rate - Spread

Spreads:
- 20M+:    -0.15%
- 10-20M:  -0.25%
- 5-10M:   -0.35%
- 2-5M:    -0.45%
- 350K-2M: -0.60%
```

Example:
```
Treasury 3-Month: 4.50%
20M+ T-Bill: 4.50% - 0.15% = 4.35%
350K-2M T-Bill: 4.50% - 0.60% = 3.90%
```

### Mutual Fund Rates

Scraped directly from Rho's website as they depend on a private reference rate stored in Rho's database.

### Caching Strategy

- **Treasury.gov**: 1-hour cache (rates update daily, but we check hourly for freshness)
- **Rho Website**: 24-hour cache (marketing page rates are stable, respectful scraping)

### Error Handling

The server handles errors gracefully:

- **Network failures**: Returns cached data with staleness warning
- **Parse errors**: Descriptive messages indicating what failed
- **Partial failures**: Returns successful data, indicates which source failed
- **Invalid input**: Clear validation messages with valid options

## Troubleshooting

### Server won't start

1. Check Node.js version: `node --version` (should be 18+)
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Rebuild: `npm run build`

### Tool not appearing in Claude

1. Verify config path is **absolute**, not relative
2. Check for typos in `claude_desktop_config.json`
3. Restart Claude Desktop completely
4. Check Claude logs: `tail -f ~/Library/Logs/Claude/mcp*.log`

### Rates seem outdated

1. Use `force_refresh: true` to bypass cache
2. Check if Treasury.gov or Rho website is accessible
3. Verify system date/time is correct

### Scraping errors

If Rho changes their website structure:
1. Check error message for specific selector that failed
2. Inspect Rho's website: `https://www.rho.co/product/treasury`
3. Update selectors in `src/services/rhoScraper.ts`
4. Rebuild: `npm run build`

## Roadmap

### Phase 2: Competitor Comparison
- Add Mercury rates
- Add Ramp rates
- Add Brex rates
- New tool: `compare_treasury_rates`

### Phase 3: Historical Data
- Store rates in SQLite
- Track rate changes over time
- New tool: `get_rate_history`

### Phase 4: Cloud Deployment
- Deploy to Vercel
- Public HTTP/SSE endpoint
- Rate limiting
- Monitoring

## Why This Project Exists

This MCP server was built as a learning project and proof-of-concept to:
1. Demonstrate MCP server architecture and development
2. Validate customer demand for programmatic API access to Rho's products
3. Identify competitive gaps (Ramp has MCP, Mercury/Brex have APIs, Rho doesn't)
4. Showcase product thinking and technical execution

## Contributing

This is a personal learning project. Feel free to fork and adapt for your own use.

## License

MIT License - see LICENSE file for details

## Disclaimer

This is an unofficial, educational project. Not affiliated with or endorsed by Rho.

Rate data is sourced from:
- Treasury.gov (official U.S. Treasury data)
- Rho.co (public marketing website)

Rates are provided for informational purposes only and may not reflect actual rates available. Always verify rates directly with Rho.

## Contact

Built by Rishi Athanikar as a demonstration project for Platform Product role at Rho.

---

**Built with**:
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk) - MCP TypeScript SDK
- [Cheerio](https://cheerio.js.org/) - HTML parsing
- [TypeScript](https://www.typescriptlang.org/) - Type safety

**Resources**:
- [MCP Documentation](https://modelcontextprotocol.io/)
- [Treasury.gov Rates](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve)
- [Rho Treasury Product](https://www.rho.co/product/treasury)
