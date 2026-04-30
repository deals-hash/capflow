import { auth } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_ROLES = ['Admin', 'Underwriter', 'BackOffice', 'ViewOnly']

async function requireAdmin(userId: string) {
  const me = await prisma.userRole.findUnique({ where: { clerkUserId: userId } })
  return me?.role === 'Admin' ? me : null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await requireAdmin(userId))) {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { id } = await params
  const { role } = await request.json()

  if (!VALID_ROLES.includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }

  const record = await prisma.userRole.update({ where: { id }, data: { role } })
  return Response.json(record)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await requireAdmin(userId))) {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { id } = await params
  await prisma.userRole.delete({ where: { id } })
  return new Response(null, { status: 204 })
}
