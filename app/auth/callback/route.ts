import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription)}`, request.url)
    );
  }

  const supabase = await createClient();

  // PKCE flow (password reset, magic link, OAuth)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
      );
    }

    return NextResponse.redirect(new URL(next, request.url));
  }

  // Legacy OTP flow (email confirmation via token_hash)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "magiclink" | "recovery" | "invite" | "email_change",
      token_hash: tokenHash
    });

    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
      );
    }

    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(
    new URL("/login?error=Invalid%20or%20expired%20link.", request.url)
  );
}
