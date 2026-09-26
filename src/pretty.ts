// Display form of a typed line: superscripts, a true minus sign and a
// multiplication dot. Only for showing; the engine reads what was typed.
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };

export function pretty(line: string): string {
  return line
    .replace(/\^\(?(-?\d+)\)?/g, (_, e: string) => [...e].map((c) => SUP[c] ?? c).join(""))
    .replace(/(^|[^eE\d.])-/g, "$1−")
    .replace(/\*/g, "·");
}
