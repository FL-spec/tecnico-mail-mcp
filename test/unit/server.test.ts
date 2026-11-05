import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, test } from "vitest";
import { MailError } from "../../src/errors.js";
import { type AccessMode, createServer, MailContext } from "../../src/server.js";

const READ_TOOLS = ["get_attachment", "get_message", "list_folders", "search_messages"];
const DRAFT_TOOLS = ["create_draft", "flag", "mark_read", "move_message"];
const SEND_TOOLS = ["reply", "send_message"];

async function connect(
  mode: AccessMode,
  loadSettings = async () => {
    throw new MailError("config", "No Técnico account is configured.", "Run login.");
  },
) {
  const server = createServer(new MailContext(loadSettings), mode);
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

describe("access modes", () => {
  test.each([
    ["read-only", READ_TOOLS],
    ["drafts", [...READ_TOOLS, ...DRAFT_TOOLS]],
    ["full", [...READ_TOOLS, ...DRAFT_TOOLS, ...SEND_TOOLS]],
  ] as [AccessMode, string[]][])("%s registers exactly its tools", async (mode, expected) => {
    const { tools } = await (await connect(mode)).listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...expected].sort());
  });
});

describe("annotations", () => {
  test("match each tool's risk", async () => {
    const { tools } = await (await connect("full")).listTools();
    const by = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));
    for (const name of READ_TOOLS) expect(by[name]?.readOnlyHint).toBe(true);
    for (const name of DRAFT_TOOLS) {
      expect(by[name]?.readOnlyHint).toBe(false);
      expect(by[name]?.destructiveHint).toBe(false);
    }
    for (const name of SEND_TOOLS) {
      expect(by[name]?.destructiveHint).toBe(true);
      expect(by[name]?.openWorldHint).toBe(true);
    }
  });

  test("tool schemas give numeric arguments a real type", async () => {
    const { tools } = await (await connect("read-only")).listTools();
    const search = tools.find((t) => t.name === "search_messages");
    expect(search?.inputSchema.properties?.limit).toMatchObject({ maximum: 50 });
  });
});

describe("instructions", () => {
  test("tell the model that mail is untrusted data", async () => {
    expect((await connect("read-only")).getInstructions()).toMatch(/untrusted data/);
  });
});

describe("tool errors", () => {
  test("a missing login comes back as a readable tool error, not a dead server", async () => {
    const result = await (await connect("read-only")).callTool({ name: "list_folders" });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(/No Técnico account.*Run login/);
  });

  test("an unexpected error reveals nothing about its cause", async () => {
    const client = await connect("read-only", async () => {
      throw new Error("secret detail hunter2");
    });
    const result = await client.callTool({ name: "list_folders" });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).not.toContain("hunter2");
  });

  test("numbers sent as strings are accepted, as some models send them", async () => {
    const result = await (await connect("read-only")).callTool({
      name: "get_message",
      arguments: { uid: "12" },
    });
    expect(JSON.stringify(result.content)).toMatch(/No Técnico account/);
  });
});
