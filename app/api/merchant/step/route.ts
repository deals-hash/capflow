import { auth } from '@clerk/nextjs/server'
import { Prisma } from '@prisma/client'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_STEPS = [
  'identity',
  'bank_connection',
  'agreement',
  'complete',
] as const

type Step = (typeof VALID_STEPS)[number]

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dealId = request.nextUrl.searchParams.get('dealId')
  if (!dealId) {
    return Response.json({ error: 'dealId is required' }, { status: 400 })
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      identityRecords: true,
      bankConnections: true,
      agreements: true,
    },
  })

  if (!deal) {
    return Response.json({ error: 'Deal not found' }, { status: 404 })
  }

  const completedSteps = {
    identity: deal.identityRecords.some((r) => r.status === 'COMPLETE'),
    bank_connection: deal.bankConnections.some((r) => r.status === 'ACTIVE'),
    agreement: deal.agreements.some((r) => r.status === 'SIGNED'),
  }

  const nextStep = VALID_STEPS.find(
    (step) => step !== 'complete' && !completedSteps[step as keyof typeof completedSteps]
  ) ?? 'complete'

  return Response.json({ dealId, completedSteps, nextStep })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { dealId, step, data } = body as { dealId: string; step: Step; data: Record<string, unknown> }

  if (!dealId || !step) {
    return Response.json({ error: 'dealId and step are required' }, { status: 400 })
  }

  if (!VALID_STEPS.includes(step)) {
    return Response.json({ error: `Invalid step. Must be one of: ${VALID_STEPS.join(', ')}` }, { status: 400 })
  }

  let result: unknown

  switch (step) {
    case 'identity':
      result = await prisma.identityVerificationRecord.create({
        data: {
          dealId,
          provider: 'persona',
          inquiryId: (data?.inquiryId as string) ?? null,
          status: 'PENDING',
          rawData: (data ?? {}) as Prisma.InputJsonValue,
        },
      })
      break

    case 'bank_connection':
      result = await prisma.bankConnectionRecord.create({
        data: {
          dealId,
          plaidItemId: (data?.itemId as string) ?? null,
          institutionName: (data?.institutionName as string) ?? null,
          status: 'PENDING',
          rawData: (data ?? {}) as Prisma.InputJsonValue,
        },
      })
      break

    case 'agreement':
      result = await prisma.agreementRecord.create({
        data: {
          dealId,
          provider: 'dropbox_sign',
          signatureRequestId: (data?.signatureRequestId as string) ?? null,
          status: 'PENDING',
          rawData: (data ?? {}) as Prisma.InputJsonValue,
        },
      })
      break

    case 'complete':
      result = await prisma.deal.update({
        where: { id: dealId },
        data: { status: 'UNDERWRITING' },
      })
      break
  }

  return Response.json({ step, result }, { status: 201 })
}
