import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { sendSubmissionAckReply } from '@/lib/email'

const client = new Anthropic()
const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM ?? 'YoyoFunding <noreply@yoyofunding.fund>'
const INTERNAL_EMAIL = 'noreply@yoyofunding.fund'

const CLASSIFY_SYSTEM = `You are a document classifier for a merchant cash advance company. Return ONLY valid JSON — no markdown, no code fences.`

const CLASSIFY_PROMPT = `Classify this document. Return a JSON object with exactly one key:
- type: "application" | "bank_statement" | "tax_document" | "other"

An "application" contains fields like business name, EIN, owner name, requested funding amount, owner signature.
A "bank_statement" shows transaction history, deposits, withdrawals, account balances.
Return only the JSON object.`

const EXTRACT_SYSTEM = `You are a data extraction assistant for a merchant cash advance company.
Extract structured data from MCA application documents.
Return ONLY valid JSON — no markdown, no explanation, no code fences.`

const EXTRACT_PROMPT = `Extract the following fields from this MCA application. Return a JSON object with these exact keys:
- businessName: string (business/DBA name)
- ownerName: string (owner/principal name)
- email: string (primary business email, null if not found)
- phone: string (primary phone, null if not found)
- address: string (business address single line, null if not found)
- requestedAmount: number (funding amount requested, numeric only, 0 if not found)
- timeInBusiness: string (how long the business has operated e.g. "3 years", null if not found)
- monthlyRevenue: number (average monthly revenue/deposits numeric only, 0 if not found)
- ein: string (Business EIN in format XX-XXXXXXX, null if not found)
- ownerDob: string (Owner date of birth in format MM/DD/YYYY, null if not found)
- ownerSsnLast4: string (LAST 4 DIGITS ONLY of owner SSN — never extract or return the full SSN, null if not found)

IMPORTANT: For ownerSsnLast4, extract only the last 4 digits. Never return a full 9-digit SSN.
If a field is not found, use null for strings and 0 for numbers.
Return only the JSON object.`

type PostmarkAddress = { Email: string; Name?: string; MailboxHash?: string }

type PostmarkPayload = {
  MessageID?: string
  Headers?: Array<{ Name: string; Value: string }>
  From?: string
  FromName?: string
  FromFull?: PostmarkAddress
  ToFull?: PostmarkAddress[]
  CcFull?: PostmarkAddress[]
  BccFull?: PostmarkAddress[]
  Subject?: string
  TextBody?: string
  HtmlBody?: string
  ReplyTo?: string
  Attachments?: Array<{
    Name: string
    Content: string
    ContentType: string
    ContentLength: number
  }>
}

function cleanJson(raw: string): unknown {
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  return JSON.parse(clean)
}

