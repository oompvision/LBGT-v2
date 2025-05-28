"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createAdminUser, resetAdminUser } from "../actions/admin"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RefreshCw } from "lucide-react"

export default function AdminSetupPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const router = useRouter()

  const handleCreateAdmin = async () => {
    setIsLoading(true)
    try {
      const result = await createAdminUser()
      setResult(result)
    } catch (error) {
      console.error("Error creating admin:", error)
      setResult({ success: false, error: "Failed to create admin user" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetAdmin = async () => {
    setIsResetting(true)
    try {
      const result = await resetAdminUser()
      setResult(result)
    } catch (error) {
      console.error("Error resetting admin:", error)
      setResult({ success: false, error: "Failed to reset admin user" })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container flex items-center justify-center">
          <Card className="mx-auto w-full max-w-md">
            <CardHeader>
              <CardTitle>Admin Setup</CardTitle>
              <CardDescription>Create or reset the admin user for the golf league booking system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result ? (
                <Alert variant={result.success ? "default" : "destructive"}>
                  <AlertTitle>{result.success ? "Success!" : "Error"}</AlertTitle>
                  <AlertDescription>
                    {result.success ? (
                      <div>
                        <p>{result.message}</p>
                        <div className="mt-2 rounded-md bg-muted p-3">
                          <p>
                            <strong>Email:</strong> {result.credentials.email}
                          </p>
                          <p>
                            <strong>Password:</strong> {result.credentials.password}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p>{result.error}</p>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <p>Use the buttons below to create or reset the admin user with the following credentials:</p>
                  <div className="rounded-md bg-muted p-4">
                    <p>
                      <strong>Email:</strong> anthony@sidelineswap.com
                    </p>
                    <p>
                      <strong>Password:</strong> GolfAdmin123!
                    </p>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button onClick={handleResetAdmin} disabled={isLoading || isResetting} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                {isResetting ? "Resetting..." : "Reset Admin User"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
