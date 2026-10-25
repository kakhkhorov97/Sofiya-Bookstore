import { describe, expect, it } from "vitest";
import { readEvents, splitCitations } from "./sse";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

describe("readEvents", () => {
  it("parses events split across chunks", async () => {
    const events = [];
    for await (const e of readEvents(
      streamOf(['data: {"type":"delta","te', 'xt":"Hello "}\n\ndata: {"type":"delta","text":"world"}\n', "\n"]),
    )) {
      events.push(e);
    }
    expect(events).toEqual([
      { type: "delta", text: "Hello " },
      { type: "delta", text: "world" },
    ]);
  });

  it("skips malformed events", async () => {
    const events = [];
    for await (const e of readEvents(streamOf(['data: {oops}\n\ndata: {"type":"done","citedBookIds":[],"fallback":false}\n\n']))) {
      events.push(e);
    }
    expect(events).toHaveLength(1);
  });
});

describe("splitCitations", () => {
  it("separates text from citation numbers", () => {
    expect(splitCitations("Try [2] or [1].")).toEqual(["Try ", 2, " or ", 1, "."]);
    expect(splitCitations("No citations")).toEqual(["No citations"]);
  });
});
