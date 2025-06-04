import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res })

  // Check if the user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If the user is not authenticated and trying to access a protected route, redirect to signin
  if (!session && !request.nextUrl.pathname.startsWith("/signin") && !request.nextUrl.pathname.startsWith("/signup")) {
    // Public routes that don't require authentication
    const publicRoutes = ["/", "/apply", "/mobile-signin"]
    if (!publicRoutes.includes(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/signin", request.url))
    }
  }

  // If the user is trying to access admin routes, check if they are an admin
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/signin", request.url))
    }

    try {
      // Check if the user is an admin
      const { data: userData, error } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", session.user.id)
        .single()

      if (error || !userData?.is_admin) {
        // If there's an error or the user is not an admin, redirect to home
        return NextResponse.redirect(new URL("/", request.url))
      }
    } catch (error) {
      console.error("Error checking admin status:", error)
      // If there's an error, redirect to home for safety
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|images|videos|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.mp4$).*)",
  ],
}
