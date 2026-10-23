import nodemailer from 'nodemailer'
import { env, isProd } from '../config/env.js'

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null

export const mailConfigured = !!transport

/** Sends an email. Without SMTP, the link is printed to the server console in development only — never claimed as "sent". */
export async function sendMail(to: string, subject: string, text: string): Promise<{ delivered: boolean }> {
  if (transport) {
    await transport.sendMail({ from: env.MAIL_FROM, to, subject, text })
    return { delivered: true }
  }
  if (!isProd) console.log(`\n[mail:dev] To: ${to}\nSubject: ${subject}\n${text}\n`)
  return { delivered: false }
}
