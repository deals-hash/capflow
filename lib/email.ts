import { Resend } from 'resend'
import jwt from 'jsonwebtoken'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM ?? 'CapFlow <onboarding@resend.dev>'

function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function makeToken(payload: object) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' })
}

function usd(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export async function sendBrokerOfferEmail({
  dealId,
  brokerName,
  brokerEmail,
  merchantName,
  amount,
}: {
  dealId: string
  brokerName: string
  brokerEmail: string
  merchantName: string
  amount: number
}) {
  const token = makeToken({ dealId, type: 'broker' })
  const link = `${appUrl()}/broker?token=${token}`

  return resend.emails.send({
    from: FROM,
    to: brokerEmail,
    subject: `New Offer Ready — ${merchantName}`,
    html: `
      <p>Hi ${brokerName},</p>
      <p>A new offer is ready for your review for <strong>${merchantName}</strong> (${usd(amount)}).</p>
      <p>Use the secure link below to review and select an offer:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 7 days.</p>
    `,
  })
}

export async function sendMerchantInviteEmail({
  dealId,
  merchantName,
  merchantEmail,
  amount,
}: {
  dealId: string
  merchantName: string
  merchantEmail: string
  amount: number
}) {
  const token = makeToken({ dealId, type: 'merchant' })
  const link = `${appUrl()}/merchant?token=${token}`

  return resend.emails.send({
    from: FROM,
    to: merchantEmail,
    subject: 'Complete Your Funding Application',
    html: `
      <p>Hi ${merchantName},</p>
      <p>You've been invited to complete your funding application for <strong>${usd(amount)}</strong>.</p>
      <p>Use the secure link below to get started:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 7 days.</p>
    `,
  })
}
