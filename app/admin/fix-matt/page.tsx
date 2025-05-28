"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { resetMattPassword, checkMattAccount } from "@/app/actions/fix-matt"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

export default function FixMattPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [accountInfo, setAccountInfo] = useState<any>(null)
  const { toast } = useToast()

  const handleResetPassword = async () => {
    setIsLoading(true)
    try {
      const result = await resetMattPassword()

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to reset password",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckAccount = async () => {
    setIsChecking(true)
    try {
      const result = await checkMattAccount()
      setAccountInfo(result)

      if (result.success) {
        toast({
          title: "Success",
          description: "Account information retrieved successfully",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to check account",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Fix Matt Gervasi&apos;s Account</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Status Check</CardTitle>
            <CardDescription>
              Check the status of Matt Gervasi&apos;s account in both the auth system and database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleCheckAccount} disabled={isChecking}>
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Check Account Status"
              )}
            </Button>

            {accountInfo && (
              <div className="mt-4 space-y-4">
                <div className="rounded-md bg-muted p-4">
                  <div className="flex items-center">
                    {accountInfo.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                    )}
                    <p className="font-medium">
                      {accountInfo.success ? "Account exists in both systems" : "Account issue detected"}
                    </p>
                  </div>
                  {accountInfo.error && <p className="text-sm text-red-500 mt-2">{accountInfo.error}</p>}
                </div>

                {accountInfo.dbUser && (
                  <div>
                    <h3 className="font-medium mb-2">Database User:</h3>
                    <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(accountInfo.dbUser, null, 2)}
                    </pre>
                  </div>
                )}

                {accountInfo.authUser && (
                  <div>
                    <h3 className="font-medium mb-2">Auth User:</h3>
                    <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(accountInfo.authUser, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Send a password reset email to Matt Gervasi (mattgervasi@gmail.com)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This will send a password reset email to mattgervasi@gmail.com. The user will need to click the link in
              the email to set a new password.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleResetPassword} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Reset Email...
                </>
              ) : (
                "Send Password Reset Email"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
