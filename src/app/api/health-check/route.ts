import { NextResponse } from 'next/server'

export const GET = () => {
  return NextResponse.json({
    message: 'Dropbox integration is rolling 🔥',
  })
}
