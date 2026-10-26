import { z } from "zod";

// Zod 4 reworded its default messages ("Too small: expected string to have
// >=1 characters"). Readers see these (form errors, API 400s), so keep the
// zod 3 wording. Messages written in the schemas still take precedence.

function received(input: unknown): string {
  if (input === null) return "null";
  if (Array.isArray(input)) return "array";
  if (typeof input === "number") return Number.isNaN(input) ? "nan" : "number";
  if (input instanceof Date) return "date";
  return typeof input;
}

function sizeWord(kind: "min" | "max", exact: boolean | undefined, inclusive: boolean | undefined, strict: string) {
  if (exact) return "exactly";
  if (kind === "min") return inclusive ? "at least" : strict;
  return inclusive ? "at most" : strict;
}

const zod3Messages: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type":
      if (issue.input === undefined) return "Required";
      if (issue.expected === "int") return "Expected integer, received float";
      return `Expected ${issue.expected}, received ${received(issue.input)}`;
    case "invalid_value":
      if (issue.input === undefined) return "Required";
      if (issue.values.length === 1) return `Invalid literal value, expected ${JSON.stringify(issue.values[0])}`;
      return `Invalid enum value. Expected ${issue.values.map((v) => `'${String(v)}'`).join(" | ")}, received '${String(issue.input)}'`;
    case "too_small": {
      const min = String(issue.minimum);
      if (issue.origin === "string") return `String must contain ${sizeWord("min", issue.exact, issue.inclusive, "over")} ${min} character(s)`;
      if (issue.origin === "array" || issue.origin === "set")
        return `Array must contain ${sizeWord("min", issue.exact, issue.inclusive, "more than")} ${min} element(s)`;
      if (issue.origin === "number")
        return `Number must be ${issue.exact ? "exactly equal to" : issue.inclusive ? "greater than or equal to" : "greater than"} ${min}`;
      return undefined;
    }
    case "too_big": {
      const max = String(issue.maximum);
      if (issue.origin === "string") return `String must contain ${sizeWord("max", issue.exact, issue.inclusive, "under")} ${max} character(s)`;
      if (issue.origin === "array" || issue.origin === "set")
        return `Array must contain ${sizeWord("max", issue.exact, issue.inclusive, "less than")} ${max} element(s)`;
      if (issue.origin === "number")
        return `Number must be ${issue.exact ? "exactly" : issue.inclusive ? "less than or equal to" : "less than"} ${max}`;
      return undefined;
    }
    case "invalid_format":
      return `Invalid ${issue.format === "guid" ? "uuid" : issue.format}`;
    case "not_multiple_of":
      return `Number must be a multiple of ${String(issue.divisor)}`;
    case "unrecognized_keys":
      return `Unrecognized key(s) in object: ${issue.keys.map((k) => `'${k}'`).join(", ")}`;
    case "invalid_union":
    case "custom":
      return "Invalid input";
    default:
      return undefined;
  }
};

// Global, so it also covers schemas the apps define with the same zod copy.
z.config({ customError: zod3Messages });
