import type { AskEvent } from "@sofiya/shared";

// Splits a text/event-stream into parsed `data:` events as chunks arrive.
// Chunks can end mid-event, so incomplete text is carried over.
export async function* readEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<AskEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      yield* drain();
    }
    buffer += decoder.decode();
    buffer += "\n\n";
    yield* drain();
  } finally {
    reader.releaseLock();
  }

  function* drain(): Generator<AskEvent> {
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = raw
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      try {
        yield JSON.parse(data) as AskEvent;
      } catch {
        // Ignore a malformed event rather than breaking the whole answer.
      }
    }
  }
}

// "Try [2] or [1]." -> ["Try ", 2, " or ", 1, "."]
export function splitCitations(text: string): (string | number)[] {
  return text.split(/\[(\d+)\]/).map((part, i) => (i % 2 === 1 ? Number(part) : part)).filter((p) => p !== "");
}