export async function POST(request: NextRequest) {
  let body: PostmarkPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const fromEmail = body.FromFull?.Email ?? body.From ?? ''
  const fromName = body.FromName ?? body.FromFull?.Name ?? ''
  const subject = body.Subject ?? ''
  // Use the original email's Message-ID header for threading — body.MessageID is
  // Postmark's internal UUID and won't match the sender's thread.
  const originalMsgIdHeader = (body.Headers ?? []).find(
    h => h.Name.toLowerCase() === 'message-id'
  )?.Value ?? ''
  const messageId = originalMsgIdHeader || body.MessageID || ''
  console.log(`[inbound/email] raw MessageID=${body.MessageID} header Message-ID=${originalMsgIdHeader} stored=${messageId}`)
  const toEmails = (body.ToFull ?? []).map(a => a.Email).filter(Boolean)
  const ccEmails = (body.CcFull ?? []).map(a => a.Email).filter(Boolean)
  const rawAttachments = body.Attachments ?? []

  const pdfAttachments = rawAttachments.filter(
    a => a.ContentType === 'application/pdf' || a.Name.toLowerCase().endsWith('.pdf')
  )

  let dealId: string | undefined
  let merchantName = 'Unknown Merchant'

  for (const pdf of pdfAttachments.slice(0, 5)) {
    // Step 1: classify
    let docType = 'other'
    try {
      const classifyMsg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 64,
        system: CLASSIFY_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdf.Content },
            },
            { type: 'text', text: CLASSIFY_PROMPT },
          ],
        }],
      })
      const raw = classifyMsg.content.find(b => b.type === 'text')?.text ?? '{}'
      const parsed = cleanJson(raw) as { type?: string }
      docType = parsed.type ?? 'other'
    } catch (err) {
      console.error('[inbound/email] classify error', err)
      continue
    }

    if (docType !== 'application') continue

    // Step 2: extract fields
    let extracted: Record<string, unknown> = {}
    try {
      const extractMsg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: EXTRACT_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdf.Content },
            },
            { type: 'text', text: EXTRACT_PROMPT },
          ],
        }],
      })
      const raw = extractMsg.content.find(b => b.type === 'text')?.text ?? '{}'
      extracted = cleanJson(raw) as Record<string, unknown>
    } catch (err) {
      console.error('[inbound/email] extract error', err)
      continue
    }

    merchantName = (extracted.businessName as string) || 'Unknown Merchant'
    const merchantEmail =
      (extracted.email as string) || `inbound-${Date.now()}@placeholder.internal`

    const merchantContact = await prisma.merchantContact.upsert({
      where: { email: merchantEmail },
      update: {
        businessName: merchantName,
        ownerName: (extracted.ownerName as string) || merchantName,
        phone: (extracted.phone as string) || null,
        ein: (extracted.ein as string) || null,
        ownerDob: (extracted.ownerDob as string) || null,
        ownerSsnLast4: (extracted.ownerSsnLast4 as string) || null,
      },
      create: {
        businessName: merchantName,
        ownerName: (extracted.ownerName as string) || merchantName,
        email: merchantEmail,
        phone: (extracted.phone as string) || null,
        ein: (extracted.ein as string) || null,
        ownerDob: (extracted.ownerDob as string) || null,
        ownerSsnLast4: (extracted.ownerSsnLast4 as string) || null,
      },
    })

    const brokerContact = fromEmail
      ? await prisma.brokerContact.upsert({
          where: { email: fromEmail },
          update: { name: fromName || fromEmail },
          create: { name: fromName || fromEmail, email: fromEmail },
        })
      : null

    const requestedAmount =
      typeof extracted.requestedAmount === 'number' ? extracted.requestedAmount : 0

    const deal = await prisma.deal.create({
      data: {
        status: 'Submission Received',
        requestedAmount,
        merchantContactId: merchantContact.id,
        ...(brokerContact ? { brokerContactId: brokerContact.id } : {}),
      },
    })

    dealId = deal.id

    sendSubmissionAckReply({
      dealId: deal.id,
      brokerName: fromName || fromEmail,
      brokerEmail: fromEmail,
      merchantName,
      originalMessageId: messageId,
      originalSubject: subject,
      ccEmails,
    }).catch(err => console.error('[inbound/email] ack reply error', err))

    break
  }

  // Store EmailSubmission (attachment metadata only, no base64 content)
  await prisma.emailSubmission.create({
    data: {
      messageId,
      fromEmail,
      fromName,
      toEmails,
      ccEmails,
      subject,
      attachments: rawAttachments.map(a => ({
        name: a.Name,
        contentType: a.ContentType,
        contentLength: a.ContentLength,
      })),
      ...(dealId ? { dealId } : {}),
    },
  })

  // Internal notification (fire-and-forget)
  const brokerLabel = fromName || fromEmail || 'Unknown Broker'
  resend.emails.send({
    from: FROM,
    to: INTERNAL_EMAIL,
    subject: `New submission received from ${brokerLabel} for ${merchantName}`,
    html: `<div style="font-family:sans-serif;max-width:480px;">
<h2 style="color:#111;">New Inbound Submission</h2>
<table style="border-collapse:collapse;width:100%;">
  <tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px;">From</td><td style="font-size:13px;">${brokerLabel} &lt;${fromEmail}&gt;</td></tr>
  <tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px;">Subject</td><td style="font-size:13px;">${subject}</td></tr>
  <tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px;">Merchant</td><td style="font-size:13px;">${merchantName}</td></tr>
  <tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px;">Deal ID</td><td style="font-size:13px;">${dealId ?? 'No application found in attachments'}</td></tr>
  <tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px;">Attachments</td><td style="font-size:13px;">${rawAttachments.length} total · ${pdfAttachments.length} PDF</td></tr>
</table>
</div>`,
  }).catch(err => console.error('[inbound/email] notification error', err))

  console.log(`[inbound/email] messageId=${messageId} from=${fromEmail} dealId=${dealId ?? 'none'}`)

  return NextResponse.json({ ok: true, dealId: dealId ?? null })
}
