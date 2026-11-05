import { ImapFlow } from "imapflow";
import type { Settings } from "../config.js";
import { MailError, toMailError } from "../errors.js";
import { logInfo } from "../log.js";

export interface SessionOptions {
  /** Upper bound for one operation, including connecting. */
  timeoutMs?: number;
  /** Minimum gap between operations, so heavy use doesn't trigger server throttling. */
  minIntervalMs?: number;
}

export function createImapClient(settings: Settings): ImapFlow {
  return new ImapFlow({
    host: settings.imap.host,
    port: settings.imap.port,
    secure: true,
    auth: { user: settings.id, pass: settings.password },
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      ...(settings.tlsCa ? { ca: settings.tlsCa } : {}),
    },
    // logger: false keeps protocol traffic, which holds mail content, out of every log.
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
  });
}

/**
 * The one IMAP connection. Operations run one at a time, never in parallel. A closed ImapFlow can't
 * be reused, so reconnecting always builds a new client. Nothing else in the codebase creates one.
 */
export class ImapSession {
  #client: ImapFlow | null = null;
  #queue: Promise<unknown> = Promise.resolve();
  #lastRunAt = 0;
  #authFailure: MailError | null = null;
  #generation = 0;
  readonly #timeoutMs: number;
  readonly #minIntervalMs: number;

  constructor(
    private readonly settings: Settings,
    options: SessionOptions = {},
  ) {
    this.#timeoutMs = options.timeoutMs ?? 120_000;
    this.#minIntervalMs = options.minIntervalMs ?? 100;
  }

  /** Runs one operation on the connection. Only idempotent reads should pass `retry`. */
  run<T>(
    operation: (client: ImapFlow) => Promise<T>,
    options: { retry?: boolean } = {},
  ): Promise<T> {
    const next = this.#queue.then(() => this.#attempt(operation, options.retry ?? false));
    this.#queue = next.catch(() => undefined);
    return next;
  }

  /** Opens a folder for one operation. Read mode can't change the folder, even by accident. */
  withFolder<T>(
    path: string,
    mode: "read" | "write",
    operation: (client: ImapFlow) => Promise<T>,
  ): Promise<T> {
    return this.run(
      async (client) => {
        const lock = await client.getMailboxLock(path, { readOnly: mode === "read" });
        try {
          // A folder that stays selected doesn't see new mail until the server is asked to sync.
          await client.noop();
          return await operation(client);
        } finally {
          lock.release();
        }
      },
      { retry: mode === "read" },
    );
  }

  async close(): Promise<void> {
    await this.#queue;
    const client = this.#client;
    this.#client = null;
    if (!client) return;
    const giveUp = new Promise<void>((resolve) => setTimeout(resolve, 2_000).unref());
    await Promise.race([client.logout().catch(() => undefined), giveUp]);
    client.close();
  }

  /** The IMAP and SMTP logins share one password, so one rejection stops both. */
  assertLoginAllowed(): void {
    if (this.#authFailure) throw this.#authFailure;
  }

  recordAuthFailure(error: MailError): void {
    this.#authFailure ??= error;
  }

  async #attempt<T>(operation: (client: ImapFlow) => Promise<T>, retry: boolean): Promise<T> {
    // A wrong password is not retried: repeated failures could lock the person's Técnico account.
    this.assertLoginAllowed();
    const wait = this.#lastRunAt + this.#minIntervalMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.#lastRunAt = Date.now();
    try {
      return await this.#runOnce(operation);
    } catch (raw) {
      const error = toMailError(raw);
      if (error.code !== "network" || !retry) throw error;
      this.assertLoginAllowed();
      logInfo("connection lost, retrying once");
      this.#drop();
      return await this.#runOnce(operation).catch((e) => {
        throw toMailError(e);
      });
    }
  }

  #runOnce<T>(operation: (client: ImapFlow) => Promise<T>): Promise<T> {
    const generation = ++this.#generation;
    return this.#withTimeout(async () => {
      const client = await this.#connected();
      // After a timeout, the next operation owns the connection, so this one must not start.
      if (generation !== this.#generation)
        throw new MailError("network", "The operation timed out.");
      return operation(client);
    });
  }

  async #connected(): Promise<ImapFlow> {
    if (this.#client?.usable) return this.#client;
    this.#drop();
    const client = createImapClient(this.settings);
    // Without this listener, a socket timeout would crash the process.
    client.on("error", (error: { code?: string }) => {
      logInfo(`connection error: ${error.code ?? "unknown"}`);
    });
    client.once("close", () => {
      if (this.#client === client) this.#client = null;
    });
    // Tracked before connecting, so that a timeout can close a connection still in progress.
    this.#client = client;
    try {
      await client.connect();
    } catch (raw) {
      const error = toMailError(raw);
      // This also runs when the operation already timed out, so a late rejection still counts.
      if (error.code === "auth") this.recordAuthFailure(error);
      throw error;
    }
    return client;
  }

  #drop(): void {
    const client = this.#client;
    this.#client = null;
    client?.close();
  }

  async #withTimeout<T>(work: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.#generation++;
        this.#drop();
        reject(new MailError("network", "The mail server took too long to answer.", "Try again."));
      }, this.#timeoutMs);
    });
    try {
      return await Promise.race([work(), deadline]);
    } finally {
      clearTimeout(timer);
    }
  }
}
