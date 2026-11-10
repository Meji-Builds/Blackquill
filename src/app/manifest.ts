import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Obsidian Quill",
    short_name: "Obsidian Quill",
    description: "Serialized web novels and light novels, discovered by how deeply they are read.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0a0d",
    theme_color: "#0b0a0d",
    categories: ["books", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Library", url: "/library" },
      { name: "Downloaded stories", url: "/offline" },
    ],
  };
}
