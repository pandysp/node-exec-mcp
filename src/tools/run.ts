import { spawn } from "node:child_process";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";

interface NodesRunPayload {
  exitCode: number;
  timedOut: boolean;
  success: boolean;
  stdout: string;
  stderr: string;
  error: string | null;
}

interface NodesRunResponse {
  ok: boolean;
  nodeId: string;
  command: string;
  payload: NodesRunPayload;
}

export function registerRunTool(server: McpServer, config: Config): void {
  server.registerTool(
    "run",
    {
      title: "Run command on Mac",
      description:
        "Execute a shell command on the remote Mac via OpenClaw node exec. " +
        "Returns stdout, stderr, and exit code. Commands run as the Mac user " +
        "with the configured approval policy.",
      inputSchema: {
        command: z
          .string()
          .describe("Shell command to execute on the Mac"),
        cwd: z
          .string()
          .optional()
          .describe(
            `Working directory on the Mac (default: ${config.defaultCwd})`
          ),
        timeout_ms: z
          .number()
          .positive()
          .optional()
          .describe(
            `Per-call timeout in milliseconds (default: ${config.timeoutMs})`
          ),
      },
    },
    async (args) => {
      const cwd = args.cwd || config.defaultCwd;
      const timeout = args.timeout_ms || config.timeoutMs;

      const spawnArgs = [
        "nodes",
        "run",
        "--node",
        config.nodeId,
        "--json",
        "--timeout",
        String(timeout),
        "--cwd",
        cwd,
        "--",
        "bash",
        "-c",
        args.command,
      ];

      return new Promise((resolve) => {
        const child = spawn(config.openclawBin, spawnArgs, {
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env },
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        // Send progress notifications every 15s to prevent MCP adapter timeout
        const progressInterval = setInterval(() => {
          try {
            server.server.sendLoggingMessage({
              level: "info",
              data: "Command still running...",
            });
          } catch {
            // Transport closed — ignore
          }
        }, 15_000);

        child.on("close", (exitCode) => {
          clearInterval(progressInterval);

          // Try to parse JSON response from stdout
          // Filter out OpenClaw CLI noise lines (e.g. "[mcp-adapter] Registered N tools from cache")
          // that appear in stdout before the JSON response in 2026.3.13+
          const jsonStart = stdout.indexOf("{");
          const cleanStdout = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;
          try {
            const response: NodesRunResponse = JSON.parse(cleanStdout.trim());
            const p = response.payload;

            let output = "";
            if (p.stdout) output += p.stdout;
            if (p.stderr) output += (output ? "\n" : "") + `[stderr] ${p.stderr}`;
            if (p.error) output += (output ? "\n" : "") + `[error] ${p.error}`;
            if (p.timedOut) output += (output ? "\n" : "") + "[timed out]";

            output = output || "(no output)";
            output += `\n[exit code: ${p.exitCode}]`;

            resolve({
              content: [{ type: "text", text: output }],
              isError: !p.success,
            });
          } catch {
            // JSON parse failed — gateway-level error (plain text on stderr)
            const errorMsg =
              stderr.trim() ||
              stdout.trim() ||
              `Command failed with exit code ${exitCode}`;

            resolve({
              content: [{ type: "text", text: errorMsg }],
              isError: true,
            });
          }
        });

        child.on("error", (err) => {
          clearInterval(progressInterval);
          resolve({
            content: [
              {
                type: "text",
                text: `Failed to spawn openclaw: ${err.message}`,
              },
            ],
            isError: true,
          });
        });
      });
    }
  );
}
