import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const text = url.searchParams.get("text") ?? "";
  const download = url.searchParams.get("download");
  const size = Math.min(Math.max(Number(url.searchParams.get("size") ?? 600), 120), 1200);

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const buffer = await QRCode.toBuffer(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: { dark: "#0b1220", light: "#ffffff" }
  });

  const headers: Record<string, string> = {
    "content-type": "image/png",
    "cache-control": "public, max-age=3600"
  };
  if (download) {
    headers["content-disposition"] = `attachment; filename="${download}"`;
  }

  return new Response(new Uint8Array(buffer), { headers });
}
