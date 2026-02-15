import { describe, it, expect, vi, beforeEach } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter, Readable } from "node:stream";

// Mock child_process.spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

const mockedSpawn = vi.mocked(spawn);

function createMockChild(): ChildProcess {
  const child = new EventEmitter() as ChildProcess;
  child.stdout = new Readable({ read() {} }) as ChildProcess["stdout"];
  child.stderr = new Readable({ read() {} }) as ChildProcess["stderr"];
  child.stdin = null;
  child.stdio = [null, child.stdout, child.stderr, null, null];
  child.pid = 12345;
  child.killed = false;
  child.connected = false;
  child.exitCode = null;
  child.signalCode = null;
  child.spawnargs = [];
  child.spawnfile = "";
  // Add required methods
  child.kill = vi.fn();
  child.send = vi.fn() as ChildProcess["send"];
  child.disconnect = vi.fn();
  child.unref = vi.fn();
  child.ref = vi.fn();
  child[Symbol.dispose] = vi.fn();
  return child;
}

describe("run tool", () => {
  let registerRunTool: typeof import("../src/tools/run.js").registerRunTool;
  let mockServer: {
    registerTool: ReturnType<typeof vi.fn>;
    server: { sendLoggingMessage: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../src/tools/run.js");
    registerRunTool = mod.registerRunTool;
    mockServer = {
      registerTool: vi.fn(),
      server: { sendLoggingMessage: vi.fn() },
    };
  });

  it("registers a tool named 'run'", () => {
    const config = {
      nodeId: "test-node",
      openclawBin: "openclaw",
      defaultCwd: "/tmp",
      timeoutMs: 300000,
    };
    registerRunTool(mockServer as never, config);

    expect(mockServer.registerTool).toHaveBeenCalledOnce();
    expect(mockServer.registerTool.mock.calls[0][0]).toBe("run");
  });

  it("spawns openclaw with correct arguments", async () => {
    const config = {
      nodeId: "abc123",
      openclawBin: "/usr/bin/openclaw",
      defaultCwd: "/tmp",
      timeoutMs: 60000,
    };
    registerRunTool(mockServer as never, config);

    const handler = mockServer.registerTool.mock.calls[0][2];
    const child = createMockChild();
    mockedSpawn.mockReturnValue(child);

    const resultPromise = handler(
      { command: "echo hello", cwd: "/Users/test" },
      {}
    );

    // Simulate JSON response
    const response = JSON.stringify({
      ok: true,
      nodeId: "abc123",
      command: "system.run",
      payload: {
        exitCode: 0,
        timedOut: false,
        success: true,
        stdout: "hello\n",
        stderr: "",
        error: null,
      },
    });
    child.stdout!.emit("data", Buffer.from(response));
    child.emit("close", 0);

    const result = await resultPromise;

    expect(mockedSpawn).toHaveBeenCalledWith(
      "/usr/bin/openclaw",
      [
        "nodes",
        "run",
        "--node",
        "abc123",
        "--json",
        "--timeout",
        "60000",
        "--cwd",
        "/Users/test",
        "--",
        "bash",
        "-c",
        "echo hello",
      ],
      expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] })
    );

    expect(result).toEqual({
      content: [{ type: "text", text: "hello\n\n[exit code: 0]" }],
      isError: false,
    });
  });

  it("handles command failure with non-zero exit code", async () => {
    const config = {
      nodeId: "abc123",
      openclawBin: "openclaw",
      defaultCwd: "/tmp",
      timeoutMs: 300000,
    };
    registerRunTool(mockServer as never, config);
    const handler = mockServer.registerTool.mock.calls[0][2];

    const child = createMockChild();
    mockedSpawn.mockReturnValue(child);

    const resultPromise = handler({ command: "false" }, {});

    const response = JSON.stringify({
      ok: true,
      nodeId: "abc123",
      command: "system.run",
      payload: {
        exitCode: 1,
        timedOut: false,
        success: false,
        stdout: "",
        stderr: "command failed\n",
        error: null,
      },
    });
    child.stdout!.emit("data", Buffer.from(response));
    child.emit("close", 0);

    const result = await resultPromise;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("[stderr] command failed");
    expect(result.content[0].text).toContain("[exit code: 1]");
  });

  it("handles gateway-level errors (non-JSON stderr)", async () => {
    const config = {
      nodeId: "deadbeef",
      openclawBin: "openclaw",
      defaultCwd: "/tmp",
      timeoutMs: 300000,
    };
    registerRunTool(mockServer as never, config);
    const handler = mockServer.registerTool.mock.calls[0][2];

    const child = createMockChild();
    mockedSpawn.mockReturnValue(child);

    const resultPromise = handler({ command: "echo hi" }, {});

    child.stderr!.emit(
      "data",
      Buffer.from("nodes run failed: Error: unknown node: deadbeef")
    );
    child.emit("close", 1);

    const result = await resultPromise;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("unknown node: deadbeef");
  });

  it("handles spawn errors", async () => {
    const config = {
      nodeId: "test",
      openclawBin: "/nonexistent/openclaw",
      defaultCwd: "/tmp",
      timeoutMs: 300000,
    };
    registerRunTool(mockServer as never, config);
    const handler = mockServer.registerTool.mock.calls[0][2];

    const child = createMockChild();
    mockedSpawn.mockReturnValue(child);

    const resultPromise = handler({ command: "echo hi" }, {});
    child.emit("error", new Error("spawn ENOENT"));

    const result = await resultPromise;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("spawn ENOENT");
  });

  it("uses default cwd when not specified", async () => {
    const config = {
      nodeId: "abc123",
      openclawBin: "openclaw",
      defaultCwd: "/Users/me",
      timeoutMs: 300000,
    };
    registerRunTool(mockServer as never, config);
    const handler = mockServer.registerTool.mock.calls[0][2];

    const child = createMockChild();
    mockedSpawn.mockReturnValue(child);

    const resultPromise = handler({ command: "pwd" }, {});

    const response = JSON.stringify({
      ok: true,
      nodeId: "abc123",
      command: "system.run",
      payload: {
        exitCode: 0,
        timedOut: false,
        success: true,
        stdout: "/Users/me\n",
        stderr: "",
        error: null,
      },
    });
    child.stdout!.emit("data", Buffer.from(response));
    child.emit("close", 0);

    await resultPromise;

    expect(mockedSpawn.mock.calls[0][1]).toContain("/Users/me");
  });
});
