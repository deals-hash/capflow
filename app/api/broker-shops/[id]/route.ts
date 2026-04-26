import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const shop = await prisma.brokerShop.findUnique({
    where: { id },
    include: { contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] }, deals: { orderBy: { createdAt: 'desc' }, take: 20 } },
  })
  if (!shop) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ shop })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, phone, email, address, notes } = await request.json()

  const shop = await prisma.brokerShop.update({
    where: { id },
    data: { name, phone, email, address, notes },
    include: { contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] } },
  })
  return Response.json({ shop })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.brokerShop.delete({ where: { id } })
  return Response.json({ success: true })
}
