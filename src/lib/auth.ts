import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Returns the signed-in user and a Supabase client, or redirects to /login. */
export async function requireUser(next = "/") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

/** Like requireUser, but only for admins; everyone else gets a 404 so the page's existence isn't revealed. */
export async function requireAdmin(next = "/admin") {
  const { supabase, user } = await requireUser(next);
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!data?.is_admin) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return { supabase, user };
}
