import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("allows paths on this site", () => {
    expect(safeNext("/checkout")).toBe("/checkout");
    expect(safeNext("/books?genre=MYSTERY")).toBe("/books?genre=MYSTERY");
  });

  it("refuses other sites and odd values", () => {
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext(undefined, "/account")).toBe("/account");
  });
});
