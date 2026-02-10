"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { resetAdminUser } from "@/app/actions/admin"

export default function ResetAdminPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleReset = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      const result = await resetAdminUser()

      if (result.success) {
        setMessage({ type: "success", text: result.message || "Admin password reset successfully!" })
      } else {
        setMessage({ type: "error", text: result.error || "Failed to reset password" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "An unexpected error occurred" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Admin Password</CardTitle>
          <CardDescription>Reset the admin account password to the configured default</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleReset} disabled={isLoading} className="w-full">
            {isLoading ? "Resetting..." : "Reset Admin Password"}
          </Button>

          {message && (
            <div
              className={`p-4 rounded-md ${
                message.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
