import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDeclineEmail } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { reason, notes } = await request.json()

  if (!reason) return NextResponse.json({ error: 'reason is required' }, { status: 400 })

  const deal = await prisma.deal.update({
    where: { id },
    data: { status: 'Declined' },
    include: { brokerContact: true, merchantContact: true },
  })

  if (deal.brokerContact) {
    sendDeclineEmail({
      dealId: deal.id,
      brokerName: deal.brokerContact.name,
      brokerEmail: deal.brokerContact.email,
      merchantName: deal.merchantContact?.businessName ?? 'Merchant',
      reason,
      notes: notes || undefined,
    }).catch(console.error)
  }

  return NextResponse.json(deal)
}
