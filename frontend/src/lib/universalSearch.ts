// Ranking for the single Command Palette / Universal Search surface.
// Pure and self-contained, so ranking can be reasoned about on its own.

export type PaletteCommand = {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  icon: "home" | "code" | "about" | "experience" | "contact" | "terminal" | "theme" | "github" | "linkedin" | "copy" | "build" | "hire";
  action: () => void;
};

export function universalSearchScore(query: string, item: Pick<PaletteCommand, "label" | "hint" | "keywords">) {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const label = item.label.toLowerCase();
  const haystack = `${item.label} ${item.hint} ${item.keywords}`.toLowerCase();
  const compact = (value: string) => value.replace(/[^a-z0-9]+/g, "");
  const compactQuery = compact(q);
  const compactLabel = compact(label);
  const compactHaystack = compact(haystack);
  if (label === q) return 1000;
  if (label.startsWith(q)) return 800;
  if (label.includes(q)) return 650;
  // Treat punctuation and separators as search-neutral so queries such as
  // "realtime communications" rank "real-time communications" naturally.
  if (compactQuery && compactLabel.includes(compactQuery)) return 625;
  if (haystack.includes(q)) return 500;
  if (compactQuery && compactHaystack.includes(compactQuery)) return 475;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.every(token => haystack.includes(token) || compactHaystack.includes(compact(token)))) return 350 + tokens.length * 10;
  let cursor = 0;
  for (const char of compactQuery) {
    cursor = compactHaystack.indexOf(char, cursor);
    if (cursor < 0) return -1;
    cursor += 1;
  }
  return 100;
}
