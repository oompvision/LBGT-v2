"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MailCheck } from "lucide-react"

export default function MagicLinkSignInPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const supabase = createClient()
      if (!supabase) {
        setErrorMessage("Authentication service unavailable")
        setIsLoading(false)
        return
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      // Always show success to avoid leaking whether the email is registered.
      // If the email isn't a known user, no link is sent — same UI either way.
      if (error) {
        console.error("Magic link error:", error.message)
      }
      setSent(true)
    } catch (error) {
      console.error("Unexpected magic link error:", error)
      setErrorMessage("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container flex items-center justify-center">
          <Card className="mx-auto w-full max-w-md">
            <CardHeader>
              <CardTitle>Sign In with Magic Link</CardTitle>
              <CardDescription>
                Enter your email and we&apos;ll send you a one-click sign-in link.
              </CardDescription>
            </CardHeader>

            {sent ? (
              <CardContent className="space-y-4">
                <Alert>
                  <MailCheck className="h-4 w-4" />
                  <AlertDescription>
                    If an account exists for <span className="font-medium">{email}</span>,
                    a sign-in link is on its way. Check your inbox (and spam folder).
                    The link expires in 1 hour.
                  </AlertDescription>
                </Alert>
                <div className="text-center text-sm">
                  <Link href="/signin" className="text-muted-foreground underline">
                    Back to sign in
                  </Link>
                </div>
              </CardContent>
            ) : (
              <form onSubmit={handleSendLink}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  {errorMessage && (
                    <Alert variant="destructive">
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <Button
                    type="submit"
                    className="w-full text-white"
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Magic Link"}
                  </Button>
                  <div className="text-center text-sm">
                    <Link href="/signin" className="text-muted-foreground underline">
                      Sign in with password instead
                    </Link>
                  </div>
                </CardFooter>
              </form>
            )}
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
