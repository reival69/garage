// Garage — Biblioteca keyword search. Pure functions shared by the browser
// (term parsing, vehicle matching) and the server (page ranking + snippets).
// No imports from the data layer: safe to bundle on both sides.

/**
 * Lowercase + strip accents while keeping the SAME string length, so indexes
 * found in the folded text map 1:1 onto the original (needed for snippets).
 */
export function fold(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const base = text[i].normalize("NFD")[0]?.toLowerCase() ?? " ";
    out += base.length === 1 ? base : " ";
  }
  return out;
}

const STOPWORDS = new Set(
  (
    "a al algo como con contra cual cuando de del desde donde el en entre es esta este " +
    "hay la las le lo los mas me mi muy no o para pero por que se si sin sobre su sus " +
    "tu un una uno unos unas y ya the of and for to in on with is"
  ).split(" "),
);

/** Split a query into search terms (keeps numbers like "1.6" or "2,0"). */
export function queryTerms(query: string): string[] {
  const tokens = fold(query).match(/[a-z0-9]+(?:[.,][0-9]+)*/g) ?? [];
  const terms = tokens.filter((t) => (t.length > 1 || /\d/.test(t)) && !STOPWORDS.has(t));
  return Array.from(new Set(terms)).slice(0, 12);
}

export interface SnippetSegment {
  text: string;
  hit: boolean;
}

export interface PageHit {
  docId: string;
  page: number; // 1-based
  score: number;
  matched: number; // how many distinct query terms the page contains
  totalTerms: number;
  snippet: SnippetSegment[];
}

export interface DocPages {
  docId: string;
  pages: string[]; // index 0 = page 1
}

function countOccurrences(haystack: string, needle: string, cap = 8): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1 && n < cap) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

function buildSnippet(original: string, folded: string, terms: string[]): SnippetSegment[] {
  // Center the snippet on the first occurrence of the longest term found.
  const anchorTerm = [...terms].sort((a, b) => b.length - a.length).find((t) => folded.includes(t));
  const anchor = anchorTerm ? folded.indexOf(anchorTerm) : 0;
  const start = Math.max(0, anchor - 110);
  const end = Math.min(original.length, anchor + 190);
  const text = original.slice(start, end).replace(/\s+/g, " ");
  const ftext = fold(text);

  const marks: Array<[number, number]> = [];
  for (const t of terms) {
    let i = ftext.indexOf(t);
    while (i !== -1) {
      marks.push([i, i + t.length]);
      i = ftext.indexOf(t, i + t.length);
    }
  }
  marks.sort((a, b) => a[0] - b[0]);
  const segments: SnippetSegment[] = [];
  let pos = 0;
  for (const [s, e] of marks) {
    if (s < pos) continue;
    if (s > pos) segments.push({ text: text.slice(pos, s), hit: false });
    segments.push({ text: text.slice(s, e), hit: true });
    pos = e;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), hit: false });
  if (start > 0) segments.unshift({ text: "… ", hit: false });
  if (end < original.length) segments.push({ text: " …", hit: false });
  return segments;
}

/**
 * Rank pages by how many query terms they contain (all terms first), then by
 * term frequency weighted by how rare each term is across the searched pages.
 */
export function searchPages(docs: DocPages[], query: string, limit = 10): PageHit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  const all: Array<{ docId: string; page: number; original: string; folded: string }> = [];
  for (const d of docs) {
    d.pages.forEach((original, i) => {
      if (original) all.push({ docId: d.docId, page: i + 1, original, folded: fold(original) });
    });
  }
  if (all.length === 0) return [];

  const weight: Record<string, number> = {};
  for (const t of terms) {
    const df = all.filter((p) => p.folded.includes(t)).length;
    weight[t] = df === 0 ? 0 : Math.log(1 + all.length / df);
  }

  const hits: Array<PageHit & { idx: number }> = [];
  all.forEach((p, idx) => {
    let matched = 0;
    let score = 0;
    for (const t of terms) {
      const c = countOccurrences(p.folded, t);
      if (c > 0) {
        matched++;
        score += weight[t] * (1 + Math.log(c));
      }
    }
    if (matched === 0) return;
    if (terms.length > 1 && p.folded.includes(terms.join(" "))) score *= 1.5;
    hits.push({
      idx,
      docId: p.docId,
      page: p.page,
      score: matched * 100 + score,
      matched,
      totalTerms: terms.length,
      snippet: [],
    });
  });
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map(({ idx, ...h }) => ({
    ...h,
    snippet: buildSnippet(all[idx].original, all[idx].folded, terms),
  }));
}
