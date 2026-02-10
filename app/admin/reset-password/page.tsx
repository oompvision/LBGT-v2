"use client"

import type React from "react"

import { useState } from "react"
import { sendPasswordResetEmail, checkUserExists } from "@/app/actions/reset-password"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle } from "lucide-react"
import { AdminTabs } from "@/app/admin/admin-tabs"

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("")
  const [isChecking, setIsChecking] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleCheckUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsChecking(true)
    setMessage(null)
    setUserInfo(null)

    try {
      const result = await checkUserExists(email)

      if (result.success && result.exists) {
        setUserInfo({
          user: result.user,
          authUser: result.authUser,
        })
      } else if (result.success) {
        setMessage({
          type: "error",
          text: `User with email ${email} not found in one or both systems.`,
        })
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to check user",
        })
      }
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "An unexpected error occurred",
      })
    } finally {
      setIsChecking(false)
    }
  }

  const handleSendReset = async () => {
    if (!email) return

    setIsSending(true)
    setMessage(null)

    try {
      const result = await sendPasswordResetEmail(email)

      if (result.success) {
        setMessage({
          type: "success",
          text: result.message || "Password reset email sent successfully",
        })
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to send password reset email",
        })
      }
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "An unexpected error occurred",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Reset a user's password</p>
      </div>

      <AdminTabs />

      <Card className="max-w-md mt-6">
        <CardHeader>
          <CardTitle>Password Reset Tool</CardTitle>
          <CardDescription>
            Help users who are having trouble logging in by sending them a password reset email.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleCheckUser} className="flex space-x-2">
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" disabled={isChecking}>
              {isChecking ? "Checking..." : "Check User"}
            </Button>
          </form>

          {userInfo && (
            <div className="border rounded-md p-4 bg-muted/50">
              <h3 className="font-medium mb-2">User Found:</h3>
              <p>
                <strong>Name:</strong> {userInfo.user?.name}
              </p>
              <p>
                <strong>Email:</strong> {userInfo.user?.email}
              </p>
              <p>
                <strong>Created:</strong> {new Date(userInfo.user?.created_at).toLocaleDateString()}
              </p>
              <p>
                <strong>Auth Status:</strong> {userInfo.authUser ? "Active in auth system" : "Missing from auth"}
              </p>
            </div>
          )}

          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              {message.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              <AlertTitle>{message.type === "error" ? "Error" : "Success"}</AlertTitle>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter>
          <Button onClick={handleSendReset} disabled={isSending || !email || !userInfo} className="w-full">
            {isSending ? "Sending..." : "Send Password Reset Email"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
