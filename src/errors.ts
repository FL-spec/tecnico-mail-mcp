export type MailErrorCode =
  | "config"
  | "auth"
  | "network"
  | "not_found"
  | "invalid_input"
  | "limit"
  | "unsupported"
  | "server";

/** A failure a person can act on: what went wrong, then what to do. Never holds a secret. */
export class MailError extends Error {
  constructor(
    readonly code: MailErrorCode,
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "MailError";
  }

  describe(): string {
    return this.hint ? `${this.message} ${this.hint}` : this.message;
  }
}

const AUTH_HINT =
  "Check that the username is your Técnico ID (istxxxxx), not your email address, and that the " +
  "password works at https://webmail.tecnico.ulisboa.pt. If it works there but not here, DSI may " +
  "have changed how mail login works. Restart the server after fixing this.";

const TLS_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

interface LibraryError {
  responseCode?: number;
  authenticationFailed?: boolean;
  code?: string;
  serverResponseCode?: string;
  mailboxMissing?: boolean;
}

/**
 * Turns an imapflow, nodemailer or socket error into a MailError. The original message is dropped
 * on purpose: library errors can echo protocol text, which is never shown or logged.
 */
export function toMailError(error: unknown): MailError {
  if (error instanceof MailError) return error;
  const e = (error ?? {}) as LibraryError;
  if (
    e.authenticationFailed ||
    e.code === "EAUTH" ||
    e.serverResponseCode === "AUTHENTICATIONFAILED"
  ) {
    return new MailError("auth", "The Técnico mail server refused the login.", AUTH_HINT);
  }
  if (e.code && TLS_CODES.has(e.code)) {
    return new MailError(
      "network",
      `The mail server's TLS certificate could not be verified (${e.code}).`,
      "The connection was closed and no password was sent.",
    );
  }
  if (e.code === "EENVELOPE" || e.code === "EMESSAGE") {
    return new MailError(
      "server",
      `The mail server refused this message${e.responseCode ? ` (code ${e.responseCode})` : ""}.`,
      "Check the addresses. DSI also limits sending to 200 emails in 5 minutes, 450 per hour, and 500 per day, counting each recipient.",
    );
  }
  if (
    e.mailboxMissing ||
    e.serverResponseCode === "NONEXISTENT" ||
    e.serverResponseCode === "TRYCREATE"
  ) {
    return new MailError(
      "not_found",
      "That folder does not exist.",
      "Use list_folders to see them.",
    );
  }
  if (e.code && /^(E[A-Z]+|NoConnection)$/.test(e.code)) {
    return new MailError(
      "network",
      `Could not reach the Técnico mail server (${e.code}).`,
      "Check your internet connection and try again.",
    );
  }
  return new MailError("server", "The mail server rejected the request.");
}
