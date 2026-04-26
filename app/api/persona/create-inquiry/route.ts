import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { createInquiry } from '@/lib/persona'
import { isMerchantTokenValid } from '@/lib/merchant-auth'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  const { dealId, merchantToken } = await request.json()

  if (!dealId) return Response.json({ error: 'dealId is required' }, { status: 400 })

  const authorized = !!userId || isMerchantTokenValid(merchantToken, dealId)
  if (!authorized) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { inquiryId } = await createInquiry(dealId)

  return Response.json({ inquiryId })
}
