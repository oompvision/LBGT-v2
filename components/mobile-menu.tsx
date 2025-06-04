"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { useAuth } from "./auth-provider"

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, signOut } = useAuth()

  // Check if user is admin
  const isAdmin = user?.user_metadata?.is_admin === true

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div>
      <button
        onClick={toggleMenu}
        className="text-lbgt-dark hover:text-lbgt-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 p-2"
        aria-expanded={isOpen}
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="absolute top-16 left-0 right-0 z-50 bg-lbgt-lightest shadow-lg border-t border-lbgt-light">
          <div className="px-4 py-2 space-y-1">
            {user ? (
              <>
                <Link
                  href="/"
                  className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                  onClick={() => setIsOpen(false)}
                >
                  Home
                </Link>
                <div className="py-1 border-t border-lbgt-light"></div>
                <Link
                  href="/dashboard"
                  className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                  onClick={() => setIsOpen(false)}
                >
                  Reserve Tee Time
                </Link>
                <Link
                  href="/reservations"
                  className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                  onClick={() => setIsOpen(false)}
                >
                  My Reservations
                </Link>
                <Link
                  href="/schedule"
                  className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                  onClick={() => setIsOpen(false)}
                >
                  Schedule
                </Link>
                <div className="py-1 border-t border-lbgt-light"></div>
                <Link
                  href="/scores/submit"
                  className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                  onClick={() => setIsOpen(false)}
                >
                  Submit Scorecard
                </Link>
                <Link
                  href="/scores/my-rounds"
                  className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                  onClick={() => setIsOpen(false)}
                >
                  My Scores
                </Link>
                <Link
                  href="/scores/league-rounds"
                  className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                  onClick={() => setIsOpen(false)}
                >
                  Tour Leaderboard
                </Link>
                <div className="py-1 border-t border-lbgt-light"></div>
                <Link
                  href="/profile"
                  className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                  onClick={() => setIsOpen(false)}
                >
                  My Profile
                </Link>

                {/* Admin links - Only shown to admin users */}
                {isAdmin && (
                  <>
                    <div className="py-1 border-t border-lbgt-light"></div>
                    <Link
                      href="/admin"
                      className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                      onClick={() => setIsOpen(false)}
                    >
                      Admin Dashboard
                    </Link>
                    <Link
                      href="/admin/users"
                      className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                      onClick={() => setIsOpen(false)}
                    >
                      Users
                    </Link>
                    <Link
                      href="/admin/applications"
                      className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                      onClick={() => setIsOpen(false)}
                    >
                      Applications
                    </Link>
                    <Link
                      href="/admin/messages"
                      className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                      onClick={() => setIsOpen(false)}
                    >
                      Messages
                    </Link>
                    <Link
                      href="/admin/reservations"
                      className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                      onClick={() => setIsOpen(false)}
                    >
                      Reservations
                    </Link>
                    <Link
                      href="/admin/tee-times"
                      className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                      onClick={() => setIsOpen(false)}
                    >
                      Tee Times
                    </Link>
                  </>
                )}

                <div className="py-1 border-t border-lbgt-light"></div>
                <button
                  className="block w-full text-left py-2 text-lbgt-dark hover:text-lbgt-green"
                  onClick={() => {
                    signOut()
                    setIsOpen(false)
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/"
                  className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                  onClick={() => setIsOpen(false)}
                >
                  Home
                </Link>
                <div className="py-1 border-t border-lbgt-light"></div>
                <Link
                  href="/signin"
                  className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                  onClick={() => setIsOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="block py-2 text-lbgt-dark hover:text-lbgt-green"
                  onClick={() => setIsOpen(false)}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
