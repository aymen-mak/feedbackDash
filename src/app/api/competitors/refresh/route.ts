import { NextRequest, NextResponse } from "next/server";
import { refreshAll } from "@/lib/competitors/service";

export const dynamic = "force-dynamic";
// Collectors hit several external endpoints; give the function room to run.
export const maxDuration = 60;

async function run() {
  const { results, onchain } = await refreshAll();
  const socialOk = results.filter((r) => r.ok).length;
  const onchainOk = onchain.filter((o) => o.ok).length;
  return {
    at: new Date().toISOString(),
    social: { ran: results.length, ok: socialOk, failed: results.length - socialOk },
    onchain: { ran: onchain.length, ok: onchainOk, failed: onchain.length - onchainOk },
    results,
    onchainResults: onchain,
  };
}

// In-app "Refresh now" button.
export async function POST() {
  try {
    return NextResponse.json(await run());
  } catch (err) {
    console.error("POST /api/competitors/refresh error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Cron entrypoint (see vercel.json). Protected by CRON_SECRET when set —
// Vercel sends it as `Authorization: Bearer <CRON_SECRET>`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await run());
  } catch (err) {
    console.error("GET /api/competitors/refresh error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
