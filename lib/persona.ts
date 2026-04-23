const PERSONA_API = 'https://withpersona.com/api/v1'
const PERSONA_VERSION = '2023-01-05'

function headers() {
  return {
    'Authorization': `Bearer ${process.env.PERSONA_API_KEY}`,
    'Content-Type': 'application/json',
    'Persona-Version': PERSONA_VERSION,
  }
}

export async function createInquiry(referenceId: string): Promise<{ inquiryId: string }> {
  const res = await fetch(`${PERSONA_API}/inquiries`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      data: {
        attributes: {
          'inquiry-template-id': process.env.PERSONA_TEMPLATE_ID,
          'reference-id': referenceId,
        },
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Persona API ${res.status}: ${text}`)
  }

  const json = await res.json()
  return { inquiryId: json.data.id }
}
