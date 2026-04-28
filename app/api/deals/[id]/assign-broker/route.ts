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
  const { shopId, contactId } = await request.json()

  if (!shopId || !contactId) {
    return NextResponse.json({ error: 'shopId and contactId are required' }, { status: 400 })
  }

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      brokerShopId: shopId,
      brokerContactId: contactId,
    },
    include: {
      brokerContact: true,
      merchantContact: true,
      brokerShop: true,
      offers: true,
    },
  })

  return NextResponse.json(deal)
}
