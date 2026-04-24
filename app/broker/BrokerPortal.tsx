'use client'

import { useState } from 'react'

type Offer = {
  id: string
  amount: number
  factorRate: number
  termDays: number
  paymentFrequency: string
  expiresAt: string | null
  status: string
}

type Deal = {
  id: string
  status: string
  requestedAmount: number
  merchantName: string
  offers: Offer[]
}

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function BrokerPortal({ deal, token }: { deal: Deal; token: string }) {
  const preSelected = deal.offers.find(o => o.status === 'ACCEPTED')
  const [selected, setSelected] = useState<string | null>(preSelected?.id ?? null)
  const [loading, setLoading] = useState<string | null>(null)
  const [done, setDone] = useState(!!preSelected)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = async (offerId: string) => {
    if (done) return
    setLoading(offerId)
    setError(null)
    try {
      const res = await fetch('/api/broker/portal-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, offerId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
      } else {
        setSelected(offerId)
        setDone(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '40px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            CapFlow · Offer Selection
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>{deal.merchantName}</h1>
          <div style={{ fontSize: 14, color: '#64748b' }}>
            Requested: <strong style={{ color: '#0f172a' }}>{usd(deal.requestedAmount)}</strong>
            <span style={{ margin: '0 8px', color: '#cbd5e1' }}>·</span>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{deal.id}</span>
          </div>
        </div>

        {done ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14, color: '#16a34a' }}>✓</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>Offer Selected</div>
            <div style={{ fontSize: 14, color: '#166534', maxWidth: 380, margin: '0 auto' }}>
              Your selection has been received. The merchant will be contacted to complete their funding application.
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: '#475569', margin: '0 0 20px' }}>
              Review the offers below and select the one you&apos;d like to proceed with.
            </p>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {deal.offers.map(offer => {
                const payback = Math.round(offer.amount * offer.factorRate)
                const isLoading = loading === offer.id
                const isSelected = selected === offer.id

                return (
                  <div
                    key={offer.id}
                    style={{
                      background: '#fff',
                      border: `1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                      borderRadius: 12,
                      padding: '20px 24px',
                      boxShadow: isSelected ? '0 0 0 3px rgba(37,99,235,0.1)' : '0 1px 3px rgba(0,0,0,0.06)',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{usd(offer.amount)}</div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                          Payback: <strong style={{ color: '#0f172a' }}>{usd(payback)}</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelect(offer.id)}
                        disabled={isLoading}
                        style={{
                          background: isLoading ? '#94a3b8' : '#2563eb',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '10px 22px',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'background 0.15s',
                        }}
                      >
                        {isLoading ? 'Selecting…' : 'Select This Offer'}
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px 20px', marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                      {([
                        ['Factor Rate', `${offer.factorRate}x`],
                        ['Term', `${offer.termDays} days`],
                        ['Frequency', offer.paymentFrequency],
                        ...(offer.expiresAt ? [['Expires', fmtDate(offer.expiresAt)]] : []),
                      ] as [string, string][]).map(([label, value]) => (
                        <div key={label}>
                          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div style={{ marginTop: 40, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          Powered by CapFlow &middot; This link expires in 7 days
        </div>
      </div>
    </div>
  )
}
