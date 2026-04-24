import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

const PERSONA_API = 'https://withpersona.com/api/v1'
const PERSONA_VERSION = '2023-01-05'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const dealId = request.nextUrl.searchParams.get('dealId')
  if (!dealId) return Response.json({ error: 'dealId is required' }, { status: 400 })

  const idvRecord = await prisma.identityVerificationRecord.findFirst({ where: { dealId } })
  if (!idvRecord?.inquiryId) {
    return Response.json({ error: 'No identity verification found' }, { status: 404 })
  }

  const res = await fetch(`${PERSONA_API}/inquiries/${idvRecord.inquiryId}`, {
    headers: {
      Authorization: `Bearer ${process.env.PERSONA_API_KEY}`,
      'Content-Type': 'application/json',
      'Persona-Version': PERSONA_VERSION,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    return Response.json({ error: `Persona API error: ${text}` }, { status: res.status })
  }

  const json = await res.json()
  const attrs = json.data?.attributes ?? {}

  return Response.json({
    inquiryId: idvRecord.inquiryId,
    status: attrs.status,
    completedAt: idvRecord.completedAt,
    nameFirst: attrs['name-first'],
    nameLast: attrs['name-last'],
    birthdate: attrs.birthdate,
    documentType: attrs['selected-document-type'],
    country: attrs['selected-country-code'],
  })
}
