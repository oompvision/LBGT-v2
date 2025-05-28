"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { useAuth } from "@/components/auth-provider"

export default function SignUpPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const { user, isLoading: authLoading } = useAuth()

  // Redirect if user is already signed in
  useEffect(() => {
    if (user && !authLoading) {
      // Immediate redirect to home page
      window.location.href = "/"
    }
  }, [user, authLoading])

  // Clear any existing session on page load
  useEffect(() => {
    const clearSession = async () => {
      try {
        // Check if there's an existing session with errors
        const { data, error } = await supabase.auth.getSession()
        if (error || (data.session && data.session.expires_at * 1000 < Date.now())) {
          console.log("Clearing problematic session...")
          await supabase.auth.signOut()
        }
      } catch (err) {
        console.error("Error checking session:", err)
        // Try to sign out anyway
        try {
          await supabase.auth.signOut()
        } catch (signOutErr) {
          console.error("Error signing out:", signOutErr)
        }
      }
    }

    clearSession()
  }, [supabase])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Clear any existing session first to avoid token conflicts
      await supabase.auth.signOut()

      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      })

      if (authError) {
        toast({
          title: "Error signing up",
          description: authError.message,
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      // Use the server action to create the user in the database
      if (authData.user) {
        const result = await createUserInDatabase(authData.user.id, email, name)

        if (!result.success) {
          console.error("Error creating user:", result.error)
          toast({
            title: "Warning",
            description: "Account created but profile setup had an issue. Please contact support if you have problems.",
            variant: "destructive",
          })
        }
      }

      toast({
        title: "Account created!",
        description: "You have successfully signed up.",
      })

      // Sign in the user immediately after signup
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        toast({
          title: "Error signing in",
          description: "Account created but couldn't sign in automatically. Please sign in manually.",
          variant: "destructive",
        })
        router.push("/signin")
        return
      }

      // Double-check that the user was created in the database
      if (authData.user) {
        // Wait a moment for the database to update
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Check if the user exists in the database
        const { data: dbUser, error: dbError } = await supabase
          .from("users")
          .select("id")
          .eq("id", authData.user.id)
          .maybeSingle()

        if (dbError || !dbUser) {
          console.error("User not found in database after signup, trying again:", dbError)
          // Try creating the user again
          await createUserInDatabase(authData.user.id, email, name)
        }
      }

      // Use window.location for a full page navigation
      window.location.href = "/"
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  // If user is already authenticated, show minimal loading UI
  if (user && !authLoading) {
    return null // Return nothing as we're redirecting immediately
  }

  // If still checking authentication status, show minimal loading
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
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
              <CardTitle>Sign Up</CardTitle>
              <CardDescription>Create an account to book tee times</CardDescription>
            </CardHeader>
            <form onSubmit={handleSignUp}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
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
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">Password must be at least 6 characters long</p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full text-white" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Sign Up"}
                </Button>
                <div className="text-center text-sm">
                  Already have an account?{" "}
                  <Link href="/signin" className="text-primary underline">
                    Sign in
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
