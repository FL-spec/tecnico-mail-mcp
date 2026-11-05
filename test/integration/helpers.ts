import { ImapFlow } from "imapflow";
import { SMTPServer } from "smtp-server";
import { inject } from "vitest";
import type { Settings } from "../../src/config.js";

let counter = 0;

/** A new username gets a new, empty mailbox, so tests can't see each other's mail. */
export function freshAccount(smtpPort = 1): Settings {
  counter += 1;
  return {
    id: `ist${Date.now() % 1_000_000}${counter}`,
    email: "ana.silva@tecnico.ulisboa.pt",
    name: "Ana Silva",
    password: inject("password"),
    imap: { host: "localhost", port: inject("imapPort") },
    smtp: { host: "localhost", port: smtpPort },
    tlsCa: inject("tlsCert"),
  };
}

export async function withRawClient<T>(
  settings: Settings,
  work: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow({
    host: settings.imap.host,
    port: settings.imap.port,
    secure: true,
    auth: { user: settings.id, pass: settings.password },
    logger: false,
    ...(settings.tlsCa ? { tls: { ca: settings.tlsCa } } : {}),
  });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.logout();
  }
}

export interface ReceivedMail {
  from: string;
  to: string[];
  raw: string;
}

/** A local SMTP server with TLS and password login, standing in for Técnico's Postfix. */
export async function startSmtpServer(
  password: string,
  options: { dropOnData?: boolean } = {},
): Promise<{
  port: number;
  received: ReceivedMail[];
  authAttempts: () => number;
  resetAuthAttempts: () => void;
  stop: () => Promise<void>;
}> {
  const received: ReceivedMail[] = [];
  let attempts = 0;
  const server = new SMTPServer({
    secure: true,
    key: inject("tlsKey"),
    cert: inject("tlsCert"),
    authMethods: ["PLAIN", "LOGIN"],
    onAuth(auth, _session, callback) {
      attempts += 1;
      if (auth.password === password) callback(null, { user: auth.username });
      else callback(new Error("Invalid credentials"));
    },
    onData(stream, session, callback) {
      if (options.dropOnData) {
        (session as unknown as { socket?: { destroy(): void } }).socket?.destroy();
        for (const connection of server.connections) connection._socket.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        received.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
          to: session.envelope.rcptTo.map((r) => r.address),
          raw: Buffer.concat(chunks).toString("utf8"),
        });
        callback();
      });
    },
    logger: false,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = (
    server as unknown as { server: { address(): { port: number } } }
  ).server.address();
  return {
    port: address.port,
    received,
    authAttempts: () => attempts,
    resetAuthAttempts: () => {
      attempts = 0;
    },
    stop: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
