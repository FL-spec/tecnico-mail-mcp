import type { ImapFlow } from "imapflow";
import type { Settings } from "../config.js";
import { MailError, toMailError } from "../errors.js";
import { type FolderRole, requireFolder } from "../imap/folders.js";
import type { ImapSession } from "../imap/session.js";
import { logInfo } from "../log.js";
import { buildMessage, buildReply, type OutgoingMail, type ReplyOptions } from "../mail/compose.js";
import { parseMail } from "../mail/parse.js";
import type { SendingBudget } from "../smtp/budget.js";
import { createSmtpTransport } from "../smtp/transport.js";
import { fetchSource } from "./read.js";

export const MAX_UIDS = 50;

async function loadOriginal(session: ImapSession, folder: string, uid: number) {
  const source = await session.withFolder(folder, "read", (client) => fetchSource(client, uid));
  return parseMail(source);
}

export interface ReplyTarget {
  folder: string;
  uid: number;
  reply_all: boolean;
  quote: boolean;
}

async function replyMail(
  session: ImapSession,
  settings: Settings,
  target: ReplyTarget,
  body: string,
): Promise<OutgoingMail> {
  const original = await loadOriginal(session, target.folder, target.uid);
  const options: ReplyOptions = { body, replyAll: target.reply_all, quote: target.quote };
  return buildReply(original, settings.email, options);
}

export interface DraftInput {
  to?: string[] | undefined;
  cc?: string[] | undefined;
  bcc?: string[] | undefined;
  subject?: string | undefined;
  body: string;
  reply_to?: ReplyTarget | undefined;
}

export async function createDraft(session: ImapSession, settings: Settings, input: DraftInput) {
  const base = input.reply_to
    ? await replyMail(session, settings, input.reply_to, input.body)
    : { to: [], cc: [], bcc: [], subject: "", body: input.body };
  const mail: OutgoingMail = {
    ...base,
    to: input.to ?? base.to,
    cc: input.cc ?? base.cc,
    bcc: input.bcc ?? base.bcc,
    subject: input.subject ?? base.subject,
  };
  const built = await buildMessage(settings, mail);
  return session.run(async (client) => {
    const folder = await requireFolder(client, "drafts");
    const saved = await client.append(folder, built.stored, ["\\Draft", "\\Seen"]);
    return {
      saved: true,
      folder,
      uid: saved ? (saved.uid ?? null) : null,
      to: mail.to,
      cc: mail.cc,
      subject: mail.subject,
      note: "Nothing was sent. Review and send it from webmail or a mail client.",
    };
  });
}

async function saveToSent(session: ImapSession, message: Buffer): Promise<string | null> {
  try {
    return await session.run(async (client: ImapFlow) => {
      const folder = await requireFolder(client, "sent");
      await client.append(folder, message, ["\\Seen"]);
      return folder;
    });
  } catch (error) {
    logInfo(`could not save a copy to Sent: ${toMailError(error).code}`);
    return null;
  }
}

/**
 * Only a clear refusal from the server proves a message wasn't sent. A lost connection doesn't,
 * and nodemailer labels one the same way whether it happened before or during delivery.
 */
function wasDefinitelyNotSent(raw: unknown): boolean {
  const { code } = raw as { code?: string };
  return code === "EAUTH" || code === "EENVELOPE" || code === "EMESSAGE";
}

async function deliver(
  session: ImapSession,
  settings: Settings,
  budget: SendingBudget,
  mail: OutgoingMail,
) {
  session.assertLoginAllowed();
  const built = await buildMessage(settings, mail);
  const refund = budget.reserve(built.envelope.to.length);
  const transport = createSmtpTransport(settings);
  let info: { accepted?: unknown[] | undefined; rejected?: unknown[] | undefined };
  try {
    info = await transport.sendMail({ envelope: built.envelope, raw: built.delivered });
  } catch (raw) {
    const error = toMailError(raw);
    if (error.code === "auth") session.recordAuthFailure(error);
    if (!wasDefinitelyNotSent(raw)) {
      throw new MailError(
        "network",
        "The connection failed while sending, so this message may have been sent.",
        "Check with the recipient or in webmail before sending it again.",
      );
    }
    refund();
    throw error;
  } finally {
    transport.close();
  }
  const sentFolder = await saveToSent(session, built.stored);
  return {
    sent: true,
    message_id: built.messageId,
    subject: mail.subject,
    accepted: (info.accepted ?? []).map(String),
    rejected: (info.rejected ?? []).map(String),
    saved_to_sent: sentFolder !== null,
    ...(sentFolder ? { sent_folder: sentFolder } : {}),
    ...(sentFolder
      ? {}
      : { warning: "The message was sent, but no copy could be saved. Do not send it again." }),
  };
}

export interface SendInput {
  to: string[];
  cc?: string[] | undefined;
  bcc?: string[] | undefined;
  subject: string;
  body: string;
}

export function sendMessage(
  session: ImapSession,
  settings: Settings,
  budget: SendingBudget,
  input: SendInput,
) {
  return deliver(session, settings, budget, {
    to: input.to,
    cc: input.cc ?? [],
    bcc: input.bcc ?? [],
    subject: input.subject,
    body: input.body,
  });
}

export async function reply(
  session: ImapSession,
  settings: Settings,
  budget: SendingBudget,
  input: ReplyTarget & { body: string },
) {
  const mail = await replyMail(session, settings, input, input.body);
  return deliver(session, settings, budget, mail);
}

function checkUids(uids: number[]): void {
  if (uids.length === 0) throw new MailError("invalid_input", "Give at least one UID.");
  if (uids.length > MAX_UIDS) {
    throw new MailError("limit", `At most ${MAX_UIDS} messages can change in one call.`);
  }
}

export async function setFlag(
  session: ImapSession,
  input: { folder: string; uids: number[]; flag: "\\Seen" | "\\Flagged"; on: boolean },
) {
  checkUids(input.uids);
  await session.withFolder(input.folder, "write", (client) =>
    input.on
      ? client.messageFlagsAdd(input.uids, [input.flag], { uid: true })
      : client.messageFlagsRemove(input.uids, [input.flag], { uid: true }),
  );
  return { folder: input.folder, uids: input.uids, updated: true };
}

const DESTINATION_ROLES: Record<string, FolderRole> = {
  trash: "trash",
  junk: "junk",
  archive: "archive",
};

export async function moveMessages(
  session: ImapSession,
  input: { folder: string; uids: number[]; destination: string },
) {
  checkUids(input.uids);
  const role = DESTINATION_ROLES[input.destination.toLowerCase()];
  const destination = await session.run(async (client) => {
    if (role) return requireFolder(client, role);
    const exists = (await client.list()).some((folder) => folder.path === input.destination);
    if (!exists) {
      throw new MailError(
        "not_found",
        `There is no folder called "${input.destination}".`,
        "Use list_folders to see them.",
      );
    }
    return input.destination;
  });
  const moved = await session.withFolder(input.folder, "write", (client) =>
    client.messageMove(input.uids, destination, { uid: true }),
  );
  if (!moved) throw new MailError("server", "The mail server did not move the messages.");
  return {
    folder: input.folder,
    destination,
    moved: moved.uidMap ? moved.uidMap.size : input.uids.length,
    new_uids: moved.uidMap ? Object.fromEntries(moved.uidMap) : null,
  };
}
