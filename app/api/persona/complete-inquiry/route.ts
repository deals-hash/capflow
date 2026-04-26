import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isMerchantTokenValid } from '@/lib/merchant-auth'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  const { dealId, inquiryId, status, fields, merchantToken } = await request.json()

  if (!dealId || !inquiryId) {
    return Response.json({ error: 'dealId and inquiryId are required' }, { status: 400 })
  }

  const authorized = !!userId || isMerchantTokenValid(merchantToken, dealId)
  if (!authorized) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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
      data: { status: 'Identity Verified' },
    }),
  ])

  return Response.json({ success: true })
}
