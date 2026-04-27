import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import MerchantPortal from './MerchantPortal'

function ErrorPage({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#111111', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: '0 0 8px' }}>Unable to load application</h2>
        <p style={{ color: '#666666', fontSize: 14, margin: 0 }}>{message}</p>
      </div>
    </div>
  )
}

export default async function MerchantPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return <ErrorPage message="Missing token. Please use the link from your email." />
  }

  let payload: { dealId: string; type: string }
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as { dealId: string; type: string }
  } catch {
    return <ErrorPage message="This link has expired or is invalid. Please contact your account manager." />
  }

  if (payload.type !== 'merchant') {
    return <ErrorPage message="Invalid link." />
  }

  const deal = await prisma.deal.findUnique({
    where: { id: payload.dealId },
    include: {
      merchantContact: true,
      offers: { orderBy: { createdAt: 'asc' } },
      bankConnections: { orderBy: { createdAt: 'desc' }, take: 1 },
      identityRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
      agreements: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  if (!deal) {
    return <ErrorPage message="Application not found. Please contact your account manager." />
  }

  const acceptedOffer = deal.offers.find(o => o.status === 'ACCEPTED') ?? deal.offers[0]

  if (!acceptedOffer) {
    return <ErrorPage message="No offer found for this application. Please contact your account manager." />
  }

  const serialized = {
    id: deal.id,
    merchantName: deal.merchantContact?.businessName ?? deal.merchantContact?.ownerName ?? 'Merchant',
    amount: acceptedOffer.amount,
    factorRate: acceptedOffer.factorRate,
    termDays: acceptedOffer.termDays,
    paymentFrequency: acceptedOffer.paymentFrequency,
    position: acceptedOffer.position,
    bankConnected: deal.bankConnections.some(r =>
      !['pending', 'failed'].includes(r.status.toLowerCase())
    ),
    identityVerified: deal.identityRecords.some(r =>
      r.status.toLowerCase() !== 'pending'
    ),
    agreementSigned: deal.agreements.some(r => r.status === 'SIGNED'),
  }

  return <MerchantPortal deal={serialized} token={token} />
}
