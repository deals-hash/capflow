import jwt from 'jsonwebtoken'

export function isMerchantTokenValid(token: string | undefined | null, dealId: string): boolean {
  if (!token) return false
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET!) as { dealId: string; type: string }
    return p.type === 'merchant' && p.dealId === dealId
  } catch {
    return false
  }
}
