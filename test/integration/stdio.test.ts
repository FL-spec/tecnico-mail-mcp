import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import type { Settings } from "../../src/config.js";
import { freshAccount, withRawClient } from "./helpers.js";

const BUILD_OUTPUTS = [
  ["npm package", "dist/index.js"],
  ["Desktop Extension", "dist/mcpb/server/index.js"],
];

describe.each(BUILD_OUTPUTS)("the built %s, over real stdio", (_name, entry) => {
  let account: Settings;
  let client: Client;
  let stderr = "";

  beforeAll(async () => {
    execFileSync("node", ["scripts/build.mjs"]);
    account = freshAccount();
    await withRawClient(account, (c) =>
      c.append(
        "INBOX",
        "From: x@x.pt\r\nSubject: Olá\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nCorpo secreto da mensagem\r\n",
      ),
    );
    const ca = join(mkdtempSync(join(tmpdir(), "tmcp-ca-")), "ca.pem");
    writeFileSync(ca, inject("tlsCert"));
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry as string],
      stderr: "pipe",
      env: {
        PATH: process.env.PATH ?? "",
        NODE_EXTRA_CA_CERTS: ca,
        XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), "tmcp-config-")),
        TECNICO_ID: account.id,
        TECNICO_EMAIL: account.email,
        TECNICO_PASSWORD: account.password,
        TECNICO_IMAP_HOST: "localhost",
        TECNICO_IMAP_PORT: String(account.imap.port),
      },
    });
    transport.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    client = new Client({ name: "test", version: "1" });
    await client.connect(transport);
  });
  afterAll(() => client.close());

  test("defaults to drafts mode, with no sending tool", async () => {
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toContain("create_draft");
    expect(names).not.toContain("send_message");
    expect(names).not.toContain("reply");
  });

  test("answers a real tool call end to end", async () => {
    const result = await client.callTool({
      name: "search_messages",
      arguments: { subject: "Olá" },
    });
    const data = JSON.parse((result.content as { text: string }[])[0]?.text ?? "");
    expect(data.total).toBe(1);
    const uid = data.messages[0].uid;
    const message = await client.callTool({ name: "get_message", arguments: { uid } });
    expect(JSON.stringify(message.content)).toContain("Corpo secreto");
  });

  test("the logs hold neither the password nor mail content", () => {
    expect(stderr).toContain("drafts mode");
    expect(stderr).not.toContain(account.password);
    expect(stderr).not.toContain("Corpo secreto");
  });
});
