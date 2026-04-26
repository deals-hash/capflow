import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { plaid } from '@/lib/plaid'
import { prisma } from '@/lib/prisma'
import { isMerchantTokenValid } from '@/lib/merchant-auth'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  const { public_token, dealId, metadata, merchantToken } = await request.json()

  if (!public_token || !dealId) {
    return Response.json({ error: 'public_token and dealId are required' }, { status: 400 })
  }

  const authorized = !!userId || isMerchantTokenValid(merchantToken, dealId)
  if (!authorized) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const exchangeResponse = await plaid.itemPublicTokenExchange({ public_token })
  const { access_token, item_id } = exchangeResponse.data

  const institutionName = metadata?.institution?.name ?? null

  await Promise.all([
    prisma.bankConnectionRecord.create({
      data: {
        dealId,
        plaidAccessToken: access_token,
        plaidItemId: item_id,
        institutionName,
        status: 'CONNECTED',
        rawData: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    }),
    prisma.deal.update({
      where: { id: dealId },
      data: { status: 'Bank Connected' },
    }),
  ])

  return Response.json({ success: true })
}
