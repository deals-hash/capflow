import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { createInquiry } from '@/lib/persona'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { dealId } = await request.json()
  if (!dealId) {
    return Response.json({ error: 'dealId is required' }, { status: 400 })
  }

  const { inquiryId } = await createInquiry(dealId)

  return Response.json({ inquiryId })
}
