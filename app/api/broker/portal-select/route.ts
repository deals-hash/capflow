import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { sendMerchantInviteEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const { token, offerId } = await request.json()

  if (!token || !offerId) {
    return Response.json({ error: 'token and offerId are required' }, { status: 400 })
  }

  let payload: { dealId: string; type: string }
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as { dealId: string; type: string }
  } catch {
    return Response.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  if (payload.type !== 'broker') {
    return Response.json({ error: 'Invalid token type' }, { status: 401 })
  }

  const offer = await prisma.offer.findFirst({
    where: { id: offerId, dealId: payload.dealId },
  })

  if (!offer) {
    return Response.json({ error: 'Offer not found' }, { status: 404 })
  }

  const deal = await prisma.deal.findUnique({
    where: { id: payload.dealId },
    include: { merchantContact: true },
  })

  if (!deal) {
    return Response.json({ error: 'Deal not found' }, { status: 404 })
  }

  await Promise.all([
    prisma.offer.update({
      where: { id: offerId },
      data: { status: 'ACCEPTED' },
    }),
    prisma.deal.update({
      where: { id: payload.dealId },
      data: { status: 'Offer Selected' },
    }),
  ])

  if (deal.merchantContact) {
    await prisma.deal.update({
      where: { id: payload.dealId },
      data: { status: 'Merchant Invited' },
    })

    sendMerchantInviteEmail({
      dealId: deal.id,
      merchantName: deal.merchantContact.ownerName,
      merchantEmail: deal.merchantContact.email,
      amount: offer.amount,
    }).catch(console.error)
  }

  return Response.json({ success: true })
}
