import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  // Simplified middleware - just pass through for now
  const res = NextResponse.next()

  try {
    // Only handle auth cookies cleanup if there are JWT errors in headers
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
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public|api/auth).*)"],
}
