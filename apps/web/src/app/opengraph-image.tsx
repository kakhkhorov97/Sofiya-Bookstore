import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og-font";

// The picture chat apps and social sites show when someone shares a link.
export const alt = "Sofiya Bookstore";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SPINES = [
  { bg: "#24466b", h: 380 },
  { bg: "#d79a2b", h: 330 },
  { bg: "#2c6a4a", h: 400 },
  { bg: "#a63f26", h: 350 },
  { bg: "#4448a8", h: 390 },
];

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#ffffff", padding: 72, fontFamily: "Bricolage" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#15171c", letterSpacing: -2 }}>
            Sofiya<span style={{ color: "#3b37c9" }}>.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 66, fontWeight: 800, color: "#15171c", lineHeight: 1.05, letterSpacing: -2, maxWidth: 640 }}>
              Your next favourite book is already here.
            </div>
            <div style={{ marginTop: 28, fontSize: 30, color: "#4a4f5c", maxWidth: 620 }}>
              Classics, stories and programming books. Ask our AI concierge what to read next.
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#3b37c9", fontWeight: 700 }}>sofiya.store</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, paddingBottom: 20 }}>
          {SPINES.map((s) => (
            <div key={s.bg} style={{ width: 58, height: s.h, background: s.bg, borderRadius: "4px 8px 8px 4px" }} />
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
