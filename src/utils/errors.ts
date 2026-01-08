/**
 * Error utilities for Rho Treasury MCP Server
 */

import { ErrorCode } from "../types.js";

/**
 * Format an error response
 */
export function formatError(code: ErrorCode, message: string): {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
  };
} {
  return {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create error message for network failures
 */
export function networkErrorMessage(url: string, error: unknown): string {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return `Failed to fetch data from ${url}: ${errorMsg}`;
}

/**
 * Create error message for parsing failures
 */
export function parseErrorMessage(source: string, details: string): string {
  return `Failed to parse ${source} data: ${details}. The website structure may have changed.`;
}

/**
 * Create error message for invalid input
 */
export function invalidInputMessage(param: string, value: unknown, validOptions: string[]): string {
  return `Invalid ${param} '${value}'. Valid options: ${validOptions.join(", ")}`;
}
