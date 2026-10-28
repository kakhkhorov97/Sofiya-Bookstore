import type { BookDetail } from "@sofiya/shared";
import { ImageResponse } from "next/og";
import { coverName, jacket } from "@/components/BookCover";
import { apiGet } from "@/lib/api";
import { ogFonts } from "@/lib/og-font";

// A book's link preview: its jacket next to the title and author. Uploaded
// covers are WebP, which the image renderer can't draw, so every book gets
// the same typographic jacket the shop shows before a cover is uploaded.
export const alt = "Book at Sofiya";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await apiGet<BookDetail>(`/books/${encodeURIComponent(slug)}`, { revalidate: 300 }).catch(() => null);
  const title = book?.title ?? "Sofiya Bookstore";
  const author = book?.author ?? "";
  const { colors, motif } = jacket(slug);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#f4f3ef", padding: 64, gap: 64, fontFamily: "Bricolage" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            width: 334,
            height: 502,
            padding: 32,
            background: colors.bg,
            color: colors.ink,
            borderRadius: "6px 16px 16px 6px",
            boxShadow: "0 24px 48px rgba(21,23,28,0.25)",
          }}
        >
          <div style={{ fontSize: 18, letterSpacing: 2, textTransform: "uppercase", opacity: 0.85 }}>
            {coverName(author)}
          </div>
          {motif === 0 && <div style={{ position: "absolute", left: 32, right: 32, top: 260, height: 3, background: colors.accent }} />}
          {motif === 1 && (
            <div style={{ position: "absolute", right: 46, top: 180, width: 88, height: 88, borderRadius: 999, border: `3px solid ${colors.accent}` }} />
          )}
          {motif === 2 && (
            <div
              style={{
                position: "absolute",
                left: 32,
                top: 210,
                width: 100,
                height: 150,
                borderLeft: `3px solid ${colors.accent}`,
                borderBottom: `3px solid ${colors.accent}`,
              }}
            />
          )}
          <div style={{ fontSize: title.length > 40 ? 30 : 38, fontWeight: 800, lineHeight: 1.08 }}>{title}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, paddingTop: 8 }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: "#15171c", letterSpacing: -1 }}>
            Sofiya<span style={{ color: "#3b37c9" }}>.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: title.length > 40 ? 52 : 64, fontWeight: 800, color: "#15171c", lineHeight: 1.05, letterSpacing: -2 }}>
              {title}
            </div>
            {author && <div style={{ marginTop: 20, fontSize: 32, color: "#4a4f5c" }}>{author}</div>}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#3b37c9", fontWeight: 700 }}>sofiya.store</div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
