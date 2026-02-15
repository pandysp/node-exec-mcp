#!/usr/bin/env node

import { createRequire } from "node:module";

async function main(): Promise<void> {
  const { McpServer } = await import(
    "@modelcontextprotocol/sdk/server/mcp.js"
  );
  const { StdioServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/stdio.js"
  );
  const { loadConfig } = await import("./config.js");
  const { registerRunTool } = await import("./tools/run.js");

  const require = createRequire(import.meta.url);
  const { version } = require("../package.json") as { version: string };

  const config = loadConfig();

  const server = new McpServer(
    { name: "node-exec-mcp", version },
    { capabilities: { logging: {} } }
  );

  registerRunTool(server, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  transport.onclose = shutdown;
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
