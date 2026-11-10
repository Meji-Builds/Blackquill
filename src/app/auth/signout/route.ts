import { createClient } from "@/lib/supabase/server";

// Redirects use a relative Location so they stay on the host the visitor used. Building an absolute URL from
// request.url can point at the server's bind address (e.g. 0.0.0.0) instead.
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return new Response(null, { status: 303, headers: { Location: "/" } });
}
