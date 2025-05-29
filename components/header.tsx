"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"
import { MobileMenu } from "./mobile-menu"
import { useAuth } from "./auth-provider"

export function Header() {
  const { user, isLoading, signOut } = useAuth()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const handleDropdownChange = (dropdownName: string, isOpen: boolean) => {
    setOpenDropdown(isOpen ? dropdownName : null)
  }

  const closeAllDropdowns = () => {
    setOpenDropdown(null)
  }

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

                <DropdownMenu
                  open={openDropdown === "reservations"}
                  onOpenChange={(isOpen) => handleDropdownChange("reservations", isOpen)}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="text-sm text-lbgt-medium hover:text-lbgt-dark hover:bg-lbgt-light transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 h-auto p-2"
                      aria-label="Reservations menu"
                    >
                      <span>Reservations</span>
                      <ChevronDown className="h-3 w-3 ml-1" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="w-full" onClick={closeAllDropdowns}>
                        Reserve Tee Time
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/reservations" className="w-full" onClick={closeAllDropdowns}>
                        My Reservations
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu
                  open={openDropdown === "scores"}
                  onOpenChange={(isOpen) => handleDropdownChange("scores", isOpen)}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="text-sm text-lbgt-medium hover:text-lbgt-dark hover:bg-lbgt-light transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 h-auto p-2"
                      aria-label="Scores menu"
                    >
                      <span>Scores</span>
                      <ChevronDown className="h-3 w-3 ml-1" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem asChild>
                      <Link href="/scores/submit" className="w-full" onClick={closeAllDropdowns}>
                        Submit Scorecard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/scores/my-rounds" className="w-full" onClick={closeAllDropdowns}>
                        My Scores
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Link
                  href="/scores/league-rounds"
                  className="text-sm text-lbgt-medium hover:text-lbgt-dark transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 rounded-sm px-2 py-1"
                  aria-label="View tour leaderboard"
                >
                  Tour Leaderboard
                </Link>

                <DropdownMenu
                  open={openDropdown === "profile"}
                  onOpenChange={(isOpen) => handleDropdownChange("profile", isOpen)}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="text-sm text-lbgt-medium hover:text-lbgt-dark hover:bg-lbgt-light transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 h-auto p-2"
                      aria-label="Profile menu"
                    >
                      <span>Profile</span>
                      <ChevronDown className="h-3 w-3 ml-1" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="w-full" onClick={closeAllDropdowns}>
                        My Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        signOut()
                        closeAllDropdowns()
                      }}
                    >
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Link
                  href="/admin"
                  className="text-sm text-lbgt-medium hover:text-lbgt-dark transition-colors duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-lbgt-green focus:ring-offset-2 rounded-sm px-2 py-1"
                  aria-label="Admin panel"
                >
                  Admin
                </Link>
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
