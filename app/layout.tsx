import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/components/auth-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "The Long Beach Golf Tour",
  description: "Book your tee times for the Long Beach Golf Tour",
  viewport: "width=device-width, initial-scale=1.0",
  generator: "v0.dev",
  icons: {
    icon: "/images/osprey-logo.png",
    shortcut: "/images/osprey-logo.png",
    apple: "/images/osprey-logo.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/images/osprey-logo.png" type="image/png" />
        <link rel="shortcut icon" href="/images/osprey-logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/images/osprey-logo.png" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
