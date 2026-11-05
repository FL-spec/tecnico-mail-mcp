import { MailError } from "../errors.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// DSI blocks an account for 24 hours at 500 emails per day, counting each recipient, with lower
// limits at 200 in 5 minutes and 450 per hour. These local caps stay well under all of them.
export const MAX_RECIPIENTS_PER_HOUR = 60;
export const MAX_RECIPIENTS_PER_DAY = 200;

/** Counts recipients sent by this running server. Restarting the server resets the count. */
export class SendingBudget {
  #sends: { at: number; recipients: number }[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  /** Reserves the recipients before anything is sent. Returns a function that gives them back. */
  reserve(recipients: number): () => void {
    const now = this.now();
    this.#sends = this.#sends.filter((send) => send.at > now - DAY);
    const inWindow = (window: number) =>
      this.#sends.filter((s) => s.at > now - window).reduce((sum, s) => sum + s.recipients, 0);
    if (inWindow(HOUR) + recipients > MAX_RECIPIENTS_PER_HOUR) {
      throw new MailError(
        "limit",
        `This would exceed the local limit of ${MAX_RECIPIENTS_PER_HOUR} recipients per hour.`,
        "The limit protects your account from DSI's 24-hour sending block. Try again later.",
      );
    }
    if (inWindow(DAY) + recipients > MAX_RECIPIENTS_PER_DAY) {
      throw new MailError(
        "limit",
        `This would exceed the local limit of ${MAX_RECIPIENTS_PER_DAY} recipients per day.`,
        "The limit protects your account from DSI's 24-hour sending block. Try again tomorrow.",
      );
    }
    const send = { at: now, recipients };
    this.#sends.push(send);
    return () => {
      this.#sends = this.#sends.filter((s) => s !== send);
    };
  }
}
