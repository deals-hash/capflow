import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { sendMerchantInviteEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const offerId = searchParams.get('offerId')

  if (!token || !offerId) {
    return new Response('Missing token or offerId', { status: 400 })
  }

  let payload: { dealId: string; type: string }
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as { dealId: string; type: string }
  } catch {
    return new Response('Invalid or expired link', { status: 401 })
  }

  if (payload.type !== 'broker') {
    return new Response('Invalid token type', { status: 401 })
  }

  const offer = await prisma.offer.findFirst({
    where: { id: offerId, dealId: payload.dealId },
  })
  if (!offer) return new Response('Offer not found', { status: 404 })

  const deal = await prisma.deal.findUnique({
    where: { id: payload.dealId },
    include: { merchantContact: true },
  })
  if (!deal) return new Response('Deal not found', { status: 404 })

  const alreadyAccepted = await prisma.offer.findFirst({
    where: { dealId: payload.dealId, status: 'ACCEPTED' },
  })
  if (alreadyAccepted) {
    const name = encodeURIComponent(deal.merchantContact?.businessName ?? 'Merchant')
    return Response.redirect(new URL(`/broker/confirmed?name=${name}&already=1`, request.url))
  }

  await Promise.all([
    prisma.offer.update({ where: { id: offerId }, data: { status: 'ACCEPTED' } }),
    prisma.deal.update({ where: { id: payload.dealId }, data: { status: 'Offer Selected' } }),
  ])

  let finalStatus = 'Offer Selected'
  if (deal.merchantContact) {
    finalStatus = 'Merchant Invited'
    await prisma.deal.update({ where: { id: payload.dealId }, data: { status: 'Merchant Invited' } })
    sendMerchantInviteEmail({
      dealId: deal.id,
      merchantName: deal.merchantContact.ownerName,
      merchantEmail: deal.merchantContact.email,
      amount: offer.amount,
    }).catch(console.error)
  }

  const name = encodeURIComponent(deal.merchantContact?.businessName ?? 'Merchant')
  return Response.redirect(new URL(`/broker/confirmed?name=${name}`, request.url))
}
