import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';

export type MailAttachment = { filename: string; content: Buffer };

export type SendMailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: MailAttachment[];
};

let transporter: Transporter | null = null;

function buildTransport(): Transporter {
  return nodemailer.createTransport({
    host: config.smtp.host || 'localhost',
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

/** Overrides the transporter — used by tests to mock outbound email. Pass `null` to reset to a fresh SMTP transport. */
export function setMailTransport(custom: Transporter | null): void {
  transporter = custom;
}

function getTransport(): Transporter {
  if (!transporter) {
    transporter = buildTransport();
  }
  return transporter;
}

export const mailService = {
  async sendMail(options: SendMailOptions) {
    const transport = getTransport();
    return transport.sendMail({
      from: config.smtp.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });
  },
};
