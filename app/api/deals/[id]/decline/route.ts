import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDeclineEmail, sendDeclineThreadReply } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { reason, notes, brokerEmail: overrideEmail } = await request.json()

  if (!reason) return NextResponse.json({ error: 'reason is required' }, { status: 400 })

  const [deal, emailSub] = await Promise.all([
    prisma.deal.update({
      where: { id },
      data: { status: 'Declined' },
      include: { brokerContact: true, merchantContact: true },
    }),
    prisma.emailSubmission.findFirst({
      where: { dealId: id },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const merchantName = deal.merchantContact?.businessName ?? 'Merchant'

  const apiKeyPreview = process.env.RESEND_API_KEY
    ? process.env.RESEND_API_KEY.slice(0, 12) + '…'
    : 'NOT SET'

  try {
    if (emailSub?.messageId) {
      const brokerEmail = emailSub.fromEmail
      const brokerName = emailSub.fromName || brokerEmail
      console.log(`[decline] path=thread-reply to=${brokerEmail} deal=${deal.id} resend_key=${apiKeyPreview}`)
      const result = await sendDeclineThreadReply({
        dealId: deal.id,
        brokerName,
        brokerEmail,
        merchantName,
        reason,
        notes: notes || undefined,
        originalMessageId: emailSub.messageId,
        originalSubject: emailSub.subject ?? 'Your Submission',
        ccEmails: emailSub.ccEmails,
      })
      console.log(`[decline] thread-reply result:`, JSON.stringify(result))
    } else if (deal.brokerContact) {
      const brokerEmail = deal.brokerContact.email
      console.log(`[decline] path=sendDeclineEmail to=${brokerEmail} deal=${deal.id} resend_key=${apiKeyPreview}`)
      const result = await sendDeclineEmail({
        dealId: deal.id,
        brokerName: deal.brokerContact.name,
        brokerEmail,
        merchantName,
        reason,
        notes: notes || undefined,
      })
      console.log(`[decline] sendDeclineEmail result:`, JSON.stringify(result))
    } else if (overrideEmail) {
      console.log(`[decline] path=sendDeclineEmail(override) to=${overrideEmail} deal=${deal.id} resend_key=${apiKeyPreview}`)
      const result = await sendDeclineEmail({
        dealId: deal.id,
        brokerName: 'Broker',
        brokerEmail: overrideEmail,
        merchantName,
        reason,
        notes: notes || undefined,
      })
      console.log(`[decline] sendDeclineEmail(override) result:`, JSON.stringify(result))
    } else {
      console.log(`[decline] path=no-email deal=${deal.id} — no broker contact, no emailSub, no overrideEmail`)
    }
  } catch (err) {
    console.error(`[decline] email send failed deal=${deal.id}`, err)
  }

  return NextResponse.json(deal)
}
