import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function closePopupHtml(event: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Signing ${event}</title></head>
<body>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({ type: 'docusign', event: '${event}' }, window.location.origin);
    }
  } catch(e) {}
  window.close();
</script>
<p style="font-family:sans-serif;text-align:center;margin-top:80px;color:#555">
  ${event === 'signing_complete' ? 'Agreement signed! This window will close automatically.' : 'You may close this window.'}
</p>
</body>
</html>`
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const event = params.get('event') ?? 'unknown'
  const dealId = params.get('dealId')
  const envelopeId = params.get('envelopeId')
  const merchantToken = params.get('merchantToken')

  if (event === 'signing_complete' && dealId && envelopeId) {
    try {
      await Promise.all([
        prisma.agreementRecord.create({
          data: {
            dealId,
            provider: 'docusign',
            signatureRequestId: envelopeId,
            status: 'SIGNED',
            signedAt: new Date(),
          },
        }),
        prisma.deal.update({
          where: { id: dealId },
          data: { status: 'Agreement Signed' },
        }),
      ])
    } catch (err) {
      console.error('[docusign callback] DB write failed:', err)
    }
  }

  if (merchantToken) {
    const base = appUrl()
    return Response.redirect(`${base}/merchant?token=${encodeURIComponent(merchantToken)}`)
  }

  return new Response(closePopupHtml(event), {
    headers: { 'Content-Type': 'text/html' },
  })
}
