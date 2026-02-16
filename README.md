# node-exec-mcp

[![CI](https://github.com/pandysp/node-exec-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/pandysp/node-exec-mcp/actions/workflows/ci.yml)

MCP server for executing commands on remote machines via [OpenClaw](https://github.com/openclaw/openclaw) node exec.

Provides one tool via the [Model Context Protocol](https://modelcontextprotocol.io/):

- **`run`** — Execute a shell command on a remote Mac (or any OpenClaw node) and get stdout, stderr, and exit code back.

Built-in progress notifications every 15 seconds prevent MCP client timeouts during long-running commands.

## Quick Start

```bash
NODE_ID=your-node-id npx node-exec-mcp
```

Requires Node.js 20+ and the [OpenClaw CLI](https://github.com/openclaw/openclaw) installed and configured with access to the target node.

### Prerequisites

1. A running OpenClaw Gateway with at least one connected node
2. The node ID (find it with `openclaw nodes status`)
3. The OpenClaw CLI authenticated and able to reach the gateway

## Configuration

### Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "node-exec": {
      "command": "npx",
      "args": ["-y", "node-exec-mcp"],
      "env": {
        "NODE_ID": "your-node-id"
      }
    }
  }
}
```

### OpenClaw (Docker)

When running inside a Docker container (e.g., as an OpenClaw MCP adapter server):

```json
{
  "command": "node",
  "args": ["/path/to/dist/index.js"],
  "env": {
    "NODE_ID": "your-node-id"
  }
}
```

## Tool Reference

### `run`

Execute a shell command on the remote node.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | string | yes | Shell command to execute on the remote machine |
| `cwd` | string | no | Working directory on the remote machine (default: `/tmp`) |
| `timeout_ms` | number | no | Per-call timeout in milliseconds (default: `300000`) |

Returns stdout, stderr, and exit code. Errors are flagged via `isError` in the MCP response.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ID` | — | **Required.** Target node ID (from `openclaw nodes status`) |
| `OPENCLAW_BIN` | `openclaw` | Override the OpenClaw CLI binary name or absolute path |
| `DEFAULT_CWD` | `/tmp` | Default working directory on the remote machine |
| `TIMEOUT_MS` | `300000` | Default per-call timeout in milliseconds (5 minutes) |

## How It Works

Under the hood, the server shells out to the OpenClaw CLI:

```
openclaw nodes run --node <NODE_ID> --json --timeout <ms> --cwd <dir> -- bash -c <command>
```

The JSON response is parsed and translated into MCP tool results. Progress notifications are sent every 15 seconds to keep the MCP connection alive during long-running commands.

## Security Considerations

- Commands execute with the permissions of the user running the OpenClaw companion app on the target node.
- The approval policy configured on the node applies (allowlist, ask-on-miss, or full access).
- **There is no input sanitization on the `command` parameter** — the MCP client (LLM) has full shell access within the node's approval policy. This is by design for flexibility, but means the node's approval policy is your security boundary.
- Commands are executed via `bash -c` — ensure bash is available on the target machine.

## Development

```bash
git clone https://github.com/pandysp/node-exec-mcp.git
cd node-exec-mcp
npm install
npm run build
npm test
```

## License

MIT
