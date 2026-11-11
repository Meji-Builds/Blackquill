import { ImageResponse } from "next/og";
import { withFonts } from "@/lib/seo/site";

export const alt = "Obsidian Quill: web novels and light novels";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          background: "radial-gradient(circle at 85% 10%, #3a2a6e 0%, #0b0a0d 55%)",
          color: "#ece8f1",
          fontFamily: "Inter",
        }}
      >
        <div style={{ fontSize: 26, letterSpacing: 8, color: "#d9b26f", textTransform: "uppercase" }}>Serialized fiction</div>
        <div style={{ fontFamily: "Cormorant", fontSize: 128, lineHeight: 1, marginTop: 20 }}>Obsidian Quill</div>
        <div style={{ fontSize: 34, color: "#a9a3b5", marginTop: 28, maxWidth: 860 }}>
          Web novels and light novels, discovered by how deeply people read them.
        </div>
      </div>
    ),
    await withFonts(size),
  );
}
