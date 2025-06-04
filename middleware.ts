import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function middleware(req: NextRequest) {
  // Clone the request to avoid modifying the original
  const res = NextResponse.next()

  try {
    // Check if the request is for an admin route
    const isAdminRoute = req.nextUrl.pathname.startsWith("/admin")

    if (isAdminRoute) {
      // Create a Supabase client
      const supabase = createClient()

      // Get the user's session
      const {
        data: { session },
      } = await supabase.auth.getSession()

      // If no session or user is not an admin, redirect to home page
      if (!session || session.user.user_metadata?.is_admin !== true) {
        return NextResponse.redirect(new URL("/", req.url))
      }
    }

    // Handle auth cookies cleanup if there are JWT errors
    const authCookie = req.cookies.get("sb-supabase-auth-token")

    if (authCookie) {
      try {
        // Basic JWT validation - check if it's expired
        const payload = JSON.parse(atob(authCookie.value.split(".")[1]))
        const now = Math.floor(Date.now() / 1000)

        if (payload.exp && payload.exp < now) {
          // Token is expired, clear it
          res.cookies.delete("sb-supabase-auth-token")
        }
      } catch (e) {
        // Invalid token format, clear it
        res.cookies.delete("sb-supabase-auth-token")
      }
    }
  } catch (error) {
    console.error("Middleware error:", error)

    // If there's an error in admin route check, redirect to home as a fallback
    if (req.nextUrl.pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public|api/auth).*)"],
}
