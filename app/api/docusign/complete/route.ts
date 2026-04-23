import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { toDb } from '@/lib/dealStatus'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { dealId, envelopeId } = await request.json()
  if (!dealId || !envelopeId) {
    return Response.json({ error: 'dealId and envelopeId are required' }, { status: 400 })
  }

  const existing = await prisma.agreementRecord.findFirst({
    where: { dealId, signatureRequestId: envelopeId },
  })

  if (!existing) {
    await Promise.all([
      prisma.agreementRecord.create({
        data: {
          dealId,
          provider: 'docusign',
          signatureRequestId: envelopeId,
          status: 'SIGNED',
          signedAt: new Date(),
        },
      }),
      prisma.deal.update({
        where: { id: dealId },
        data: { status: toDb('Agreement Signed') },
      }),
    ])
  }

  return Response.json({ success: true })
}
