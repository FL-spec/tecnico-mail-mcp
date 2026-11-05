import { beforeEach, describe, expect, test, vi } from "vitest";
import { type Dependencies, doctor, login, logout } from "../../src/cli/commands.js";
import type { Settings } from "../../src/config.js";

const BASE: Settings = {
  id: "ist00000",
  email: "x@x.xx",
  password: "x",
  imap: { host: "h", port: 993 },
  smtp: { host: "h", port: 465 },
};

let lines: string[];
let deps: Dependencies;

function answers(...values: string[]): Dependencies["prompter"] {
  const queue = [...values];
  const next = async () => queue.shift() ?? "";
  return { ask: next, askHidden: next };
}

beforeEach(() => {
  lines = [];
  deps = {
    prompter: answers("IST123456", "ana.silva@tecnico.ulisboa.pt", "Ana Silva", "s3cret"),
    print: (line) => lines.push(line),
    checkImap: vi.fn(async () => ({
      capabilities: ["IDLE", "IMAP4REV1"],
      folders: [{ path: "Enviados", specialUse: "\\Sent" }, { path: "INBOX" }],
    })),
    checkSmtp: vi.fn(async () => undefined),
    storePassword: vi.fn(async () => true),
    deletePassword: vi.fn(async () => true),
    writeIdentity: vi.fn(async () => undefined),
    readIdentity: vi.fn(async () => ({ id: "ist123456" })),
    deleteIdentity: vi.fn(async () => undefined),
    loadSettings: vi.fn(async () => ({ ...BASE, id: "ist123456", password: "s3cret" })),
  };
});

describe("login", () => {
  test("tests both logins, then stores the password apart from the identity", async () => {
    await login(deps, BASE);
    expect(deps.checkImap).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ist123456", password: "s3cret" }),
    );
    expect(deps.checkSmtp).toHaveBeenCalled();
    expect(deps.storePassword).toHaveBeenCalledWith("ist123456", "s3cret");
    expect(deps.writeIdentity).toHaveBeenCalledWith({
      id: "ist123456",
      email: "ana.silva@tecnico.ulisboa.pt",
      name: "Ana Silva",
    });
    expect(lines.join("\n")).not.toContain("s3cret");
  });

  test("saves nothing when a login fails", async () => {
    deps.checkSmtp = vi.fn(async () => {
      throw new Error("refused");
    });
    await expect(login(deps, BASE)).rejects.toThrow("refused");
    expect(deps.writeIdentity).not.toHaveBeenCalled();
    expect(deps.storePassword).not.toHaveBeenCalled();
  });

  test("rejects an email address as the ID before asking for a password", async () => {
    deps.prompter = answers("ana@tecnico.ulisboa.pt");
    await expect(login(deps, BASE)).rejects.toThrow(/looks like an email/);
    expect(deps.checkImap).not.toHaveBeenCalled();
  });

  test("explains the fallback when there is no keychain", async () => {
    deps.storePassword = vi.fn(async () => false);
    await login(deps, BASE);
    expect(lines.join("\n")).toMatch(/TECNICO_PASSWORD/);
  });
});

describe("logout", () => {
  test("removes the password and the identity", async () => {
    await logout(deps);
    expect(deps.deletePassword).toHaveBeenCalledWith("ist123456");
    expect(deps.deleteIdentity).toHaveBeenCalled();
  });
});

describe("doctor", () => {
  test("reports detected folders and never prints the password", async () => {
    await doctor(deps);
    const out = lines.join("\n");
    expect(out).toMatch(/Sent\s+Enviados/);
    expect(out).toMatch(/Drafts\s+not detected/);
    expect(out).toMatch(/No message was sent/);
    expect(out).not.toContain("s3cret");
  });
});
