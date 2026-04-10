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
import { signUpUser } from "../actions/auth"
import { useAuth } from "@/components/auth-provider"
import { formatPhone, stripPhone } from "@/lib/phone"

export default function SignUpPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const { user, isLoading: authLoading } = useAuth()

  // Redirect if user is already signed in
  useEffect(() => {
    if (user && !authLoading) {
      window.location.href = "/"
    }
  }, [user, authLoading])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Create the user server-side via admin API (auto-confirms email)
      const phoneDigits = stripPhone(phone)
      const result = await signUpUser(email, password, name, phoneDigits.length === 10 ? phoneDigits : undefined)

      if (!result.success) {
        toast({
          title: "Error signing up",
          description: result.error,
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      // User is created and confirmed — sign in immediately
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        toast({
          title: "Account created!",
          description: "Please sign in with your new credentials.",
        })
        router.push("/signin")
        return
      }

      toast({
        title: "Welcome!",
        description: "Your account has been created successfully.",
      })
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

  if (user && !authLoading) {
    return null
  }

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
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123 - 4567"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                  />
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
