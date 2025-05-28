"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { fixDevinAccount } from "@/app/actions/fix-devin"
import { useToast } from "@/components/ui/use-toast"

export default function FixDevinPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const { toast } = useToast()

  const handleFixAccount = async () => {
    setIsLoading(true)
    try {
      const result = await fixDevinAccount()
      setResult(result)

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fixing account:", error)
      setResult({ success: false, error: String(error) })
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container py-8">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Fix Devin's Account</CardTitle>
          <CardDescription>This will fix Devin Weinshank's account issues</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">This tool will:</p>
          <ul className="list-disc pl-5 space-y-1 mb-4">
            <li>Check if Devin exists in auth.users</li>
            <li>Ensure Devin exists in public.users with the correct ID</li>
            <li>Reset Devin's password if needed</li>
          </ul>

          {result && (
            <div className={`p-4 rounded-md mt-4 ${result.success ? "bg-green-100" : "bg-red-100"}`}>
              <p className="font-medium">{result.success ? "Success" : "Error"}</p>
              <p>{result.message || result.error}</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleFixAccount} disabled={isLoading} className="w-full">
            {isLoading ? "Fixing..." : "Fix Devin's Account"}
          </Button>
        </CardFooter>
      </Card>

      <Card className="mx-auto max-w-md mt-8">
        <CardHeader>
          <CardTitle>Mobile Sign In Link</CardTitle>
          <CardDescription>Special mobile sign-in page for Devin</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">Share this special mobile sign-in link with Devin:</p>
          <div className="p-4 bg-gray-100 rounded-md break-all">https://your-site.com/mobile-signin</div>
        </CardContent>
      </Card>
    </div>
  )
}
