import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'
import type { NextRequest } from 'next/server'

const prisma = new PrismaClient()

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      brokerContact: true,
      merchantContact: true,
      offers: { include: { snapshots: true } },
      bankConnections: true,
      identityRecords: true,
      agreements: true,
      notifications: true,
      underwritingDecisions: true,
    },
  })

  if (!deal) {
    return Response.json({ error: 'Deal not found' }, { status: 404 })
  }

  return Response.json(deal)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const deal = await prisma.deal.update({
    where: { id },
    data: body,
    include: {
      brokerContact: true,
      merchantContact: true,
      offers: true,
    },
  })

  return Response.json(deal)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  await prisma.deal.delete({ where: { id } })

  return new Response(null, { status: 204 })
}
