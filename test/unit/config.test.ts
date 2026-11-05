import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  configPath,
  deleteIdentityFile,
  loadSettings,
  parseTecnicoEmail,
  parseTecnicoId,
  readIdentityFile,
  SERVER_HOST,
  writeIdentityFile,
} from "../../src/config.js";

const ENV = {
  TECNICO_ID: "IST123456",
  TECNICO_EMAIL: "Ana.Silva@tecnico.ulisboa.pt",
  TECNICO_PASSWORD: "pw",
};

describe("parseTecnicoId", () => {
  test("normalizes a valid ID", () => expect(parseTecnicoId(" IST123456 ")).toBe("ist123456"));
  test("explains the mistake of using an email address", () =>
    expect(() => parseTecnicoId("ana@tecnico.ulisboa.pt")).toThrow(/looks like an email address/));
  test("rejects other text", () => expect(() => parseTecnicoId("ana")).toThrow(/not a Técnico ID/));
});

describe("parseTecnicoEmail", () => {
  test("accepts the chosen address", () =>
    expect(parseTecnicoEmail("Ana.Silva@tecnico.ulisboa.pt")).toBe("ana.silva@tecnico.ulisboa.pt"));
  test("refuses the istxxxxx form, as DSI documents it never exists", () =>
    expect(() => parseTecnicoEmail("ist123456@tecnico.ulisboa.pt")).toThrow(/never has the form/));
  test("refuses text that is not an address", () =>
    expect(() => parseTecnicoEmail("ana")).toThrow(/not an email/));
});

describe("loadSettings", () => {
  test("reads the environment and defaults to the Técnico server", async () => {
    const s = await loadSettings({ env: ENV, file: {} });
    expect(s).toMatchObject({
      id: "ist123456",
      email: "ana.silva@tecnico.ulisboa.pt",
      password: "pw",
    });
    expect(s.imap).toEqual({ host: SERVER_HOST, port: 993 });
    expect(s.smtp).toEqual({ host: SERVER_HOST, port: 465 });
  });

  test("environment overrides the config file", async () => {
    const file = { id: "ist999999", email: "other@tecnico.ulisboa.pt" };
    expect((await loadSettings({ env: ENV, file })).id).toBe("ist123456");
  });

  test("takes identity from the file and the password from the keychain", async () => {
    const file = { id: "ist123456", email: "ana@tecnico.ulisboa.pt", name: "Ana" };
    const s = await loadSettings({ env: {}, file, keychainPassword: async () => "stored" });
    expect(s).toMatchObject({ password: "stored", name: "Ana" });
  });

  test("treats an unfilled Claude Desktop placeholder as unset", async () => {
    const env = { TECNICO_ID: "${user_config.id}", TECNICO_EMAIL: "", TECNICO_PASSWORD: "x" };
    await expect(loadSettings({ env, file: {} })).rejects.toThrow(/No Técnico account/);
  });

  test("names the fix when the password is missing", async () => {
    const env = { TECNICO_ID: "ist123456", TECNICO_EMAIL: "ana@tecnico.ulisboa.pt" };
    await expect(loadSettings({ env, file: {} })).rejects.toThrow(/No password is stored/);
  });

  test("rejects a bad port", async () => {
    await expect(
      loadSettings({ env: { ...ENV, TECNICO_IMAP_PORT: "abc" }, file: {} }),
    ).rejects.toThrow(/port/);
  });
});

describe("identity file", () => {
  test("round-trips, holds no password and is private to the user", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tmcp-"));
    const path = join(dir, "sub", "config.json");
    await writeIdentityFile({ id: "ist123456", email: "ana@tecnico.ulisboa.pt" }, path);
    expect(await readIdentityFile(path)).toEqual({
      id: "ist123456",
      email: "ana@tecnico.ulisboa.pt",
    });
    expect(await readFile(path, "utf8")).not.toMatch(/password/i);
    if (process.platform !== "win32") expect((await stat(path)).mode & 0o777).toBe(0o600);
    await deleteIdentityFile(path);
    expect(await readIdentityFile(path)).toEqual({});
  });

  test("uses XDG_CONFIG_HOME and APPDATA", () => {
    expect(configPath({ XDG_CONFIG_HOME: "/x" }, "linux")).toBe(
      join("/x", "tecnico-mail-mcp", "config.json"),
    );
    expect(configPath({ APPDATA: "/a" }, "win32")).toBe(
      join("/a", "tecnico-mail-mcp", "config.json"),
    );
  });
});
