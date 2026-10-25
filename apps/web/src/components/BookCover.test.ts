import { describe, expect, it } from "vitest";
import { coverName } from "./BookCover";

describe("coverName", () => {
  it("uses the last surname, ignoring editor notes", () => {
    expect(coverName("Jacob and Wilhelm Grimm")).toBe("Grimm");
    expect(coverName("Amy Brown and Greg Wilson (eds.)")).toBe("Wilson");
    expect(coverName("Herodotus")).toBe("Herodotus");
  });
});
