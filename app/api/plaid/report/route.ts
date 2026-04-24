import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { plaid } from '@/lib/plaid'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const dealId = request.nextUrl.searchParams.get('dealId')
  if (!dealId) return Response.json({ error: 'dealId is required' }, { status: 400 })

  const bankRecord = await prisma.bankConnectionRecord.findFirst({ where: { dealId } })
  if (!bankRecord?.plaidAccessToken) {
    return Response.json({ error: 'No bank connection found' }, { status: 404 })
  }

  const accessToken = bankRecord.plaidAccessToken
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [accountsRes, transactionsRes] = await Promise.all([
    plaid.accountsGet({ access_token: accessToken }),
    plaid.transactionsGet({ access_token: accessToken, start_date: startDate, end_date: endDate }),
  ])

  return Response.json({
    institution: bankRecord.institutionName,
    accounts: accountsRes.data.accounts,
    transactions: transactionsRes.data.transactions,
  })
}
