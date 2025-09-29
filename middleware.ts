import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Explicitly pass the environment variables
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If there's no session and the user is trying to access a protected route
  const protectedRoutes = ["/dashboard", "/challenge", "/profile"]
  const isProtectedRoute = protectedRoutes.some((route) => req.nextUrl.pathname.startsWith(route))

  if (!session && isProtectedRoute) {
    const redirectUrl = new URL("/login", req.url)
    return NextResponse.redirect(redirectUrl)
  }

  // If there's a session and the user is trying to access auth routes
  const authRoutes = ["/login", "/register"]
  const isAuthRoute = authRoutes.some((route) => req.nextUrl.pathname === route)

  if (session && isAuthRoute) {
    const redirectUrl = new URL("/dashboard", req.url) 
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: ["/dashboard/:path*", "/challenge/:path*", "/profile/:path*", "/login", "/register"],
}
