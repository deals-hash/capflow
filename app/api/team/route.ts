import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const members = await prisma.userRole.findMany({ orderBy: { createdAt: 'asc' } })
  return Response.json(members)
}
