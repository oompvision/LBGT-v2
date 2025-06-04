"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { MobileMenu } from "./mobile-menu"
import { useAuth } from "./auth-provider"
import { createClient } from "@/lib/supabase/client"

export function Header() {
  const { user, isLoading, signOut } = useAuth()
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Check admin status when user changes
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        try {
          const supabase = createClient()
          const { data: userData } = await supabase.from("users").select("is_admin").eq("id", user.id).single()

          setIsAdmin(userData?.is_admin === true)
        } catch (error) {
          console.error("Error checking admin status:", error)
          setIsAdmin(false)
        }
      } else {
        setIsAdmin(false)
      }
    }

    checkAdminStatus()
  }, [user])

  const toggleDropdown = (name: string) => {
    if (activeDropdown === name) {
      setActiveDropdown(null)
    } else {
      setActiveDropdown(name)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown && dropdownRefs.current[activeDropdown]) {
        const dropdownElement = dropdownRefs.current[activeDropdown]
        if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
          setActiveDropdown(null)
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [activeDropdown])

  return (
    <header className="bg-lbgt-lightest shadow-sm border-b border-lbgt-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center space-x-3"
              onClick={(e) => {
                e.preventDefault()
                window.location.href = "/"
              }}
            >
              <Image
                src="/images/osprey-logo.png"
                alt="LBGT Osprey Logo"
                width={48}
                height={48}
                className="rounded-sm"
              />
              <span className="text-lg font-semibold text-lbgt-dark">The Long Beach Golf Tour</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {user && !isLoading ? (
              <>
                <Link
                  href="/"
                  className="text-sm text-lbgt-medium hover:text-lbgt-dark transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 rounded-sm px-2 py-1"
                  aria-label="Go to homepage"
                >
                  Home
                </Link>

                {/* Custom Dropdown for Reservations */}
                <div className="relative" ref={(el) => (dropdownRefs.current.reservations = el)}>
                  <button
                    className={`text-sm text-lbgt-medium hover:text-lbgt-dark hover:bg-lbgt-light transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 px-3 py-2 rounded-sm flex items-center ${
                      activeDropdown === "reservations" ? "bg-lbgt-light" : ""
                    }`}
                    aria-label="Reservations menu"
                    onClick={() => toggleDropdown("reservations")}
                  >
                    <span>Reservations</span>
                    <ChevronDown className="h-3 w-3 ml-1" aria-hidden="true" />
                  </button>

                  {activeDropdown === "reservations" && (
                    <div className="absolute z-50 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                      <div className="py-1" role="menu" aria-orientation="vertical">
                        <Link
                          href="/dashboard"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setActiveDropdown(null)}
                        >
                          Reserve Tee Time
                        </Link>
                        <Link
                          href="/reservations"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setActiveDropdown(null)}
                        >
                          My Reservations
                        </Link>
                        <Link
                          href="/schedule"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setActiveDropdown(null)}
                        >
                          Schedule
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom Dropdown for Scores */}
                <div className="relative" ref={(el) => (dropdownRefs.current.scores = el)}>
                  <button
                    className={`text-sm text-lbgt-medium hover:text-lbgt-dark hover:bg-lbgt-light transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 px-3 py-2 rounded-sm flex items-center ${
                      activeDropdown === "scores" ? "bg-lbgt-light" : ""
                    }`}
                    aria-label="Scores menu"
                    onClick={() => toggleDropdown("scores")}
                  >
                    <span>Scores</span>
                    <ChevronDown className="h-3 w-3 ml-1" aria-hidden="true" />
                  </button>

                  {activeDropdown === "scores" && (
                    <div className="absolute z-50 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                      <div className="py-1" role="menu" aria-orientation="vertical">
                        <Link
                          href="/scores/submit"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setActiveDropdown(null)}
                        >
                          Submit Scorecard
                        </Link>
                        <Link
                          href="/scores/my-rounds"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setActiveDropdown(null)}
                        >
                          My Scores
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  href="/scores/league-rounds"
                  className="text-sm text-lbgt-medium hover:text-lbgt-dark transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 rounded-sm px-2 py-1"
                  aria-label="View tour leaderboard"
                >
                  Tour Leaderboard
                </Link>

                {/* Custom Dropdown for Profile */}
                <div className="relative" ref={(el) => (dropdownRefs.current.profile = el)}>
                  <button
                    className={`text-sm text-lbgt-medium hover:text-lbgt-dark hover:bg-lbgt-light transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 px-3 py-2 rounded-sm flex items-center ${
                      activeDropdown === "profile" ? "bg-lbgt-light" : ""
                    }`}
                    aria-label="Profile menu"
                    onClick={() => toggleDropdown("profile")}
                  >
                    <span>Profile</span>
                    <ChevronDown className="h-3 w-3 ml-1" aria-hidden="true" />
                  </button>

                  {activeDropdown === "profile" && (
                    <div className="absolute z-50 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                      <div className="py-1" role="menu" aria-orientation="vertical">
                        <Link
                          href="/profile"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setActiveDropdown(null)}
                        >
                          My Profile
                        </Link>
                        <button
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => {
                            signOut()
                            setActiveDropdown(null)
                          }}
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Admin Dropdown - Only shown to admin users */}
                {isAdmin && (
                  <div className="relative" ref={(el) => (dropdownRefs.current.admin = el)}>
                    <div className="flex items-center">
                      <Link
                        href="/admin"
                        className="text-sm text-lbgt-medium hover:text-lbgt-dark transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 rounded-sm px-2 py-1"
                        aria-label="Admin dashboard"
                      >
                        Admin
                      </Link>
                      <button
                        className={`text-sm text-lbgt-medium hover:text-lbgt-dark hover:bg-lbgt-light transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 px-1 py-2 rounded-sm flex items-center ${
                          activeDropdown === "admin" ? "bg-lbgt-light" : ""
                        }`}
                        aria-label="Admin menu"
                        onClick={() => toggleDropdown("admin")}
                      >
                        <ChevronDown className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>

                    {activeDropdown === "admin" && (
                      <div className="absolute z-50 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 right-0">
                        <div className="py-1" role="menu" aria-orientation="vertical">
                          <Link
                            href="/admin/dashboard"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setActiveDropdown(null)}
                          >
                            Dashboard
                          </Link>
                          <Link
                            href="/admin/users"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setActiveDropdown(null)}
                          >
                            Users
                          </Link>
                          <Link
                            href="/admin/applications"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setActiveDropdown(null)}
                          >
                            Applications
                          </Link>
                          <Link
                            href="/admin/messages"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setActiveDropdown(null)}
                          >
                            Messages
                          </Link>
                          <Link
                            href="/admin/reservations"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setActiveDropdown(null)}
                          >
                            Reservations
                          </Link>
                          <Link
                            href="/admin/tee-times"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setActiveDropdown(null)}
                          >
                            Tee Times
                          </Link>
                          <Link
                            href="/admin/manual-tee-times"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setActiveDropdown(null)}
                          >
                            Manual Tee Times
                          </Link>
                          <Link
                            href="/admin/generate-tee-times"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setActiveDropdown(null)}
                          >
                            Generate Tee Times
                          </Link>
                          <Link
                            href="/admin/reset-password"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setActiveDropdown(null)}
                          >
                            Reset Password
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link href="/signin">
                  <Button
                    variant="ghost"
                    className="text-sm text-lbgt-medium hover:text-lbgt-dark transition-colors duration-200 font-medium"
                    aria-label="Sign in to your account"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button
                    className="text-sm bg-lbgt-green hover:bg-lbgt-green-dark text-white transition-colors duration-200"
                    aria-label="Create new account"
                  >
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <MobileMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
