import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// A tapped phone alert: mark it read and go where it points.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const to = request.nextUrl.searchParams.get("to") ?? "/notifications";
  // Only paths on this site.
  const target = /^\/(?![/\\])/.test(to) ? to : "/notifications";
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const supabase = await createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  }
  return NextResponse.redirect(new URL(target, request.nextUrl.origin));
}
