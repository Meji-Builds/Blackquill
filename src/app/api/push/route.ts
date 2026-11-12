import { NextResponse } from "next/server";
import { pushConfigured, sendPendingPushes } from "@/lib/notifications/push";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Called by the database (pg_net) whenever notifications are added. It takes no input and only sends what is
// already waiting, so anyone calling it can at most make alerts arrive a moment sooner.
async function run() {
  if (!pushConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false, reason: "not configured" });
  try {
    return NextResponse.json({ ok: true, ...(await sendPendingPushes()) });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: (e as Error).message }, { status: 500 });
  }
}

export const POST = run;
export const GET = run;
