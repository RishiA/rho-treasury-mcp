# Rho Treasury MCP Server

> Ask Claude for real-time Rho treasury rates. Built with Model Context Protocol.

A lightweight MCP server that gives Claude Desktop instant access to Rho's current treasury rates across all deposit tiers and investment types. No more tab-switching to check rates—just ask Claude.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Why This Exists

Quick experiment to programmatically access treasury rates via MCP and explore what API-first access to Rho data could look like.

## What It Does

Connects Claude Desktop to live treasury rate data:
- **Mutual Fund rates** - Scraped from Rho's website
- **T-Bill rates** - Calculated from Treasury.gov's official API
- **All 5 deposit tiers** - From $350K to $20M+
- **Smart caching** - 1 hour for T-Bills, 24 hours for Mutual Funds

## Quick Start

**Prerequisites**: Node.js 18+, Claude Desktop

```bash
# 1. Install
git clone https://github.com/RishiA/rho-treasury-mcp.git
cd rho-treasury-mcp
npm install
npm run build

# 2. Configure Claude Desktop
# Edit: ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "rho-treasury": {
      "command": "node",
      "args": ["/absolute/path/to/rho-treasury-mcp/build/index.js"]
    }
  }
}

# 3. Restart Claude Desktop and ask:
# "What are Rho's current treasury rates?"
```

## Example Usage

**In Claude Desktop:**

```
You: "What are Rho's treasury rates for a $15M deposit?"

Claude: [Calls get_rho_treasury_rates tool]

| Tier      | Mutual Fund | T-Bills |
|-----------|-------------|---------|
| $20M+     | 3.79%       | 3.48%   |
| $10-20M   | 3.69%       | 3.38%   | ← Your $15M deposit
| $5-10M    | 3.59%       | 3.28%   |
| $2-5M     | 3.49%       | 3.18%   |
| $350K-2M  | 3.34%       | 3.03%   |
```

**Other queries:**
- "Show me only T-Bill rates"
- "What's the rate for the largest deposit tier?"
- "Compare mutual fund vs T-Bill rates"

## Features

✅ **Hybrid data strategy** - Treasury.gov API for T-Bills, web scraping for Mutual Funds
✅ **Production-ready** - TypeScript strict mode, comprehensive error handling
✅ **Smart caching** - Minimizes requests, respects rate limits
✅ **Zero configuration** - No API keys needed (public data only)
✅ **Table formatting** - Results automatically formatted as clean tables

## How It Works

```
Claude Desktop → MCP Server → [Treasury.gov API + Rho Website] → Cached Response
```

**T-Bill Rates**: Fetched from Treasury.gov's 3-month rate, then applies Rho's tier spreads (-0.15% to -0.60%)

**Mutual Fund Rates**: Scraped directly from Rho's public website to ensure accuracy

## Tech Stack

- **TypeScript** - Type-safe server implementation
- **@modelcontextprotocol/sdk** - MCP protocol handling
- **Cheerio** - HTML parsing for web scraping
- **Node.js 18+** - Runtime environment

## Project Structure

```
rho-treasury-mcp/
├── src/
│   ├── index.ts              # MCP server
│   ├── services/             # Data fetchers
│   └── utils/                # Cache & errors
├── plan.md                   # Implementation roadmap
├── decisions.md              # Architecture decisions
└── claude.md                 # Full context documentation
```

## Future Ideas

- **Competitor rates** - Add Mercury, Ramp, Brex for instant comparison
- **Rate history** - Track changes over time in SQLite
- **Public deployment** - Deploy to Vercel as HTTP endpoint
- **Rate alerts** - Notify when rates change

## Development

```bash
# Development (hot reload)
npm run dev

# Build
npm run build

# Test manually
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node build/index.js
```

## Why MCP?

This demonstrates platform thinking:
- **Extensibility** - Easy to add new data sources
- **Composability** - Works with any MCP client
- **Developer experience** - Natural language interface
- **Validation** - Proves demand before building official API

Built by [Rishi Athanikar](https://github.com/RishiA), Platform PM at Rho.

---

**Disclaimer**: Unofficial educational project. Not affiliated with or endorsed by Rho. Rates are for informational purposes only—always verify directly with Rho.

## License

MIT
