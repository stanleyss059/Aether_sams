type Term = { term: string; definition: string };
type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "terms"; items: Term[] };
export type NoteSection = { title: string; blocks: Block[] };

const ACCENTS = [
  { bar: "bg-forest", chip: "bg-forest/10 text-forest", number: "text-forest" },
  { bar: "bg-gold", chip: "bg-gold/10 text-slate", number: "text-gold" },
  { bar: "bg-clay", chip: "bg-clay/10 text-clay", number: "text-clay" },
  { bar: "bg-slate", chip: "bg-slate/10 text-slate", number: "text-slate" },
];

const KNOWN_HEADINGS = new Set([
  "overview",
  "key terms",
  "key terms and definitions",
  "main ideas",
  "main ideas and explanations",
  "processes, examples, or important details from the text",
  "processes",
  "examples",
  "important details",
  "exam takeaways",
  "exam-style takeaways",
]);

function stripDecorators(line: string) {
  return line
    .replace(/^#+\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/\*\*/g, "")
    .trim();
}

function isHeading(raw: string) {
  const cleaned = stripDecorators(raw);
  if (!cleaned || cleaned.length > 72) return null;
  if (/^[-•*]/.test(raw.trim())) return null;
  if (/[.?!]$/.test(cleaned)) return null;
  const key = cleaned.toLowerCase();
  if (KNOWN_HEADINGS.has(key)) return cleaned;
  if (cleaned.includes(":") && cleaned.length > 36) return null;
  const words = cleaned.split(/\s+/);
  if (words.length > 10) return null;
  const titled = words.filter((word) => /^[A-Z0-9]/.test(word) || /^(and|or|of|the|a|an|in|to|for|from)$/i.test(word));
  if (titled.length !== words.length) return null;
  const capitals = words.filter((word) => /^[A-Z]/.test(word)).length;
  if (capitals < Math.max(1, Math.ceil(words.length * 0.5))) return null;
  return cleaned;
}

function parseTerm(line: string): Term | null {
  const cleaned = line.replace(/^[-•*]\s+/, "").replace(/\*\*/g, "").trim();
  const match = /^([^:]{1,60}):\s+(.+)$/.exec(cleaned);
  if (!match) return null;
  return { term: match[1].trim(), definition: match[2].trim() };
}

function isBullet(line: string) {
  return /^[-•*]\s+/.test(line.trim());
}

function flushGroup(kind: "paragraph" | "bullets" | "terms", lines: string[], blocks: Block[]) {
  if (lines.length === 0) return;
  if (kind === "paragraph") {
    const text = lines.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ kind: "paragraph", text });
    return;
  }
  if (kind === "terms") {
    const items = lines.map(parseTerm).filter((item): item is Term => Boolean(item));
    if (items.length) blocks.push({ kind: "terms", items });
    return;
  }
  const items = lines.map((line) => line.replace(/^[-•*]\s+/, "").trim()).filter(Boolean);
  if (items.length) blocks.push({ kind: "bullets", items });
}

export function parseStudyNotes(text: string): NoteSection[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: NoteSection[] = [];
  let title = "Notes";
  let blocks: Block[] = [];
  let groupKind: "paragraph" | "bullets" | "terms" | null = null;
  let group: string[] = [];

  function startSection(nextTitle: string) {
    if (groupKind) flushGroup(groupKind, group, blocks);
    groupKind = null;
    group = [];
    if (blocks.length || sections.length) {
      sections.push({ title, blocks });
    }
    title = nextTitle;
    blocks = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (groupKind) flushGroup(groupKind, group, blocks);
      groupKind = null;
      group = [];
      continue;
    }
    const heading = isHeading(line);
    if (heading) {
      startSection(heading);
      continue;
    }
    const term = parseTerm(line);
    const nextKind: "terms" | "bullets" | "paragraph" = term ? "terms" : isBullet(line) ? "bullets" : "paragraph";
    if (groupKind && groupKind !== nextKind) {
      flushGroup(groupKind, group, blocks);
      group = [];
    }
    groupKind = nextKind;
    group.push(line);
  }
  if (groupKind) flushGroup(groupKind, group, blocks);
  if (blocks.length) sections.push({ title, blocks });
  return sections.length ? sections : [{ title: "Notes", blocks: [{ kind: "paragraph", text: text.trim() }] }];
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="mt-3 space-y-3">
      {blocks.map((block, index) => {
        if (block.kind === "paragraph") {
          return (
            <p key={index} className="text-[15px] leading-7 text-ink">
              {block.text}
            </p>
          );
        }
        if (block.kind === "terms") {
          return (
            <div key={index} className="grid gap-2 sm:grid-cols-2">
              {block.items.map((item) => (
                <div key={item.term} className="rounded-xl border border-line bg-parchment/80 px-3.5 py-3">
                  <p className="text-sm font-bold text-ink">{item.term}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{item.definition}</p>
                </div>
              ))}
            </div>
          );
        }
        return (
          <ul key={index} className="space-y-2">
            {block.items.map((item) => (
              <li key={item} className="flex gap-2.5 text-[15px] leading-7 text-ink">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

export function StudyNotes({
  notes,
  loading = false,
}: {
  notes: string;
  loading?: boolean;
}) {
  const sections = notes.trim() ? parseStudyNotes(notes) : [];

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="inline-flex rounded-full bg-forest/10 px-2.5 py-1 text-xs font-bold text-forest">
            STUDY NOTES
          </span>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.03em]">Revision cards</h2>
        </div>
        {sections.length ? (
          <p className="text-sm font-semibold text-muted">
            {sections.length} section{sections.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      {loading && !sections.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-40 animate-pulse rounded-2xl border border-line bg-surface" />
          ))}
        </div>
      ) : null}

      {!loading && !sections.length ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center text-muted">
          Notes are not ready yet.
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map((section, index) => {
          const look = ACCENTS[index % ACCENTS.length];
          const featured = index === 0 || section.blocks.some((block) => block.kind === "terms");
          return (
            <article
              key={`${section.title}-${index}`}
              className={`overflow-hidden rounded-2xl border border-line bg-surface ${featured ? "lg:col-span-2" : ""}`}
            >
              <div className={`h-1.5 ${look.bar}`} />
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-extrabold tracking-[0.14em] ${look.number}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${look.chip}`}>CARD</span>
                </div>
                <h3 className="mt-2 text-xl font-bold tracking-[-0.03em] text-ink">{section.title}</h3>
                <Blocks blocks={section.blocks} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
