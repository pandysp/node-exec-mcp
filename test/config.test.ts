import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean relevant env vars
    delete process.env.NODE_ID;
    delete process.env.OPENCLAW_BIN;
    delete process.env.DEFAULT_CWD;
    delete process.env.TIMEOUT_MS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when NODE_ID is missing", () => {
    expect(() => loadConfig()).toThrow("NODE_ID");
  });

  it("returns config with defaults when NODE_ID is set", () => {
    process.env.NODE_ID = "test-node-123";
    const config = loadConfig();

    expect(config.nodeId).toBe("test-node-123");
    expect(config.openclawBin).toBe("openclaw");
    expect(config.defaultCwd).toBe("/tmp");
    expect(config.timeoutMs).toBe(300000);
  });

  it("respects all environment overrides", () => {
    process.env.NODE_ID = "my-node";
    process.env.OPENCLAW_BIN = "openclaw";
    process.env.DEFAULT_CWD = "/Users/test";
    process.env.TIMEOUT_MS = "60000";

    const config = loadConfig();

    expect(config.nodeId).toBe("my-node");
    expect(config.openclawBin).toBe("openclaw");
    expect(config.defaultCwd).toBe("/Users/test");
    expect(config.timeoutMs).toBe(60000);
  });

  it("throws on invalid TIMEOUT_MS", () => {
    process.env.NODE_ID = "test";
    process.env.TIMEOUT_MS = "not-a-number";
    expect(() => loadConfig()).toThrow("TIMEOUT_MS");
  });

  it("throws on negative TIMEOUT_MS", () => {
    process.env.NODE_ID = "test";
    process.env.TIMEOUT_MS = "-1";
    expect(() => loadConfig()).toThrow("TIMEOUT_MS");
  });

  it("throws when OPENCLAW_BIN absolute path does not exist", () => {
    process.env.NODE_ID = "test";
    process.env.OPENCLAW_BIN = "/nonexistent/path/to/openclaw";
    expect(() => loadConfig()).toThrow("does not exist");
  });
});
