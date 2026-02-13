import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()

  // Skip auth for webhook endpoints
  if (request.nextUrl.pathname.startsWith("/api/webhooks/")) {
    return res
  }

  const publicRoutes = ["/", "/apply", "/mobile-signin", "/signin", "/signup", "/reset-password"]
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname)
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin")

  // Skip auth check for public routes that don't need it
  if (isPublicRoute && !isAdminRoute) {
    return res
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If the user is not authenticated and trying to access a protected route, redirect to signin
  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL("/signin", request.url))
  }

  // If the user is trying to access admin routes, check if they are an admin
  if (isAdminRoute) {
    if (!session) {
      return NextResponse.redirect(new URL("/signin", request.url))
    }

    try {
      const { data: userData, error } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", session.user.id)
        .single()

      if (error || !userData?.is_admin) {
        return NextResponse.redirect(new URL("/", request.url))
      }
    } catch (error) {
      console.error("Error checking admin status:", error)
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
