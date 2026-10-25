// Escape LIKE wildcards so user input is matched literally
// (the legacy API passed raw input into new RegExp()).
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
