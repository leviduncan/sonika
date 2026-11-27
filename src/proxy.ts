import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16: "Proxy" is the renamed Middleware. This refreshes the
// Supabase session cookie and applies optimistic route protection.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every path except API routes, build output and the app's public
     * images and fonts, so the auth session is refreshed everywhere it might be
     * needed. Each exclusion is anchored to the start of the path: look-alikes
     * such as `/apiary` or `/dashboard/x.png` still go through the proxy, and
     * so does a new public asset until it is listed here.
     */
    "/((?!api/|_next/static/|_next/image$|fonts/|favicon\\.ico$|icon\\.svg$|opengraph-image$|twitter-image$).*)",
  ],
};
