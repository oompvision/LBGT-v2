"use client"

import type React from "react"
import { useState } from "react"
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
import { createUserInDatabase } from "../actions/auth"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleSignIn = async (e: React.FormEvent) => {
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

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        console.error("Auth error:", error)
        if (error.message.includes("Invalid login credentials")) {
          setErrorMessage("Invalid email or password. Please check your credentials and try again.")
        } else {
          setErrorMessage(`Error: ${error.message}`)
        }
        setIsLoading(false)
        return
      }

      // Ensure user exists in database
      if (data.user) {
        try {
          await createUserInDatabase(data.user.id, data.user.email || "", data.user.user_metadata.name || "Golfer")
        } catch (dbError) {
          console.error("Database error:", dbError)
          // Continue anyway
        }
      }

      // Show redirecting state and navigate
      setIsRedirecting(true)
      setIsLoading(false)

      // Use Next.js router for faster navigation
      router.push("/")
    } catch (error) {
      console.error("Unexpected sign in error:", error)
      setErrorMessage("An unexpected error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  // Show redirecting state
  if (isRedirecting) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-lg text-muted-foreground">Signing you in...</p>
          </div>
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
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>Enter your email and password to access your account</CardDescription>
            </CardHeader>
            <form onSubmit={handleSignIn}>
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
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>

                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full text-white" disabled={isLoading || isRedirecting}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>

                <div className="text-center text-sm">
                  Don&apos;t have an account?{" "}
                  <Link href="/signup" className="text-primary underline">
                    Sign up
                  </Link>
                </div>
                <div className="text-center text-sm">
                  <Link href="/mobile-signin" className="text-muted-foreground underline">
                    Mobile Sign In
                  </Link>
                </div>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
