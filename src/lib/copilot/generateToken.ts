import * as crypto from 'node:crypto'
import type { Token } from './types'

function generate128BitKey(apiKey: string) {
  const hmac = crypto.createHmac('sha256', apiKey).digest('hex')
  return hmac.slice(0, 32)
}

function encryptAES128BitToken(key: string, payload: string) {
  const keyBuffer = Buffer.from(key, 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-128-cbc', keyBuffer, iv)
  let encrypted = cipher.update(payload, 'utf-8')
  encrypted = Buffer.concat([encrypted, cipher.final()])
  const tokenBuffer = Buffer.concat([iv, encrypted])
  return tokenBuffer.toString('hex')
}

export function generateToken(apiKey: string, payload: Token) {
  const payloadString = JSON.stringify(payload)
  const key = generate128BitKey(apiKey)
  const token = encryptAES128BitToken(key, payloadString)
  return token
}
