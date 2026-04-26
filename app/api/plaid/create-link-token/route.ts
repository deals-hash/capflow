import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { plaid } from '@/lib/plaid'
import { isMerchantTokenValid } from '@/lib/merchant-auth'
import { CountryCode, Products } from 'plaid'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  const { dealId, merchantToken } = await request.json()

  if (!dealId) return Response.json({ error: 'dealId is required' }, { status: 400 })

  const authorized = !!userId || isMerchantTokenValid(merchantToken, dealId)
  if (!authorized) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const clientUserId = userId ?? `merchant-${dealId}`

  const response = await plaid.linkTokenCreate({
    user: { client_user_id: clientUserId },
    client_name: 'YoYo Funding',
    products: [Products.Auth, Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    webhook: process.env.PLAID_WEBHOOK_URL,
  })

  return Response.json({ link_token: response.data.link_token })
}
