import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Sign-out is a route handler rather than a server action on purpose.
 *
 * As an action it silently failed: the middleware runs `getUser()` first and
 * queues a refreshed auth cookie onto the response, which then overwrote the
 * cleared one and resurrected the session. The user appeared to stay logged in.
 * Here the redirect response is ours, so clearing the cookies is the last word.
 *
 * It is also a plain form POST, so it still works if client JavaScript does not.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(
    new URL("/entrar", request.nextUrl.origin),
    { status: 303 },
  );

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }

  revalidatePath("/", "layout");
  return response;
}
