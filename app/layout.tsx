import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Codesist',
  description: 'Speed coding challenge',
  generator: 'timara',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
