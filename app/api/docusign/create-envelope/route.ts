import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSigningEnvelope } from '@/lib/docusign'
import { isMerchantTokenValid } from '@/lib/merchant-auth'

function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  const { dealId, merchantToken } = await request.json()

  if (!dealId) return Response.json({ error: 'dealId is required' }, { status: 400 })

  const authorized = !!userId || isMerchantTokenValid(merchantToken, dealId)
  if (!authorized) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { merchantContact: true, offers: true },
  })

  if (!deal || !deal.merchantContact) {
    return Response.json({ error: 'Deal or merchant not found' }, { status: 404 })
  }

  const offer = deal.offers.find(o => o.status === 'ACCEPTED') ?? deal.offers[0]
  if (!offer) {
    return Response.json({ error: 'No offer found for deal' }, { status: 400 })
  }

  const base = appUrl()

  const { envelopeId, signingUrl } = await createSigningEnvelope({
    dealId,
    merchantEmail: deal.merchantContact.email,
    merchantName: deal.merchantContact.ownerName,
    amount: offer.amount,
    factorRate: offer.factorRate,
    termDays: offer.termDays,
    paymentFrequency: offer.paymentFrequency,
    returnUrl: (envId) => `${base}/api/docusign/callback?dealId=${dealId}&envelopeId=${envId}`,
  })

  return Response.json({ envelopeId, signingUrl })
}
