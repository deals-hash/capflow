import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const brokers = await prisma.brokerContact.findMany({
    orderBy: { name: 'asc' },
  })

  return Response.json(brokers)
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { dealId, brokerContactId } = body

  if (!dealId || !brokerContactId) {
    return Response.json(
      { error: 'dealId and brokerContactId are required' },
      { status: 400 }
    )
  }

  const deal = await prisma.deal.update({
    where: { id: dealId },
    data: { brokerContactId },
    include: { brokerContact: true },
  })

  return Response.json(deal)
}
