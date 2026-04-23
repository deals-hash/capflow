import jwt from 'jsonwebtoken'

interface TokenCache { token: string; expiresAt: number }
let tokenCache: TokenCache | null = null

function oauthBase(): string {
  const base = process.env.DOCUSIGN_BASE_URL ?? ''
  return base.includes('demo.docusign.net')
    ? 'https://account-d.docusign.com'
    : 'https://account.docusign.com'
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token

  const privateKey = (process.env.DOCUSIGN_SECRET_KEY ?? '').replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)

  const assertion = jwt.sign(
    { scope: 'signature', iss: process.env.DOCUSIGN_INTEGRATION_KEY, sub: process.env.DOCUSIGN_USER_ID, aud: oauthBase().replace('https://', ''), iat: now, exp: now + 3600 },
    privateKey,
    { algorithm: 'RS256' }
  )

  const res = await fetch(`${oauthBase()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })

  if (!res.ok) throw new Error(`DocuSign auth failed: ${res.status} ${await res.text()}`)
  const { access_token, expires_in } = await res.json() as { access_token: string; expires_in: number }
  tokenCache = { token: access_token, expiresAt: Date.now() + expires_in * 1000 }
  return access_token
}

async function dsRequest(path: string, method: string, body?: unknown) {
  const token = await getAccessToken()
  const base = process.env.DOCUSIGN_BASE_URL!
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID!
  const url = `${base}/v2.1/accounts/${accountId}${path}`

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) throw new Error(`DocuSign API ${method} ${path} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

function usd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function buildAgreementHtml(params: {
  merchantName: string
  dealId: string
  amount: number
  factorRate: number
  termDays: number
  paymentFrequency: string
}): string {
  const { merchantName, dealId, amount, factorRate, termDays, paymentFrequency } = params
  const payback = amount * factorRate
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;max-width:680px;margin:40px auto;color:#111;line-height:1.6}
  h1{font-size:20px;text-align:center;border-bottom:2px solid #111;padding-bottom:10px}
  h2{font-size:15px;margin-top:28px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th,td{border:1px solid #ccc;padding:7px 12px;text-align:left;font-size:14px}
  th{background:#f5f5f5;font-weight:600}
  .sig-block{margin-top:60px;padding-top:20px;border-top:1px solid #999}
  .anchor{color:white;font-size:1px;line-height:1px}
</style></head>
<body>
  <h1>Merchant Cash Advance Agreement</h1>
  <p><strong>Date:</strong> ${today} &nbsp;&nbsp; <strong>Deal ID:</strong> ${dealId}</p>
  <h2>Merchant</h2>
  <p>${merchantName}</p>
  <h2>Advance Terms</h2>
  <table>
    <tr><th>Advance Amount</th><td>${usd(amount)}</td></tr>
    <tr><th>Factor Rate</th><td>${factorRate}</td></tr>
    <tr><th>Total Payback Amount</th><td>${usd(payback)}</td></tr>
    <tr><th>Term Length</th><td>${termDays} days</td></tr>
    <tr><th>Payment Frequency</th><td>${paymentFrequency}</td></tr>
  </table>
  <h2>Agreement</h2>
  <p>By signing below, the Merchant agrees to the repayment terms above and authorises YoYo Funding to debit
  the agreed payment from the Merchant's designated bank account per the payment frequency specified.
  The Merchant certifies that all information provided is accurate and complete, and acknowledges this
  agreement is legally binding upon execution.</p>
  <div class="sig-block">
    <p><strong>Authorised Signature</strong></p>
    <span class="anchor">/sn1/</span>
    <br><br>
    <p>Print Name: _____________________________ &nbsp;&nbsp; Date: _________________</p>
  </div>
</body>
</html>`
}

export interface CreateEnvelopeResult {
  envelopeId: string
  signingUrl: string
}

export async function createSigningEnvelope(params: {
  dealId: string
  merchantEmail: string
  merchantName: string
  amount: number
  factorRate: number
  termDays: number
  paymentFrequency: string
  returnUrl: (envelopeId: string) => string
}): Promise<CreateEnvelopeResult> {
  const { dealId, merchantEmail, merchantName, returnUrl, amount, factorRate, termDays, paymentFrequency } = params

  const htmlContent = buildAgreementHtml({ merchantName, dealId, amount, factorRate, termDays, paymentFrequency })

  const envelopeBody = {
    emailSubject: 'Please sign your Merchant Cash Advance Agreement',
    status: 'sent',
    documents: [{ documentBase64: Buffer.from(htmlContent).toString('base64'), name: 'MCA Agreement', fileExtension: 'html', documentId: '1' }],
    recipients: {
      signers: [{
        email: merchantEmail,
        name: merchantName,
        recipientId: '1',
        clientUserId: dealId,
        tabs: {
          signHereTabs: [{ anchorString: '/sn1/', anchorUnits: 'pixels', anchorXOffset: '20', anchorYOffset: '10' }],
        },
      }],
    },
  }

  const envResult = await dsRequest('/envelopes', 'POST', envelopeBody)
  const envelopeId: string = envResult.envelopeId

  const viewResult = await dsRequest(`/envelopes/${envelopeId}/views/recipient`, 'POST', {
    returnUrl: returnUrl(envelopeId),
    authenticationMethod: 'none',
    email: merchantEmail,
    userName: merchantName,
    clientUserId: dealId,
  })

  return { envelopeId, signingUrl: viewResult.url }
}
