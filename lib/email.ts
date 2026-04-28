import { Resend } from 'resend'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM ?? 'YoyoFunding <noreply@yoyofunding.fund>'

const testEmail = process.env.RESEND_TEST_EMAIL
const isTest = process.env.NODE_ENV !== 'production' && !!testEmail

function resolveRecipient(actual: string): string {
  return isTest ? testEmail! : actual
}

function testBanner(actual: string): string {
  if (!isTest) return ''
  return `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#92400e;font-family:sans-serif;"><strong>TEST MODE</strong> — intended recipient: <strong>${actual}</strong></div>`
}

function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function makeToken(payload: object) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' })
}

function usd(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function logoHtml() {
  return `<div style="text-align:center;padding:28px 0 20px;"><span style="font-family:'Arial Black',Arial,sans-serif;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;">YOYO</span><span style="font-family:'Arial Black',Arial,sans-serif;font-size:26px;font-weight:900;color:#d4af37;letter-spacing:-0.02em;">FUNDING</span></div>`
}

type OfferRow = {
  id: string
  amount: number
  factorRate: number
  termDays: number
  paymentFrequency: string
  position: string
  originationFee: number
  commissionPct: number
  expiresAt: Date | null
}

function termLabel(freq: string): string {
  return freq === 'Daily' ? 'days' : freq === 'Weekly' ? 'weeks' : 'months'
}

function achPayments(offer: OfferRow): { count: number; perPayment: number } {
  const payback = offer.amount * offer.factorRate
  return { count: offer.termDays, perPayment: payback / offer.termDays }
}

function offerCardHtml(offer: OfferRow, index: number, selectUrl: string): string {
  const payback = offer.amount * offer.factorRate
  const commission = offer.amount * (offer.commissionPct / 100)
  const { count: achCount, perPayment: achAmt } = achPayments(offer)
  const freqLabel = offer.paymentFrequency === 'Daily' ? 'day' : offer.paymentFrequency === 'Weekly' ? 'week' : 'month'
  const feeAmt = offer.amount * (offer.originationFee / 100)

  const cells = [
    ['Total Payback', usd(payback)],
    ['Factor Rate', `${offer.factorRate}x`],
    ['Term', `${offer.termDays} ${termLabel(offer.paymentFrequency)}`],
    ['Position', offer.position],
    ['Orig. Fee', `${offer.originationFee}% · ${usd(feeAmt)}`],
    ['Frequency', offer.paymentFrequency],
  ]

  return `
  <div style="background:#1c1c1c;border:1px solid #2a2a2a;border-radius:16px;padding:28px;margin-bottom:20px;">
    <div style="font-size:11px;font-weight:700;color:#d4af37;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Option ${index + 1}</div>
    <div style="font-size:13px;color:#888888;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px;">Advance Amount</div>
    <div style="font-size:38px;font-weight:900;color:#ffffff;line-height:1;margin-bottom:20px;">${usd(offer.amount)}</div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:1px;background:#2a2a2a;border-radius:10px;overflow:hidden;margin-bottom:16px;">
      <tr>
        ${cells.slice(0, 3).map(([label, val]) => `
          <td style="background:#1c1c1c;padding:11px 12px;width:33.3%;">
            <div style="font-size:10px;font-weight:700;color:#666666;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">${label}</div>
            <div style="font-size:13px;font-weight:700;color:#ffffff;">${val}</div>
          </td>`).join('')}
      </tr>
      <tr>
        ${cells.slice(3).map(([label, val]) => `
          <td style="background:#1c1c1c;padding:11px 12px;width:33.3%;">
            <div style="font-size:10px;font-weight:700;color:#666666;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px;">${label}</div>
            <div style="font-size:13px;font-weight:700;color:#ffffff;">${val}</div>
          </td>`).join('')}
      </tr>
    </table>

    <div style="background:#111111;border:1px solid #2a2a2a;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-family:sans-serif;">
      <span style="font-size:12px;font-weight:600;color:#888888;">ACH Remittance: </span>
      <span style="font-size:13px;font-weight:700;color:#ffffff;">${usd(achAmt)} / ${freqLabel}</span>
      <span style="font-size:12px;color:#555555;margin-left:6px;">· ${achCount} payments</span>
    </div>

    <div style="background:#111111;border:1px solid #2a2a2a;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:11px;font-weight:700;color:#d4af37;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px;">Your Commission</div>
        <div style="font-size:26px;font-weight:900;color:#d4af37;">${usd(commission)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px;font-weight:600;color:#888888;">${offer.commissionPct}% of advance</div>
      </div>
    </div>

    <a href="${selectUrl}" style="display:block;background:#d4af37;color:#111111;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-size:15px;font-weight:800;letter-spacing:0.02em;">
      Select This Offer →
    </a>
  </div>`
}

export async function sendBrokerOfferEmail({
  dealId,
  brokerName,
  brokerEmail,
  merchantName,
  offers,
  brokerShopId,
}: {
  dealId: string
  brokerName: string
  brokerEmail: string
  merchantName: string
  offers: OfferRow[]
  brokerShopId?: string | null
}) {
  const token = makeToken({ dealId, type: 'broker' })
  const portalLink = `${appUrl()}/broker?token=${token}`

  const offerCardsHtml = offers.map((offer, i) => {
    const selectUrl = `${appUrl()}/api/broker/email-select?token=${token}&offerId=${offer.id}`
    return offerCardHtml(offer, i, selectUrl)
  }).join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#111111;">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px 48px;">
    ${testBanner(brokerEmail)}
    ${logoHtml()}

    <div style="background:#1c1c1c;border:1px solid #2a2a2a;border-radius:20px;overflow:hidden;margin-bottom:24px;">
      <div style="background:#d4af37;padding:6px 20px;text-align:center;">
        <span style="font-size:11px;font-weight:800;color:#111111;text-transform:uppercase;letter-spacing:0.12em;">New Offer Ready</span>
      </div>
      <div style="padding:32px 28px 20px;">
        <div style="font-size:13px;color:#888888;margin-bottom:6px;font-family:sans-serif;">Hi ${brokerName},</div>
        <div style="font-size:22px;font-weight:800;color:#ffffff;margin-bottom:8px;font-family:sans-serif;">New offer available for ${merchantName}</div>
        <div style="font-size:14px;color:#888888;line-height:1.6;font-family:sans-serif;">
          Review and select an offer directly from this email, or use the secure portal for full details.
        </div>
      </div>
    </div>

    ${offerCardsHtml}

    <div style="text-align:center;margin:28px 0;">
      <a href="${portalLink}" style="display:inline-block;background:transparent;color:#d4af37;border:1.5px solid #d4af37;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:13px;font-weight:700;letter-spacing:0.04em;font-family:sans-serif;">
        Open Full Portal →
      </a>
    </div>

    <div style="text-align:center;font-size:12px;color:#333333;font-family:sans-serif;margin-top:32px;">
      Powered by YoyoFunding &middot; This link expires in 7 days
    </div>
  </div>
</body>
</html>`

  const to = resolveRecipient(brokerEmail)
  const ccList: string[] = []

  if (brokerShopId) {
    const shopContacts = await prisma.brokerContact.findMany({
      where: { shopId: brokerShopId, email: { not: brokerEmail } },
      select: { email: true },
    })
    ccList.push(...shopContacts.map(c => resolveRecipient(c.email)))
  }

  console.log(`[email] sendBrokerOfferEmail → to=${to} cc=${ccList.join(',')} deal=${dealId}`)

  const result = await resend.emails.send({
    from: FROM,
    to,
    ...(ccList.length > 0 ? { cc: ccList } : {}),
    subject: `New Offer Ready — ${merchantName} (${offers.length} option${offers.length !== 1 ? 's' : ''})`,
    html,
  })

  console.log(`[email] sendBrokerOfferEmail result:`, JSON.stringify(result))
  return result
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

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#111111;">
  <div style="max-width:580px;margin:0 auto;padding:24px 16px 48px;">
    ${testBanner(merchantEmail)}
    ${logoHtml()}

    <div style="background:#1c1c1c;border:1px solid #2a2a2a;border-radius:20px;overflow:hidden;margin-bottom:24px;">
      <div style="background:#d4af37;padding:6px 20px;text-align:center;">
        <span style="font-size:11px;font-weight:800;color:#111111;text-transform:uppercase;letter-spacing:0.12em;">Action Required</span>
      </div>
      <div style="padding:36px 32px;">
        <div style="font-size:22px;font-weight:800;color:#ffffff;margin-bottom:8px;font-family:sans-serif;">
          Complete your funding application
        </div>
        <div style="font-size:14px;color:#888888;line-height:1.6;margin-bottom:28px;font-family:sans-serif;">
          Hi ${merchantName}, your funding offer has been selected. Complete your application to receive your advance.
        </div>

        <div style="background:#111111;border:1px solid #d4af37;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
          <div style="font-size:11px;font-weight:700;color:#d4af37;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Approved Advance Amount</div>
          <div style="font-size:40px;font-weight:900;color:#ffffff;line-height:1;">${usd(amount)}</div>
        </div>

        <a href="${link}" style="display:block;background:#d4af37;color:#111111;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-size:16px;font-weight:800;letter-spacing:0.02em;font-family:sans-serif;margin-bottom:28px;">
          Complete My Application →
        </a>

        <div style="border-top:1px solid #2a2a2a;padding-top:24px;">
          <div style="font-size:12px;font-weight:700;color:#666666;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;font-family:sans-serif;">What you'll need to complete</div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${[
              ['Connect your bank account', 'Securely link via Plaid — read-only access, no credentials stored'],
              ['Verify your identity', 'Quick ID check powered by Persona — takes under 2 minutes'],
              ['Sign your agreement', 'Review and e-sign your funding agreement via DocuSign'],
            ].map(([title, desc], i) => `
              <div style="display:flex;gap:12px;align-items:flex-start;">
                <div style="width:22px;height:22px;border-radius:50%;background:#d4af37;color:#111111;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;flex-shrink:0;font-family:sans-serif;">${i + 1}</div>
                <div>
                  <div style="font-size:13px;font-weight:700;color:#ffffff;font-family:sans-serif;">${title}</div>
                  <div style="font-size:12px;color:#666666;margin-top:2px;font-family:sans-serif;">${desc}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div style="text-align:center;font-size:12px;color:#333333;font-family:sans-serif;">
      Powered by YoyoFunding &middot; This link expires in 7 days
    </div>
  </div>
</body>
</html>`

  return resend.emails.send({
    from: FROM,
    to: resolveRecipient(merchantEmail),
    subject: `Complete Your Funding Application — ${usd(amount)} Ready`,
    html,
  })
}

export async function sendDeclineEmail({
  dealId,
  brokerName,
  brokerEmail,
  merchantName,
  reason,
  notes,
}: {
  dealId: string
  brokerName: string
  brokerEmail: string
  merchantName: string
  reason: string
  notes?: string
}) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#111111;">
  <div style="max-width:580px;margin:0 auto;padding:24px 16px 48px;">
    ${testBanner(brokerEmail)}
    ${logoHtml()}

    <div style="background:#1c1c1c;border:1px solid #2a2a2a;border-radius:20px;overflow:hidden;margin-bottom:24px;">
      <div style="background:#dc2626;padding:6px 20px;text-align:center;">
        <span style="font-size:11px;font-weight:800;color:#ffffff;text-transform:uppercase;letter-spacing:0.12em;">Application Update</span>
      </div>
      <div style="padding:36px 32px;">
        <div style="font-size:13px;color:#888888;margin-bottom:6px;font-family:sans-serif;">Hi ${brokerName},</div>
        <div style="font-size:22px;font-weight:800;color:#ffffff;margin-bottom:12px;font-family:sans-serif;">
          ${merchantName} — Application Declined
        </div>
        <div style="font-size:14px;color:#888888;line-height:1.6;margin-bottom:24px;font-family:sans-serif;">
          After careful review, we are unable to approve funding for this application at this time.
        </div>

        <div style="background:#111111;border:1px solid #2a2a2a;border-radius:12px;padding:20px 24px;${notes ? 'margin-bottom:16px;' : ''}">
          <div style="font-size:11px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Decline Reason</div>
          <div style="font-size:15px;font-weight:700;color:#ffffff;">${reason}</div>
        </div>

        ${notes ? `
        <div style="background:#111111;border:1px solid #2a2a2a;border-radius:12px;padding:20px 24px;">
          <div style="font-size:11px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Additional Notes</div>
          <div style="font-size:14px;color:#cccccc;line-height:1.6;">${notes}</div>
        </div>` : ''}
      </div>
    </div>

    <div style="text-align:center;font-size:12px;color:#333333;font-family:sans-serif;">
      Powered by YoyoFunding &middot; Deal ID: ${dealId}
    </div>
  </div>
</body>
</html>`

  const to = resolveRecipient(brokerEmail)
  console.log(`[email] sendDeclineEmail → to=${to} deal=${dealId}`)

  const result = await resend.emails.send({
    from: FROM,
    to,
    subject: `Application Update — ${merchantName}`,
    html,
  })

  console.log(`[email] sendDeclineEmail result:`, JSON.stringify(result))
  return result
}
