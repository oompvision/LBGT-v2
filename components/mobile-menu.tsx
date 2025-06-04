"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { useAuth } from "./auth-provider"

export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const { user, isAdmin, signOut } = useAuth()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-6 w-6 text-lbgt-dark" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 bg-white">
        <div className="flex flex-col space-y-4 mt-8">
          {user ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="text-lbgt-dark hover:text-lbgt-medium focus:text-lbgt-medium transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-medium focus:ring-offset-2 rounded-sm px-2 py-1"
                aria-label="Go to dashboard"
              >
                Dashboard
              </Link>
              <Link
                href="/scores/submit"
                onClick={() => setOpen(false)}
                className="text-lbgt-dark hover:text-lbgt-medium focus:text-lbgt-medium transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-medium focus:ring-offset-2 rounded-sm px-2 py-1"
                aria-label="Submit your score"
              >
                Submit Score
              </Link>
              <Link
                href="/scores/my-rounds"
                onClick={() => setOpen(false)}
                className="text-lbgt-dark hover:text-lbgt-medium focus:text-lbgt-medium transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-medium focus:ring-offset-2 rounded-sm px-2 py-1"
                aria-label="View your rounds"
              >
                My Rounds
              </Link>
              <Link
                href="/scores/league-rounds"
                onClick={() => setOpen(false)}
                className="text-lbgt-dark hover:text-lbgt-medium focus:text-lbgt-medium transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-medium focus:ring-offset-2 rounded-sm px-2 py-1"
                aria-label="View tour leaderboard"
              >
                Tour Leaderboard
              </Link>
              <Link
                href="/reservations"
                onClick={() => setOpen(false)}
                className="text-lbgt-dark hover:text-lbgt-medium focus:text-lbgt-medium transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-medium focus:ring-offset-2 rounded-sm px-2 py-1"
                aria-label="View reservations"
              >
                Reservations
              </Link>
              <Link
                href="/schedule"
                onClick={() => setOpen(false)}
                className="text-lbgt-dark hover:text-lbgt-medium focus:text-lbgt-medium transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-medium focus:ring-offset-2 rounded-sm px-2 py-1"
                aria-label="View schedule"
              >
                Schedule
              </Link>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="text-lbgt-dark hover:text-lbgt-medium focus:text-lbgt-medium transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-medium focus:ring-offset-2 rounded-sm px-2 py-1"
                aria-label="View profile"
              >
                Profile
              </Link>

              {/* Only show admin link to admin users */}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="text-lbgt-dark hover:text-lbgt-medium focus:text-lbgt-medium transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-medium focus:ring-offset-2 rounded-sm px-2 py-1"
                  aria-label="Admin panel"
                >
                  Admin
                </Link>
              )}

              <Button
                onClick={() => {
                  signOut()
                  setOpen(false)
                }}
                className="bg-lbgt-dark hover:bg-lbgt-medium text-white transition-colors duration-200 w-full mt-4"
                aria-label="Sign out of your account"
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/signin" onClick={() => setOpen(false)}>
                <Button
                  variant="ghost"
                  className="w-full text-lbgt-dark hover:text-lbgt-medium focus:text-lbgt-medium transition-colors duration-200 font-medium"
                  aria-label="Sign in to your account"
                >
                  Sign In
                </Button>
              </Link>
              <Link href="/signup" onClick={() => setOpen(false)}>
                <Button
                  className="w-full bg-lbgt-dark hover:bg-lbgt-medium text-white transition-colors duration-200"
                  aria-label="Create new account"
                >
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
