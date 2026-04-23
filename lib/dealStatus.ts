const UI_TO_DB: Record<string, string> = {
  'Offer Created':          'PENDING',
  'Offer Sent to Broker':   'UNDERWRITING',
  'Offer Selected':         'UNDERWRITING',
  'Merchant Invited':       'UNDERWRITING',
  'Bank Connected':         'UNDERWRITING',
  'Identity Verified':      'UNDERWRITING',
  'Agreement Signed':       'UNDERWRITING',
  'Ready for Final UW':     'UNDERWRITING',
  'UW Approved':            'APPROVED',
  'UW Declined':            'DECLINED',
  'Funding Call Completed': 'APPROVED',
  'Funded':                 'FUNDED',
}

const DB_TO_UI: Record<string, string> = {
  'PENDING':      'Offer Created',
  'UNDERWRITING': 'Offer Sent to Broker',
  'APPROVED':     'UW Approved',
  'DECLINED':     'UW Declined',
  'FUNDED':       'Funded',
}

export function toDb(uiStatus: string): string {
  return UI_TO_DB[uiStatus] ?? 'PENDING'
}

export function toUi(dbStatus: string): string {
  return DB_TO_UI[dbStatus] ?? dbStatus
}

export function mapDealOut(deal: Record<string, unknown>): Record<string, unknown> {
  return { ...deal, status: toUi(deal.status as string) }
}
