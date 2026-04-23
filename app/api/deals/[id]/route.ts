import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendBrokerOfferEmail, sendMerchantInviteEmail } from '@/lib/email'
import { toDb, mapDealOut } from '@/lib/dealStatus'

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

  return Response.json(mapDealOut(deal as unknown as Record<string, unknown>))
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
  const uiStatus = body?.status as string | undefined

  const dbData = uiStatus ? { ...body, status: toDb(uiStatus) } : body

  const deal = await prisma.deal.update({
    where: { id },
    data: dbData,
    include: {
      brokerContact: true,
      merchantContact: true,
      offers: true,
    },
  })

  if (uiStatus === 'Offer Sent to Broker' && deal.brokerContact) {
    const amount = deal.offers[0]?.amount ?? deal.requestedAmount
    sendBrokerOfferEmail({
      dealId: deal.id,
      brokerName: deal.brokerContact.name,
      brokerEmail: deal.brokerContact.email,
      merchantName: deal.merchantContact?.businessName ?? 'Merchant',
      amount,
    }).catch(console.error)
  }

  if (uiStatus === 'Merchant Invited' && deal.merchantContact) {
    sendMerchantInviteEmail({
      dealId: deal.id,
      merchantName: deal.merchantContact.ownerName,
      merchantEmail: deal.merchantContact.email,
      amount: deal.requestedAmount,
    }).catch(console.error)
  }

  return Response.json(mapDealOut(deal as unknown as Record<string, unknown>))
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
