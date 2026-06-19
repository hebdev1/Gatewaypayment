import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { LOCALES } from "@/lib/i18n";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const formData = await request.formData().catch(() => null);
  const fromForm = formData?.get("locale");
  const fromQuery = url.searchParams.get("locale");
  const locale = String(fromForm ?? fromQuery ?? "");

  if (!(LOCALES as string[]).includes(locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set("hp_locale", locale, {
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/"
  });

  const next = url.searchParams.get("next") ?? "/";
  return NextResponse.redirect(new URL(next, request.url));
}
