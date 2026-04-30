import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const me = await prisma.userRole.findUnique({ where: { clerkUserId: userId } })
  if (!me || me.role !== 'Admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { email, name, role } = await request.json()
  if (!email) return Response.json({ error: 'email is required' }, { status: 400 })

  const validRoles = ['Admin', 'Underwriter', 'BackOffice', 'ViewOnly']
  const safeRole = validRoles.includes(role) ? role : 'ViewOnly'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const client = await clerkClient()
    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${appUrl}/sign-up`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send invitation'
    return Response.json({ error: msg }, { status: 400 })
  }

  const record = await prisma.userRole.upsert({
    where: { email },
    update: { name: name || email, role: safeRole },
    create: { email, name: name || email, role: safeRole },
  })

  return Response.json(record, { status: 201 })
}
