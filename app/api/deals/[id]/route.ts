import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendBrokerOfferEmail, sendMerchantInviteEmail } from '@/lib/email'

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
      brokerShop: true,
      offers: true,
    },
  })

  if (body?.status === 'Offer Sent to Broker' && deal.brokerContact) {
    sendBrokerOfferEmail({
      dealId: deal.id,
      brokerName: deal.brokerContact.name,
      brokerEmail: deal.brokerContact.email,
      merchantName: deal.merchantContact?.businessName ?? 'Merchant',
      offers: deal.offers,
      brokerShopId: deal.brokerShopId ?? null,
    }).catch(console.error)
  }

  if (body?.status === 'Merchant Invited' && deal.merchantContact) {
    sendMerchantInviteEmail({
      dealId: deal.id,
      merchantName: deal.merchantContact.ownerName,
      merchantEmail: deal.merchantContact.email,
      amount: deal.requestedAmount,
    }).catch(console.error)
  }

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

  await prisma.$transaction([
    prisma.offerSnapshot.deleteMany({ where: { offer: { dealId: id } } }),
    prisma.offer.deleteMany({ where: { dealId: id } }),
    prisma.bankConnectionRecord.deleteMany({ where: { dealId: id } }),
    prisma.identityVerificationRecord.deleteMany({ where: { dealId: id } }),
    prisma.agreementRecord.deleteMany({ where: { dealId: id } }),
    prisma.notificationLog.deleteMany({ where: { dealId: id } }),
    prisma.underwritingDecision.deleteMany({ where: { dealId: id } }),
    prisma.deal.delete({ where: { id } }),
  ])

  return new Response(null, { status: 204 })
}
