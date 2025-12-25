import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/app/globals.css'
import 'copilot-design-system/dist/styles/main.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'Assembly Dropbox Integration',
  description: 'Sync Assembly files with Dropbox effortlessly',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex min-h-screen flex-col bg-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
