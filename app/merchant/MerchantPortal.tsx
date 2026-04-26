'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'

type Deal = {
  id: string
  merchantName: string
  amount: number
  factorRate: number
  termDays: number
  paymentFrequency: string
  position: string
  bankConnected: boolean
  identityVerified: boolean
  agreementSigned: boolean
}

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const STEPS = ['Bank Connection', 'Identity Verification', 'Sign Agreement']

// ─── PLAID STEP ───────────────────────────────────────────────────────────────
function PlaidStep({ dealId, token, onDone }: { dealId: string; token: string; onDone: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [exchanging, setExchanging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/plaid/create-link-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, merchantToken: token }),
    })
      .then(r => r.json())
      .then(d => setLinkToken(d.link_token ?? null))
      .catch(() => setError('Failed to initialise bank connection. Please try again.'))
  }, [dealId, token])

  const onSuccess = useCallback(async (public_token: string, metadata: unknown) => {
    setExchanging(true)
    try {
      const res = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token, dealId, metadata, merchantToken: token }),
      })
      if (!res.ok) throw new Error()
      onDone()
    } catch {
      setError('Bank connection failed. Please try again.')
    } finally {
      setExchanging(false)
    }
  }, [dealId, token, onDone])

  const { open, ready } = usePlaidLink({ token: linkToken ?? '', onSuccess })

  return (
    <div>
      <p style={{ color: '#999999', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
        Securely link your business bank account so we can review recent transactions. This uses Plaid — your credentials are never shared with us.
      </p>
      {error && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 16 }}>{error}</div>}
      <GoldButton onClick={() => open()} disabled={!ready || exchanging || !linkToken}>
        {exchanging ? 'Connecting…' : !linkToken ? 'Initialising…' : 'Connect Bank Account'}
      </GoldButton>
    </div>
  )
}

// ─── PERSONA STEP ─────────────────────────────────────────────────────────────
function PersonaStep({ dealId, token, onDone }: { dealId: string; token: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/persona/create-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, merchantToken: token }),
      })
      if (!res.ok) throw new Error()
      const { inquiryId } = await res.json()

      const { Client } = await import('persona')
      const client = new Client({
        inquiryId,
        environment: (process.env.NEXT_PUBLIC_PERSONA_ENV ?? 'sandbox') as 'sandbox' | 'production',
        onReady: () => { client.open(); setLoading(false) },
        onComplete: async ({ inquiryId: completedId, status, fields }: { inquiryId: string; status: string; fields: unknown }) => {
          try {
            await fetch('/api/persona/complete-inquiry', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dealId, inquiryId: completedId, status, fields, merchantToken: token }),
            })
            onDone()
          } catch {
            setError('Failed to save verification. Please try again.')
          }
        },
        onCancel: () => setLoading(false),
        onError: () => { setError('Verification failed. Please try again.'); setLoading(false) },
      })
    } catch {
      setError('Failed to start identity check. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{ color: '#999999', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
        We need to verify the identity of all owners and guarantors. Have a government-issued photo ID ready. This takes under 2 minutes.
      </p>
      {error && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 16 }}>{error}</div>}
      <GoldButton onClick={handleClick} disabled={loading}>
        {loading ? 'Loading…' : 'Start Identity Verification'}
      </GoldButton>
    </div>
  )
}

// ─── DOCUSIGN STEP ────────────────────────────────────────────────────────────
function DocuSignStep({ dealId, token }: { dealId: string; token: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/docusign/create-envelope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, merchantToken: token }),
      })
      if (!res.ok) throw new Error()
      const { signingUrl } = await res.json()
      window.location.href = signingUrl
    } catch {
      setError('Failed to start signing. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{ color: '#999999', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
        Review and electronically sign your merchant cash advance agreement. You&apos;ll be redirected to DocuSign and returned here when complete.
      </p>
      {error && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 16 }}>{error}</div>}
      <GoldButton onClick={handleClick} disabled={loading}>
        {loading ? 'Redirecting…' : 'Review & Sign Agreement'}
      </GoldButton>
    </div>
  )
}

// ─── GOLD BUTTON ──────────────────────────────────────────────────────────────
function GoldButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? '#333333' : '#d4af37',
        color: disabled ? '#666666' : '#111111',
        border: 'none',
        borderRadius: 12,
        padding: '14px 32px',
        fontSize: 15,
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: 'background 0.15s',
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </button>
  )
}

