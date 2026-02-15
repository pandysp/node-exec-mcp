import { existsSync } from "node:fs";

export interface Config {
  nodeId: string;
  openclawBin: string;
  defaultCwd: string;
  timeoutMs: number;
}

export function loadConfig(): Config {
  const nodeId = process.env.NODE_ID;
  if (!nodeId) {
    throw new Error(
      "NODE_ID environment variable is required. Set it to the target node's ID " +
        "(from `openclaw nodes status`)."
    );
  }

  const openclawBin = process.env.OPENCLAW_BIN || "openclaw";
  const defaultCwd = process.env.DEFAULT_CWD || "/tmp";
  const timeoutMs = parseInt(process.env.TIMEOUT_MS || "300000", 10);

  if (isNaN(timeoutMs) || timeoutMs <= 0) {
    throw new Error(
      `TIMEOUT_MS must be a positive integer, got: ${process.env.TIMEOUT_MS}`
    );
  }

  // Validate openclaw binary exists if an absolute path was given
  if (openclawBin.startsWith("/") && !existsSync(openclawBin)) {
    throw new Error(
      `OPENCLAW_BIN path does not exist: ${openclawBin}`
    );
  }

  return { nodeId, openclawBin, defaultCwd, timeoutMs };
}
