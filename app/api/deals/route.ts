import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'
import type { NextRequest } from 'next/server'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status')

  const deals = await prisma.deal.findMany({
    where: status ? { status: status as any } : undefined,
    include: {
      brokerContact: true,
      merchantContact: true,
      offers: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json(deals)
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { requestedAmount, brokerContactId, merchantContactId } = body

  if (!requestedAmount) {
    return Response.json({ error: 'requestedAmount is required' }, { status: 400 })
  }

  const deal = await prisma.deal.create({
    data: {
      requestedAmount,
      brokerContactId,
      merchantContactId,
    },
    include: {
      brokerContact: true,
      merchantContact: true,
    },
  })

  return Response.json(deal, { status: 201 })
}
