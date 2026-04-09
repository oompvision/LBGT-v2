"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { sendPasswordResetEmail } from "@/app/actions/reset-password"

export default function ResetPasswordPage() {
  const [mode, setMode] = useState<"loading" | "request" | "update">("loading")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update")
      }
    })

    // Check if the URL hash contains a recovery token
    // The SDK may not have processed it yet, so handle it explicitly
    const hash = window.location.hash
    if (hash && hash.includes("type=recovery")) {
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get("access_token")
      const refreshToken = params.get("refresh_token")

      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error }) => {
            if (!error) {
              setMode("update")
              // Clean the hash from the URL
              window.history.replaceState(null, "", window.location.pathname)
            } else {
              console.error("Error setting recovery session:", error)
              setMode("request")
            }
          })
      } else {
        setMode("request")
      }
    } else {
      // No recovery hash — check for an existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setMode(session ? "update" : "request")
      })
    }

    return () => subscription.unsubscribe()
  }, [])

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    const result = await sendPasswordResetEmail(email)

    if (result.success) {
      setMessage({ type: "success", text: "Check your email for a password reset link." })
    } else {
      setMessage({ type: "error", text: result.error || "Something went wrong. Please try again." })
    }

    setIsLoading(false)
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." })
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." })
      setIsLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage({ type: "error", text: error.message })
    } else {
      setMessage({ type: "success", text: "Password updated successfully! Redirecting to sign in..." })
      // Sign out so they can log in fresh with new password
      await supabase.auth.signOut()
      setTimeout(() => router.push("/signin"), 2000)
    }

    setIsLoading(false)
  }

  if (mode === "loading") {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container flex items-center justify-center">
          <Card className="mx-auto w-full max-w-md">
            {mode === "request" ? (
              <>
                <CardHeader>
                  <CardTitle>Reset Password</CardTitle>
                  <CardDescription>
                    Enter your email address and we&apos;ll send you a link to reset your password.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleRequestReset}>
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
                    {message && (
                      <Alert variant={message.type === "error" ? "destructive" : "default"}>
                        <AlertDescription>{message.text}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-col space-y-4">
                    <Button type="submit" className="w-full text-white" disabled={isLoading}>
                      {isLoading ? "Sending..." : "Send Reset Link"}
                    </Button>
                    <div className="text-center text-sm">
                      Remember your password?{" "}
                      <Link href="/signin" className="text-primary underline">
                        Sign in
                      </Link>
                    </div>
                  </CardFooter>
                </form>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>Set New Password</CardTitle>
                  <CardDescription>Enter your new password below.</CardDescription>
                </CardHeader>
                <form onSubmit={handleUpdatePassword}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">New Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                      />
                      <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                      />
                    </div>
                    {message && (
                      <Alert variant={message.type === "error" ? "destructive" : "default"}>
                        <AlertDescription>{message.text}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full text-white" disabled={isLoading}>
                      {isLoading ? "Updating..." : "Update Password"}
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