// ─── MAIN PORTAL ──────────────────────────────────────────────────────────────
export default function MerchantPortal({ deal, token }: { deal: Deal; token: string }) {
  const initStep = () => {
    if (!deal.bankConnected) return 0
    if (!deal.identityVerified) return 1
    if (!deal.agreementSigned) return 2
    return 3
  }

  const [step, setStep] = useState(initStep)

  const payback = deal.amount * deal.factorRate
  const achCount =
    deal.paymentFrequency === 'Weekly' ? Math.round(deal.termDays * 4.33) :
    deal.paymentFrequency === 'Monthly' ? deal.termDays :
    Math.round(deal.termDays * 21.5)
  const achAmt = payback / achCount
  const freqLabel = deal.paymentFrequency === 'Daily' ? 'day' : deal.paymentFrequency === 'Weekly' ? 'week' : 'month'

  const stepIcons = ['🏦', '🪪', '✍️']
  const stepTitles = ['Connect Your Bank', 'Verify Your Identity', 'Sign Your Agreement']

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; background: #111111; }
      `}</style>
      <div style={{ minHeight: '100vh', background: '#111111', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", padding: '0 0 60px' }}>

        {/* Header */}
        <div style={{ background: '#1c1c1c', borderBottom: '1px solid #2a2a2a', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>YOYO</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#d4af37', letterSpacing: '-0.02em' }}>FUNDING</span>
          </div>
          <div style={{ fontSize: 12, color: '#555555' }}>Merchant Portal</div>
        </div>

        <div style={{ maxWidth: 660, margin: '0 auto', padding: '36px 16px 0' }}>

          {/* Merchant name + deal ID */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: '#555555', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              Funding Application
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#ffffff', margin: '0 0 4px' }}>{deal.merchantName}</h1>
            <div style={{ fontSize: 12, color: '#444444', fontFamily: 'monospace' }}>{deal.id}</div>
          </div>

          {/* Offer snapshot */}
          <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 16, padding: '20px 24px', marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Your Approved Offer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: '#2a2a2a', borderRadius: 10, overflow: 'hidden' }}>
              {[
                ['Advance Amount', usd(deal.amount)],
                ['Total Payback', usd(payback)],
                ['Factor Rate', `${deal.factorRate}x`],
                ['Term', `${deal.termDays} months`],
                ['Position', deal.position],
                ['ACH Remittance', `${usd(achAmt)}/${freqLabel}`],
              ].map(([label, value]) => (
                <div key={label} style={{ background: '#1c1c1c', padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {step === 3 ? (
            /* ─── Complete screen ─── */
            <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 20, padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(212,175,55,.15)', border: '2px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>✓</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', marginBottom: 10 }}>Application Complete!</div>
              <div style={{ fontSize: 14, color: '#888888', lineHeight: 1.7, marginBottom: 32 }}>
                Your application has been submitted to our underwriting team. You&apos;ll hear from us within 1–2 business days.
              </div>
              <div style={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: 12, padding: '20px 24px', textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Completed Steps</div>
                {STEPS.map((s, i) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < STEPS.length - 1 ? '1px solid #1c1c1c' : 'none' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>✓</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#d4af37' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
                {STEPS.map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i < step ? '#d4af37' : i === step ? 'rgba(212,175,55,.4)' : '#2a2a2a', transition: 'background 0.3s' }} />
                ))}
              </div>

              {/* Step list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {STEPS.map((label, i) => (
                  <div key={label} style={{
                    background: i === step ? '#1c1c1c' : 'transparent',
                    border: `1px solid ${i === step ? '#2a2a2a' : 'transparent'}`,
                    borderRadius: 14,
                    padding: i === step ? '24px 24px' : '10px 16px',
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i === step ? 20 : 0 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: i < step ? '#d4af37' : i === step ? 'rgba(212,175,55,.15)' : '#1c1c1c',
                        border: `2px solid ${i < step ? '#d4af37' : i === step ? '#d4af37' : '#2a2a2a'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: i < step ? 13 : 15,
                      }}>
                        {i < step ? <span style={{ color: '#111111', fontWeight: 800, fontSize: 13 }}>✓</span> : stepIcons[i]}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: i < step ? '#d4af37' : i === step ? '#d4af37' : '#444444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Step {i + 1}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: i < step ? '#888888' : i === step ? '#ffffff' : '#444444' }}>
                          {label} {i < step && <span style={{ color: '#d4af37', fontSize: 12 }}>— Completed</span>}
                        </div>
                      </div>
                    </div>

                    {i === step && (
                      <div style={{ paddingLeft: 44 }}>
                        {step === 0 && <PlaidStep dealId={deal.id} token={token} onDone={() => setStep(1)} />}
                        {step === 1 && <PersonaStep dealId={deal.id} token={token} onDone={() => setStep(2)} />}
                        {step === 2 && <DocuSignStep dealId={deal.id} token={token} />}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Step counter */}
              <div style={{ textAlign: 'center', fontSize: 12, color: '#444444' }}>
                Step {step + 1} of {STEPS.length}
              </div>
            </>
          )}

          <div style={{ marginTop: 40, textAlign: 'center', fontSize: 12, color: '#333333' }}>
            Powered by YoyoFunding &middot; This link expires in 7 days
          </div>
        </div>
      </div>
    </>
  )
}
