import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") ?? "/"

  if (code) {
    // Create the redirect response first so we can set cookies directly on it
    const response = NextResponse.redirect(`${requestUrl.origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.headers.get("cookie")
              ? request.headers.get("cookie")!.split("; ").map((c) => {
                  const [name, ...rest] = c.split("=")
                  return { name, value: rest.join("=") }
                })
              : []
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      },
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return response
    }

    console.error("Error exchanging code for session:", error)
    return NextResponse.redirect(`${requestUrl.origin}/signin?error=confirmation_failed`)
  }

  return NextResponse.redirect(`${requestUrl.origin}${next}`)
}
