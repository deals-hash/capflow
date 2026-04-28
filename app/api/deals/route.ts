import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status')

  const deals = await prisma.deal.findMany({
    where: status ? { status } : undefined,
    include: {
      brokerContact: true,
      merchantContact: true,
      offers: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json(deals)
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { merchant, broker, offers: offerData, status } = body

  // Full UI shape — create/upsert contacts and offers inline
  if (merchant?.email) {
    const merchantContact = await prisma.merchantContact.upsert({
      where: { email: merchant.email },
      update: {
        businessName: merchant.name,
        ownerName: merchant.ownerName ?? merchant.name,
        phone: merchant.phone ?? null,
        ein: merchant.ein ?? null,
        ownerDob: merchant.ownerDob ?? null,
        ownerSsnLast4: merchant.ownerSsnLast4 ?? null,
      },
      create: {
        businessName: merchant.name,
        ownerName: merchant.ownerName ?? merchant.name,
        email: merchant.email,
        phone: merchant.phone ?? null,
        ein: merchant.ein ?? null,
        ownerDob: merchant.ownerDob ?? null,
        ownerSsnLast4: merchant.ownerSsnLast4 ?? null,
      },
    })

    const brokerContact = broker?.email
      ? await prisma.brokerContact.upsert({
          where: { email: broker.email },
          update: { name: broker.name },
          create: { name: broker.name, email: broker.email },
        })
      : null

    const firstAmount = offerData?.[0]?.amount ? parseFloat(offerData[0].amount) : 0

    const deal = await prisma.deal.create({
      data: {
        requestedAmount: firstAmount,
        status: status ?? 'Offer Created',
        brokerContactId: brokerContact?.id ?? undefined,
        merchantContactId: merchantContact.id,
        offers: offerData?.length ? {
          create: offerData.map((o: Record<string, string>) => ({
            amount: parseFloat(o.amount) || 0,
            factorRate: parseFloat(o.factor) || 1,
            termDays: parseInt(o.term) || 1,
            paymentFrequency: o.frequency || 'Daily',
            position: o.position || '1st',
            originationFee: parseFloat(o.fee) || 1,
            commissionPct: parseFloat(o.commissionPct) || 10,
            expiresAt: o.expiry ? new Date(o.expiry) : null,
          })),
        } : undefined,
      },
      include: { brokerContact: true, merchantContact: true, offers: true },
    })

    return Response.json(deal, { status: 201 })
  }

  // Simple shape — just requestedAmount + optional contact IDs
  const { requestedAmount, brokerContactId, merchantContactId } = body
  if (!requestedAmount) {
    return Response.json({ error: 'requestedAmount is required' }, { status: 400 })
  }

  const deal = await prisma.deal.create({
    data: { requestedAmount, brokerContactId, merchantContactId },
    include: { brokerContact: true, merchantContact: true, offers: true },
  })

  return Response.json(deal, { status: 201 })
}
