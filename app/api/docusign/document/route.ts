import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEnvelopeDocument } from '@/lib/docusign'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const dealId = request.nextUrl.searchParams.get('dealId')
  if (!dealId) return new Response('dealId is required', { status: 400 })

  const agreement = await prisma.agreementRecord.findFirst({
    where: { dealId, status: 'SIGNED' },
  })

  if (!agreement?.signatureRequestId) {
    return new Response('No signed agreement found', { status: 404 })
  }

  const { data, contentType } = await getEnvelopeDocument(agreement.signatureRequestId, 'combined')

  return new Response(data, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="agreement-${dealId}.pdf"`,
    },
  })
}
