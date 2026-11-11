// Supabase auth errors, rewritten for people. Unknown errors fall back to the original text.

export type AuthProblem = { text: string; action?: "signin" | "signup" | "forgot" | "resend" };

export function friendlyAuthError(message: string): AuthProblem {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return { text: "That email and password don't match. Check them, or reset your password.", action: "forgot" };
  if (m.includes("email not confirmed"))
    return { text: "Confirm your email first. Open the link we sent you, or get a new one.", action: "resend" };
  if (m.includes("already registered") || m.includes("already been registered"))
    return { text: "An account with this email already exists.", action: "signin" };
  if (m.includes("rate limit") || m.includes("security purposes") || m.includes("too many"))
    return { text: "Too many attempts. Wait a minute, then try again." };
  if (m.includes("password") && (m.includes("at least") || m.includes("short") || m.includes("weak")))
    return { text: "Choose a longer password: at least 8 characters." };
  if (m.includes("same") && m.includes("password"))
    return { text: "Your new password must be different from the old one." };
  if (m.includes("invalid") && m.includes("email")) return { text: "That email address doesn't look right." };
  if (m.includes("fetch") || m.includes("network")) return { text: "Couldn't reach the server. Check your connection and try again." };
  return { text: message };
}
