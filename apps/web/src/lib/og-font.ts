import "server-only";

// Bricolage Grotesque ExtraBold for link-preview images, fetched once per
// server instance. The image renderer needs TTF/OTF; Google Fonts serves TTF
// to clients that don't ask for WOFF2. On failure the images fall back to the
// renderer's default font and the next image tries again.
let cached: Promise<ArrayBuffer | null> | undefined;

export function displayFont(): Promise<ArrayBuffer | null> {
  cached ??= (async () => {
    try {
      const css = await (await fetch("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800")).text();
      const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
      if (!url) throw new Error("no TTF in Google Fonts response");
      return await (await fetch(url)).arrayBuffer();
    } catch {
      cached = undefined;
      return null;
    }
  })();
  return cached;
}

export async function ogFonts() {
  const data = await displayFont();
  return data ? [{ name: "Bricolage", data, weight: 800 as const, style: "normal" as const }] : undefined;
}
