import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import BrokerPortal from './BrokerPortal'

function ErrorPage({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>Unable to load offer</h2>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{message}</p>
      </div>
    </div>
  )
}

export default async function BrokerPage({
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

  if (payload.type !== 'broker') {
    return <ErrorPage message="Invalid link." />
  }

  const deal = await prisma.deal.findUnique({
    where: { id: payload.dealId },
    include: {
      merchantContact: true,
      offers: { orderBy: { amount: 'asc' } },
    },
  })

  if (!deal) {
    return <ErrorPage message="Deal not found. It may have been removed." />
  }

  const serialized = {
    id: deal.id,
    status: deal.status,
    requestedAmount: deal.requestedAmount,
    merchantName: deal.merchantContact?.businessName ?? 'Merchant',
    offers: deal.offers.map(o => ({
      id: o.id,
      amount: o.amount,
      factorRate: o.factorRate,
      termDays: o.termDays,
      paymentFrequency: o.paymentFrequency,
      position: o.position,
      originationFee: o.originationFee,
      commissionPct: o.commissionPct,
      expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
      status: o.status as string,
    })),
  }

  return <BrokerPortal deal={serialized} token={token} />
}
