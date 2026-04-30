import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses.find(
    e => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress ?? ''
  const name = clerkUser?.fullName ?? clerkUser?.firstName ?? 'User'

  // Look up by clerkUserId first
  let record = await prisma.userRole.findUnique({ where: { clerkUserId: userId } })

  if (!record && email) {
    // Invited user whose clerkUserId wasn't linked yet — find by email and link
    const byEmail = await prisma.userRole.findUnique({ where: { email } })
    if (byEmail) {
      record = await prisma.userRole.update({
        where: { id: byEmail.id },
        data: { clerkUserId: userId, name: byEmail.name || name },
      })
    }
  }

  if (!record) {
    // First user / account owner — create Admin record
    record = await prisma.userRole.create({
      data: { clerkUserId: userId, email, name, role: 'Admin' },
    })
  }

  return Response.json(record)
}
