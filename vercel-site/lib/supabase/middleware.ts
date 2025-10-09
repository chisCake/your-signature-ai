import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getUser, isMod, isAdmin } from "@/lib/auth-server-utils";

const GUEST_ROUTES = [
  "/login",
  "/auth",
  "/about",
  "/api/forgery",
]

const USER_ROUTES = [
  "/dashboard",
]

const MOD_ROUTES = [
  "/dashboard-mod",
  "/controlled-signature-addition",
  "/users",
  "/signatures",
  "/api/signatures",
  "/api/pseudousers",
]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.

  if (GUEST_ROUTES.some(route => request.nextUrl.pathname.startsWith(route))) {
    return supabaseResponse;
  }

  const user = await getUser();
  // console.log("user (middleware):", user);

  if (await isAdmin(user)) {
    return supabaseResponse;
  }

  if (
    request.nextUrl.pathname !== "/" &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  if (USER_ROUTES.some(route => request.nextUrl.pathname.startsWith(route))) {
    if (!user) {
      return new NextResponse(null, { status: 403 });
    }
  }

  // console.log("MOD_ROUTES", request.nextUrl.pathname);
  // console.log("MOD_ROUTES", MOD_ROUTES.some(route => request.nextUrl.pathname.startsWith(route)));
  if (MOD_ROUTES.some(route => request.nextUrl.pathname.startsWith(route))) {
    if (!await isMod(user)) {
      return new NextResponse(null, { status: 403 });
    }
  }

  // if (ADMIN_ROUTES.some(route => request.nextUrl.pathname.startsWith(route))) {
  //   if (!await isAdmin(user)) {
  //     return new NextResponse(null, { status: 403 });
  //   }
  // }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
