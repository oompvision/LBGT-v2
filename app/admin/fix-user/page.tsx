"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { addMikeSkudin, addUserManually } from "@/app/actions/fix-user"

export default function FixUserPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("Mike Skudin")
  const [email, setEmail] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  const handleFixMike = async () => {
    setIsLoading(true)
    try {
      const result = await addMikeSkudin()

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
        router.push("/admin/users")
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await addUserManually({ name, email })

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
        router.push("/admin/users")
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Fix User Issue</h1>
            <p className="text-muted-foreground">Resolve issues with missing users</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fix Mike Skudin</CardTitle>
                <CardDescription>Automatically find and add Mike Skudin to the database</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  This will search for Mike Skudin in the authentication system and add him to the users table if found.
                </p>
              </CardContent>
              <CardFooter>
                <Button onClick={handleFixMike} disabled={isLoading} className="w-full">
                  {isLoading ? "Processing..." : "Fix Mike Skudin"}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add User Manually</CardTitle>
                <CardDescription>Manually add a user to the database</CardDescription>
              </CardHeader>
              <form onSubmit={handleAddUser}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Enter the user's email address"
                    />
                    <p className="text-xs text-muted-foreground">The email must match the one used during signup</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? "Processing..." : "Add User"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
