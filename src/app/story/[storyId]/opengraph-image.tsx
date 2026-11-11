import { ImageResponse } from "next/og";
import { ogFonts, publicClient } from "@/lib/seo/site";

export const alt = "Story on Obsidian Quill";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SCHEMES = [
  ["#3b1f5e", "#c9a8ff"],
  ["#5a1d24", "#f2b58c"],
  ["#173a3a", "#9fe3cf"],
  ["#1d2b55", "#a7c4ff"],
  ["#4a3313", "#f0cf87"],
];

function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export default async function Image({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  const supabase = publicClient();
  const { data } = supabase && /^[0-9a-f-]{36}$/i.test(storyId)
    ? await supabase
        .from("stories")
        .select("title, synopsis, rating, profiles!stories_author_id_fkey(username, display_name), story_genres(genres(name))")
        .eq("id", storyId)
        .neq("status", "draft")
        .maybeSingle()
    : { data: null };
  const story = data as unknown as {
    title: string;
    synopsis: string;
    rating: string;
    profiles: { username: string; display_name: string | null } | null;
    story_genres: { genres: { name: string } | null }[];
  } | null;
  const title = story?.title ?? "Obsidian Quill";
  const author = story?.profiles ? story.profiles.display_name || story.profiles.username : "";
  const genre = story?.story_genres?.[0]?.genres?.name ?? "";
  const [bg, ink] = SCHEMES[hash(title) % SCHEMES.length];
  const blurb = story && story.rating !== "mature" ? story.synopsis.replace(/\s+/g, " ").slice(0, 150).replace(/\s+\S*$/, "") : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0b0a0d", color: "#ece8f1", fontFamily: "Inter" }}>
        <div
          style={{
            width: 360,
            margin: 60,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: 32,
            borderRadius: 18,
            border: `2px solid ${ink}55`,
            background: `radial-gradient(circle at 50% 30%, ${ink}55 0%, ${bg} 60%)`,
          }}
        >
          <div style={{ width: 60, height: 2, background: ink, marginBottom: 24 }} />
          <div style={{ fontFamily: "Cormorant", fontSize: title.length > 24 ? 40 : 52, lineHeight: 1.05, textAlign: "center", color: "#fff" }}>{title}</div>
          {author && <div style={{ marginTop: 18, fontSize: 16, letterSpacing: 4, color: ink, textTransform: "uppercase" }}>{author}</div>}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 70px 60px 0" }}>
          {genre && <div style={{ fontSize: 24, letterSpacing: 6, color: "#d9b26f", textTransform: "uppercase" }}>{genre}</div>}
          <div style={{ fontFamily: "Cormorant", fontSize: title.length > 30 ? 64 : 84, lineHeight: 1, marginTop: 14 }}>{title}</div>
          {author && <div style={{ fontSize: 30, color: "#a9a3b5", marginTop: 18 }}>{`by ${author}`}</div>}
          {blurb && <div style={{ fontSize: 26, color: "#cfc9da", marginTop: 30, lineHeight: 1.4 }}>{story && blurb.length < story.synopsis.replace(/\s+/g, " ").length ? `${blurb}…` : blurb}</div>}
          <div style={{ marginTop: "auto", fontSize: 24, color: "#b69cff" }}>Read on Obsidian Quill</div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
