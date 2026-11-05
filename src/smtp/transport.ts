import { createTransport, type Transporter } from "nodemailer";
import type { Settings } from "../config.js";

export function createSmtpTransport(settings: Settings): Transporter {
  return createTransport({
    host: settings.smtp.host,
    port: settings.smtp.port,
    secure: true,
    auth: { user: settings.id, pass: settings.password },
    tls: { minVersion: "TLSv1.2", ...(settings.tlsCa ? { ca: settings.tlsCa } : {}) },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
  });
}
