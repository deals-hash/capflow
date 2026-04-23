import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { toDb } from '@/lib/dealStatus'

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

  if (event === 'signing_complete' && dealId && envelopeId) {
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
        data: { status: toDb('Agreement Signed') },
      }),
    ]).catch(console.error)
  }

  return new Response(closePopupHtml(event), {
    headers: { 'Content-Type': 'text/html' },
  })
}
