import { describe, expect, test } from "vitest";
import { MailError, toMailError } from "../../src/errors.js";

describe("toMailError", () => {
  test("names the username mistake on a login failure", () => {
    const e = toMailError({ authenticationFailed: true, message: "NO [AUTHENTICATIONFAILED]" });
    expect(e.code).toBe("auth");
    expect(e.describe()).toMatch(/istxxxxx/);
  });

  test("treats a nodemailer login failure the same way", () =>
    expect(toMailError({ code: "EAUTH" }).code).toBe("auth"));

  test("says no password was sent when TLS verification fails", () => {
    expect(toMailError({ code: "CERT_HAS_EXPIRED" }).describe()).toMatch(/no password was sent/);
  });

  test("maps a missing folder and a socket failure", () => {
    expect(toMailError({ serverResponseCode: "NONEXISTENT" }).code).toBe("not_found");
    expect(toMailError({ code: "ECONNRESET" }).code).toBe("network");
    expect(toMailError({ code: "NoConnection" }).code).toBe("network");
  });

  test("never repeats a library's message, which could echo protocol text", () => {
    const e = toMailError(new Error("LOGIN ist123456 hunter2"));
    expect(e.describe()).not.toContain("hunter2");
  });

  test("explains a refused message and DSI's limits", () => {
    const e = toMailError({ code: "EENVELOPE", responseCode: 550 });
    expect(e.code).toBe("server");
    expect(e.describe()).toMatch(/code 550.*500 per day/);
  });

  test("passes a MailError through", () => {
    const original = new MailError("limit", "Too many.");
    expect(toMailError(original)).toBe(original);
  });
});
