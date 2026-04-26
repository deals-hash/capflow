export default async function BrokerConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; already?: string }>
}) {
  const { name, already } = await searchParams
  const merchantName = name ? decodeURIComponent(name) : 'the merchant'
  const wasAlready = already === '1'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; background: #111111; }
      `}</style>
      <div style={{ minHeight: '100vh', background: '#111111', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={{ maxWidth: 520, width: '100%' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 0 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>YOYO</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#d4af37', letterSpacing: '-0.02em' }}>FUNDING</span>
            </div>
          </div>

          {/* Card */}
          <div style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 20, padding: '48px 40px', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(212,175,55,0.15)', border: '2px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff', marginBottom: 10 }}>
              {wasAlready ? 'Already Confirmed' : 'Offer Confirmed!'}
            </div>
            <div style={{ fontSize: 15, color: '#999999', lineHeight: 1.6, marginBottom: 32 }}>
              {wasAlready
                ? `An offer for ${merchantName} was already selected. No changes have been made.`
                : `Your offer selection for ${merchantName} has been locked in. ${merchantName} will receive their funding application link shortly.`}
            </div>

            <div style={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: 12, padding: '20px 24px', marginBottom: 32 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>What happens next</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Merchant notified', `${merchantName} receives their onboarding link via email`],
                  ['Application completed', 'Merchant completes bank connection and identity verification'],
                  ['Funding disbursed', 'Upon approval, funds are sent directly to merchant'],
                ].map(([title, desc], i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#d4af37', color: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{title}</div>
                      <div style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 12, color: '#555555' }}>
              Questions? Contact your YoyoFunding account manager.
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#333333' }}>
            Powered by YoyoFunding
          </div>
        </div>
      </div>
    </>
  )
}
