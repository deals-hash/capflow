import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM = `You are a data extraction assistant for a merchant cash advance company.
Extract structured data from uploaded business documents (bank statements, applications, tax docs, etc.).
Return ONLY valid JSON — no markdown, no explanation, no code fences.`

const PROMPT = `Extract the following fields from this document. Return a JSON object with these exact keys:
- businessName: string (business/DBA name)
- ownerName: string (owner/principal name)
- email: string (primary email)
- phone: string (primary phone)
- address: string (business address, single line)
- requestedAmount: number (funding amount requested, numeric only, 0 if not found)
- industry: string (type of business / industry)
- notes: string (any relevant details: monthly revenue, years in business, MCA history, etc.)
- ein: string (Business EIN in format XX-XXXXXXX, null if not found)
- ownerEin: string (Owner/individual EIN if different from business EIN, null if not found)
- ownerDob: string (Owner date of birth in format MM/DD/YYYY, null if not found)
- ownerSsnLast4: string (LAST 4 DIGITS ONLY of owner SSN — never extract or return the full SSN, null if not found)

IMPORTANT: For ownerSsnLast4, extract only the last 4 digits. Never return a full 9-digit SSN.
If a field is not found, use null for strings and 0 for numbers.
Return only the JSON object.`

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const files = formData.getAll('files') as File[]
  if (!files.length) return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })

  const documentBlocks: Anthropic.DocumentBlockParam[] = []

  for (const file of files.slice(0, 5)) {
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mediaType = (file.type || 'application/pdf') as 'application/pdf'

    documentBlocks.push({
      type: 'document',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            ...documentBlocks,
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    const raw = message.content.find(b => b.type === 'text')?.text ?? ''

    let extracted: Record<string, unknown>
    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      extracted = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 422 })
    }

    return NextResponse.json({ extracted })
  } catch (err) {
    console.error('[submissions/process]', err)
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 })
  }
}
