import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { offers } = await request.json()

  if (!offers?.length) return NextResponse.json({ error: 'offers required' }, { status: 400 })

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      status: 'Offer Created',
      offers: {
        create: offers.map((o: Record<string, string>) => ({
          amount: parseFloat(o.amount) || 0,
          factorRate: parseFloat(o.factor) || 1,
          termDays: parseInt(o.term) || 1,
          paymentFrequency: o.frequency || 'Daily',
          position: o.position || '1st',
          originationFee: parseFloat(o.fee) || 1,
          commissionPct: parseFloat(o.commissionPct) || 10,
          expiresAt: o.expiry ? new Date(o.expiry) : null,
        })),
      },
    },
    include: { brokerContact: true, merchantContact: true, offers: true },
  })

  return NextResponse.json(deal)
}
