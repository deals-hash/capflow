'use client'

import { useState } from 'react'

type Offer = {
  id: string
  amount: number
  factorRate: number
  termDays: number
  paymentFrequency: string
  position: string
  originationFee: number
  commissionPct: number
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

function termLabel(freq: string): string {
  return freq === 'Daily' ? 'days' : freq === 'Weekly' ? 'weeks' : 'months'
}

function achPayments(offer: Offer): { count: number; perPayment: number } {
  const payback = offer.amount * offer.factorRate
  return { count: offer.termDays, perPayment: payback / offer.termDays }
}

function OfferCard({
  offer,
  index,
  selected,
  onSelect,
  submitted,
}: {
  offer: Offer
  index: number
  selected: boolean
  onSelect: () => void
  submitted: boolean
}) {
  const payback = offer.amount * offer.factorRate
  const feeAmount = offer.amount * (offer.originationFee / 100)
  const commissionAmount = offer.amount * (offer.commissionPct / 100)
  const { count: achCount, perPayment: achAmt } = achPayments(offer)

  const grid: [string, string][] = [
    ['Total Payback', usd(payback)],
    ['Factor Rate', `${offer.factorRate}x`],
    ['Term', `${offer.termDays} ${termLabel(offer.paymentFrequency)}`],
    ['Position', offer.position],
    ['Origination Fee', `${offer.originationFee}% · ${usd(feeAmount)}`],
    ['Frequency', offer.paymentFrequency],
  ]

  return (
    <div
      onClick={() => { if (!submitted) onSelect() }}
      style={{
        background: '#fff',
        border: `2px solid ${selected ? '#16a34a' : '#e2e8f0'}`,
        borderRadius: 14,
        padding: '24px 28px',
        cursor: submitted ? 'default' : 'pointer',
        boxShadow: selected ? '0 0 0 4px rgba(22,163,74,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Radio + label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: `2px solid ${selected ? '#16a34a' : '#cbd5e1'}`,
          background: selected ? '#16a34a' : '#fff',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.15s, background 0.15s',
        }}>
          {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: selected ? '#16a34a' : '#94a3b8', textTransform: 'uppercase' }}>
          Option {index + 1}
        </span>
      </div>

      {/* Advance amount */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Advance Amount</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{usd(offer.amount)}</div>
      </div>

      {/* 6-cell grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: '#e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
        {grid.map(([label, value]) => (
          <div key={label} style={{ background: '#f8fafc', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ACH Remittance */}
      <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>ACH Remittance:</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
          {usd(achAmt)} / {offer.paymentFrequency === 'Daily' ? 'day' : offer.paymentFrequency === 'Weekly' ? 'week' : 'month'}
        </span>
        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>· {achCount} payments</span>
      </div>

      {/* Commission banner */}
      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        border: '1px solid #bbf7d0',
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Your Commission</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>{usd(commissionAmount)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>{offer.commissionPct}% of advance</div>
          {offer.expiresAt && (
            <div style={{ fontSize: 11, color: '#86efac', marginTop: 2 }}>Offer expires {fmtDate(offer.expiresAt)}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfirmationScreen({ offer, merchantName }: { offer: Offer; merchantName: string }) {
  const payback = offer.amount * offer.factorRate
  const feeAmount = offer.amount * (offer.originationFee / 100)
  const commissionAmount = offer.amount * (offer.commissionPct / 100)
  const { count: achCount, perPayment: achAmt } = achPayments(offer)

  const rows: [string, string][] = [
    ['Advance Amount', usd(offer.amount)],
    ['Total Payback', usd(payback)],
    ['Factor Rate', `${offer.factorRate}x`],
    ['Term', `${offer.termDays} ${termLabel(offer.paymentFrequency)}`],
    ['Position', offer.position],
    ['Origination Fee', `${offer.originationFee}% · ${usd(feeAmount)}`],
    ['Payment Frequency', offer.paymentFrequency],
    ['ACH Remittance', `${usd(achAmt)} / ${offer.paymentFrequency === 'Daily' ? 'day' : offer.paymentFrequency === 'Weekly' ? 'week' : 'month'} · ${achCount} payments`],
  ]

  return (
    <div>
      <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 14, padding: '28px 32px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#15803d' }}>Offer Selected</div>
            <div style={{ fontSize: 13, color: '#16a34a', marginTop: 2 }}>
              {merchantName} · Offer confirmed and locked
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #bbf7d0' }}>
          {rows.map(([label, value], i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', background: i % 2 === 0 ? '#fff' : '#f0fdf4' }}>
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)', borderRadius: 14, padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Your Commission</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}>{usd(commissionAmount)}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{offer.commissionPct}% of advance amount</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Paid upon funding</div>
        </div>
      </div>

      <div style={{ marginTop: 20, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#64748b', textAlign: 'center' }}>
        The merchant has been notified to complete their funding application. You&apos;ll receive confirmation once funded.
      </div>
    </div>
  )
}

export default function BrokerPortal({ deal, token }: { deal: Deal; token: string }) {
  const preSelected = deal.offers.find(o => o.status === 'ACCEPTED')
  const [selectedId, setSelectedId] = useState<string | null>(preSelected?.id ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(!!preSelected)
  const [error, setError] = useState<string | null>(null)

  const selectedOffer = deal.offers.find(o => o.id === selectedId) ?? null

  const handleConfirm = async () => {
    if (!selectedId || submitted) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/broker/portal-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, offerId: selectedId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
      <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif", padding: '40px 16px 60px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              CapFlow · Offer Selection
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>{deal.merchantName}</h1>
            <div style={{ fontSize: 14, color: '#64748b', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Requested: <strong style={{ color: '#0f172a' }}>{usd(deal.requestedAmount)}</strong></span>
              <span style={{ color: '#cbd5e1' }}>·</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, border: '1px solid #e2e8f0' }}>{deal.id}</span>
            </div>
          </div>

          {submitted && selectedOffer ? (
            <ConfirmationScreen offer={selectedOffer} merchantName={deal.merchantName} />
          ) : (
            <>
              <p style={{ fontSize: 14, color: '#475569', margin: '0 0 24px' }}>
                Review the offers below and select the one you&apos;d like to proceed with. Click an offer to select it, then confirm your choice.
              </p>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#dc2626', fontWeight: 500 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {deal.offers.map((offer, i) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    index={i}
                    selected={selectedId === offer.id}
                    onSelect={() => setSelectedId(offer.id)}
                    submitted={submitted}
                  />
                ))}
              </div>

              <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <button
                  onClick={handleConfirm}
                  disabled={!selectedId || submitting}
                  style={{
                    background: selectedId && !submitting ? '#16a34a' : '#cbd5e1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '14px 32px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: selectedId && !submitting ? 'pointer' : 'not-allowed',
                    transition: 'background 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  {submitting ? 'Confirming…' : 'Confirm Selection'}
                </button>
                {!selectedId && (
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Select an offer above to continue</span>
                )}
                {selectedId && !submitting && (
                  <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                    {usd(deal.offers.find(o => o.id === selectedId)!.amount)} selected · click to confirm
                  </span>
                )}
              </div>
            </>
          )}

          <div style={{ marginTop: 48, textAlign: 'center', fontSize: 12, color: '#cbd5e1' }}>
            Powered by CapFlow &middot; This link expires in 7 days
          </div>
        </div>
      </div>
    </>
  )
}
