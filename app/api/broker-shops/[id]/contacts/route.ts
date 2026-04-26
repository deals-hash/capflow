import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: shopId } = await params
  const { name, email, phone, role, isPrimary } = await request.json()

  if (!name || !email) return Response.json({ error: 'name and email are required' }, { status: 400 })

  if (isPrimary) {
    await prisma.brokerContact.updateMany({ where: { shopId }, data: { isPrimary: false } })
  }

  const contact = await prisma.brokerContact.upsert({
    where: { email },
    update: { name, phone, role, isPrimary: isPrimary ?? false, shopId },
    create: { name, email, phone, role, isPrimary: isPrimary ?? false, shopId },
  })
  return Response.json({ contact }, { status: 201 })
}
