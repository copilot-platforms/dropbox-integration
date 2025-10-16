import { type NextRequest, NextResponse } from 'next/server'

export const handleWebhookUrlVerification = (req: NextRequest) => {
  try {
    const challenge = req.nextUrl.searchParams.get('challenge')
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  } catch (error: unknown) {
    console.error(`error: ${error}`)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
