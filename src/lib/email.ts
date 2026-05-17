import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.EMAIL_FROM ?? "NovelHub <onboarding@resend.dev>"

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  await resend.emails.send({ from: FROM, to, subject, html })
}
