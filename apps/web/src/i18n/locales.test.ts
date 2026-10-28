import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ko from "../../messages/ko.json";
import ru from "../../messages/ru.json";
import { pickLocale } from "./locales";

// Every key path in a messages file, e.g. "header.orders".
function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("pickLocale", () => {
  it("prefers the saved choice, then the browser's languages, then English", () => {
    expect(pickLocale("ru", "ko-KR,ko;q=0.9")).toBe("ru");
    expect(pickLocale(undefined, "ko-KR,ko;q=0.9,en;q=0.8")).toBe("ko");
    expect(pickLocale(undefined, "de-DE,ru;q=0.7")).toBe("ru");
    expect(pickLocale("xx", "fr-FR")).toBe("en");
    expect(pickLocale(undefined, null)).toBe("en");
  });
});

describe("translations", () => {
  it("have exactly the same keys in English, Korean and Russian", () => {
    const base = keys(en).sort();
    expect(keys(ko).sort()).toEqual(base);
    expect(keys(ru).sort()).toEqual(base);
  });

  it("have no empty strings", () => {
    for (const [name, messages] of Object.entries({ en, ko, ru })) {
      const empty = keys(messages).filter((k) =>
        k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], messages) === "",
      );
      expect({ name, empty }).toEqual({ name, empty: [] });
    }
  });
});
