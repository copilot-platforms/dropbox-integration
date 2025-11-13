import crypto from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import env from '@/config/server.env'
import { DropboxWebhook } from '../lib/webhook.service'

export const handleWebhookUrlVerification = (req: NextRequest) => {
  try {
    const challenge = req.nextUrl.searchParams.get('challenge')
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: unknown) {
    console.error('Webhook verification error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export const handleWebhookEvents = async (req: NextRequest) => {
  try {
    const signature = req.headers.get('X-Dropbox-Signature')
    if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

    const body = await req.text()

    const computedSignature = crypto
      .createHmac('sha256', env.DROPBOX_APP_SECRET)
      .update(body)
      .digest('hex')

    // Validate webhook signature
    const valid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(computedSignature, 'hex'),
    )
    if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })

    const { list_folder } = JSON.parse(body)
    const accounts = list_folder?.accounts ?? []

    const dropboxWebhook = new DropboxWebhook()

    await Promise.all(
      accounts.map((account: string) => dropboxWebhook.fetchDropBoxChanges(account)),
    )

    // Dropbox expects a 200 OK with plain text body
    return new NextResponse('', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Dropbox webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
