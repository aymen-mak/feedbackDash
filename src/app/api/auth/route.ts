import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const AUTH_SECRET = process.env.AUTH_SECRET || "makina-pulse-default-secret-key";
const GATE_PASSWORD = process.env.GATE_PASSWORD || "makina2026!)";
const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function generateToken(): string {
  const timestamp = Date.now().toString();
  const sig = createHmac("sha256", AUTH_SECRET).update(timestamp).digest("hex");
  return `${timestamp}.${sig}`;
}

function verifyToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [timestamp, sig] = parts;
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Date.now() - ts > TOKEN_MAX_AGE) return false;
  const expected = createHmac("sha256", AUTH_SECRET).update(timestamp).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, token } = body as { password?: string; token?: string };

    // Token verification
    if (token) {
      return NextResponse.json({ valid: verifyToken(token) });
    }

    // Password verification
    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const pwBuf = Buffer.from(password);
    const expectedBuf = Buffer.from(GATE_PASSWORD);
    const valid = pwBuf.length === expectedBuf.length && timingSafeEqual(pwBuf, expectedBuf);

    if (valid) {
      return NextResponse.json({ success: true, token: generateToken() });
    }
    return NextResponse.json({ success: false }, { status: 401 });
  } catch (err) {
    console.error("POST /api/auth error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
