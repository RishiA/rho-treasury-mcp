#!/usr/bin/env node

/**
 * Rho Treasury MCP Server
 * Provides programmatic access to Rho's treasury rates via MCP protocol
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getRates } from "./services/ratesService.js";
import { GetRatesInput } from "./types.js";

// Create MCP server
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

/**
 * Register tool: get_rho_treasury_rates
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_rho_treasury_rates",
        description:
          "Retrieve current treasury yield rates from Rho across all deposit tiers and investment types. " +
          "Returns both mutual fund and T-Bill rates for specified tiers or all tiers. " +
          "Data is cached for performance (1 hour for T-Bills, 24 hours for mutual funds). " +
          "IMPORTANT: When presenting results to the user, format as a table with columns: Tier | Mutual Fund Yield | T-Bill Yield",
        inputSchema: {
          type: "object",
          properties: {
            tier: {
              type: "string",
              enum: ["20M+", "10-20M", "5-10M", "2-5M", "350K-2M", "all"],
              description:
                "Deposit tier to filter results. Tiers (largest to smallest): '20M+', '10-20M', '5-10M', '2-5M', '350K-2M'. Use 'all' for all tiers. Default: 'all'",
              default: "all",
            },
            investment_type: {
              type: "string",
              enum: ["mutual_fund", "tbills", "both"],
              description:
                "Investment type to retrieve. 'mutual_fund' for money market mutual fund rates, 'tbills' for Treasury Bill rates, 'both' for both types. Default: 'both'",
              default: "both",
            },
            force_refresh: {
              type: "boolean",
              description:
                "Bypass cache and fetch fresh data from sources. Default: false (use cached data if available)",
              default: false,
            },
          },
        },
      },
    ],
  };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_rho_treasury_rates") {
    try {
      const params = (request.params.arguments || {}) as GetRatesInput;

      console.error(`[MCP Server] Executing get_rho_treasury_rates with params:`, params);

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
      console.error(`[MCP Server] Error executing tool:`, error);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: {
                  code: "INTERNAL_ERROR",
                  message: error instanceof Error ? error.message : "Unknown error occurred",
                  timestamp: new Date().toISOString(),
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

/**
 * Start server
 */
async function main() {
  console.error("=".repeat(60));
  console.error("Rho Treasury MCP Server v1.0.0");
  console.error("=".repeat(60));
  console.error("Starting server...");

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Server running on stdio transport");
  console.error("Ready to accept tool calls from Claude Desktop");
  console.error("=".repeat(60));
}

// Handle errors
main().catch((error) => {
  console.error("Fatal error in MCP server:");
  console.error(error);
  process.exit(1);
});
