"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { createUserInDatabase } from "../actions/auth"

export default function MobileSignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (data.session && !error) {
          setIsAuthenticated(true)
          // Redirect to home
          window.location.href = "/"
        }
      } catch (err) {
        console.error("Error checking auth:", err)
      }
    }

    checkAuth()
  }, [supabase])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    try {
      // First clear any existing sessions
      try {
        await supabase.auth.signOut()
        console.log("Signed out any existing sessions")

        // Clear localStorage manually as well
        localStorage.clear()
        console.log("Cleared localStorage")

        // Wait a moment for signout to complete
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (signOutErr) {
        console.error("Error during pre-signin cleanup:", signOutErr)
        // Continue anyway
      }

      console.log("Attempting mobile sign in for:", email)

      // Use a different auth method for mobile
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("Mobile auth error:", error)
        setErrorMessage(`Error: ${error.message}`)
        toast({
          title: "Sign In Failed",
          description: error.message,
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      console.log("Mobile sign in successful, user:", data.user?.id)

      // Ensure user exists in database
      if (data.user) {
        try {
          await createUserInDatabase(data.user.id, data.user.email || "", data.user.user_metadata.name || "Golfer")
          console.log("User created/updated in database")
        } catch (dbError) {
          console.error("Database error:", dbError)
          // Continue anyway
        }
      }

      // Set authenticated state
      setIsAuthenticated(true)

      toast({
        title: "Success!",
        description: "You have been signed in.",
      })

      // Use a longer delay for mobile
      setTimeout(() => {
        // Use a different approach for redirection on mobile
        window.location.replace("/")
      }, 1500)
    } catch (error) {
      console.error("Unexpected mobile sign in error:", error)
      setErrorMessage("An unexpected error occurred. Please try again.")
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  // If already authenticated, show loading
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container flex flex-col items-center justify-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p>Redirecting you to the home page...</p>
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
              <CardTitle>Mobile Sign In</CardTitle>
              <CardDescription>Use this special page for mobile sign in</CardDescription>
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
                {errorMessage && <div className="text-sm text-red-500 mt-2">{errorMessage}</div>}
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full text-white" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
                <div className="text-center text-sm">
                  Don&apos;t have an account?{" "}
                  <Link href="/signup" className="text-primary underline">
                    Sign up
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
