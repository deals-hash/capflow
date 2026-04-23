import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { toDb } from '@/lib/dealStatus'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { dealId, inquiryId, status, fields } = await request.json()
  if (!dealId || !inquiryId) {
    return Response.json({ error: 'dealId and inquiryId are required' }, { status: 400 })
  }

  await Promise.all([
    prisma.identityVerificationRecord.create({
      data: {
        dealId,
        inquiryId,
        provider: 'persona',
        status: status ?? 'COMPLETED',
        completedAt: new Date(),
        rawData: fields ? JSON.parse(JSON.stringify(fields)) : undefined,
      },
    }),
    prisma.deal.update({
      where: { id: dealId },
      data: { status: toDb('Identity Verified') },
    }),
  ])

  return Response.json({ success: true })
}
