import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { checkImap, checkSmtp } from "../../src/connectivity.js";
import { MailError } from "../../src/errors.js";
import { ImapSession } from "../../src/imap/session.js";
import { freshAccount, startSmtpServer } from "./helpers.js";

describe("ImapSession against Dovecot", () => {
  test("connects over verified TLS and runs an operation", async () => {
    const session = new ImapSession(freshAccount());
    const paths = await session.run(async (client) => (await client.list()).map((f) => f.path));
    expect(paths).toContain("INBOX");
    await session.close();
  });

  test("refuses a certificate it does not trust, before sending a password", async () => {
    const { tlsCa: _ignored, ...untrusted } = freshAccount();
    const session = new ImapSession(untrusted);
    await expect(session.run((client) => client.list())).rejects.toMatchObject({ code: "network" });
    await session.close();
  });

  test("stops trying after a wrong password, so it can't lock the account", async () => {
    const session = new ImapSession({ ...freshAccount(), password: "wrong" });
    const first = await session.run((c) => c.list()).catch((e) => e);
    expect(first).toMatchObject({ code: "auth" });
    expect(first.describe()).toMatch(/istxxxxx/);
    const start = Date.now();
    await expect(session.run((c) => c.list())).rejects.toBe(first);
    expect(Date.now() - start).toBeLessThan(500);
    await session.close();
  });

  test("a wrong password counts even when the operation already timed out", async () => {
    const session = new ImapSession({ ...freshAccount(), password: "wrong" }, { timeoutMs: 1 });
    await expect(session.run((c) => c.list())).rejects.toMatchObject({ code: "network" });
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await session.close();
  });

  test("a read retry after a wrong password makes no further login", async () => {
    const session = new ImapSession({ ...freshAccount(), password: "wrong" });
    let calls = 0;
    await expect(
      session.run(
        async () => {
          calls += 1;
        },
        { retry: true },
      ),
    ).rejects.toMatchObject({ code: "auth" });
    expect(calls).toBe(0);
    await session.close();
  });

  test("a rejected SMTP login stops IMAP logins too", async () => {
    const session = new ImapSession(freshAccount());
    session.recordAuthFailure(new MailError("auth", "refused"));
    await expect(session.run(async () => 1)).rejects.toMatchObject({ code: "auth" });
    await session.close();
  });

  test("a timed-out operation that was still connecting never starts", async () => {
    const session = new ImapSession(freshAccount(), { timeoutMs: 1 });
    let started = false;
    await expect(
      session.run(async () => {
        started = true;
      }),
    ).rejects.toMatchObject({ code: "network" });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(started).toBe(false);
    await session.close();
  });

  test("reconnects with a new client after the connection drops", async () => {
    const session = new ImapSession(freshAccount());
    const first = await session.run(async (client) => {
      client.close();
      return client;
    });
    const second = await session.run(async (client) => client);
    expect(second).not.toBe(first);
    expect(second.usable).toBe(true);
    await session.close();
  });

  test("retries a read once when the connection dies during it", async () => {
    const session = new ImapSession(freshAccount());
    let calls = 0;
    const result = await session.run(
      async (client) => {
        calls += 1;
        if (calls === 1) {
          client.close();
          throw Object.assign(new Error("gone"), { code: "ECONNRESET" });
        }
        return "ok";
      },
      { retry: true },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(2);
    await session.close();
  });

  test("does not retry a write, which might already have applied", async () => {
    const session = new ImapSession(freshAccount());
    let calls = 0;
    await expect(
      session.run(async () => {
        calls += 1;
        throw Object.assign(new Error("gone"), { code: "ECONNRESET" });
      }),
    ).rejects.toMatchObject({ code: "network" });
    expect(calls).toBe(1);
    await session.close();
  });

  test("runs operations one at a time", async () => {
    const session = new ImapSession(freshAccount());
    let active = 0;
    let peak = 0;
    const work = () =>
      session.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
      });
    await Promise.all([work(), work(), work()]);
    expect(peak).toBe(1);
    await session.close();
  });

  test("fails an operation that hangs, and recovers afterwards", async () => {
    const session = new ImapSession(freshAccount(), { timeoutMs: 1000 });
    await expect(session.run(() => new Promise(() => undefined))).rejects.toMatchObject({
      code: "network",
    });
    await expect(session.run(async () => "ok")).resolves.toBe("ok");
    await session.close();
  });

  test("a missing folder gives a clear error", async () => {
    const session = new ImapSession(freshAccount());
    await expect(session.withFolder("Nope", "read", async () => 1)).rejects.toMatchObject({
      code: "not_found",
    });
    await session.close();
  });
});

describe("connectivity checks", () => {
  let smtp: Awaited<ReturnType<typeof startSmtpServer>>;
  beforeAll(async () => {
    smtp = await startSmtpServer("right");
  });
  afterAll(() => smtp.stop());

  test("checkImap reports SPECIAL-USE folders under their Portuguese names", async () => {
    const report = await checkImap(freshAccount());
    expect(report.folders).toContainEqual({ path: "Enviados", specialUse: "\\Sent" });
    expect(report.folders).toContainEqual({ path: "Rascunhos", specialUse: "\\Drafts" });
    expect(report.capabilities).toContain("IDLE");
  });

  test("checkSmtp verifies the login and sends nothing", async () => {
    await checkSmtp({ ...freshAccount(smtp.port), password: "right" });
    expect(smtp.received).toHaveLength(0);
  });

  test("checkSmtp reports a wrong password as a login failure", async () => {
    await expect(
      checkSmtp({ ...freshAccount(smtp.port), password: "wrong" }),
    ).rejects.toMatchObject({
      code: "auth",
    });
  });
});
