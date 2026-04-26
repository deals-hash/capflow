import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const shops = await prisma.brokerShop.findMany({
    include: { contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] } },
    orderBy: { name: 'asc' },
  })
  return Response.json({ shops })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, phone, email, address, notes } = body

  if (!name) return Response.json({ error: 'name is required' }, { status: 400 })

  const shop = await prisma.brokerShop.create({
    data: { name, phone, email, address, notes },
    include: { contacts: true },
  })
  return Response.json({ shop }, { status: 201 })
}
