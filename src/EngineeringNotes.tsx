import { useEffect, useMemo, useState, type MouseEvent } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Check, Clock3, Copy, Hash, LoaderCircle, Share2 } from "lucide-react";
import { engineeringNotes, type EngineeringNote } from "./notesData";
import { notify } from "./toast";

function noteDate(value: string) {
  try { return new Date(`${value}T00:00:00`).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return value; }
}

export function EngineeringNotesSection({ onOpenNote }: { onOpenNote: (slug: string) => void }) {
  return <section id="notes" className="engineering-notes section-pad" aria-labelledby="engineering-notes-title">
    <div className="section-heading">
      <span>07</span>
      <div><p>ENGINEERING.NOTES/</p><h2 id="engineering-notes-title">Notes from the workbench.</h2></div>
      <span className="notes-count">{engineeringNotes.length} notes</span>
    </div>
    <p className="notes-intro">Architecture decisions, deployment lessons, performance trade-offs, and implementation details from software I actually build and operate.</p>
    <div className="notes-grid">
      {engineeringNotes.map((note, index) => <article key={note.slug} className="note-card">
        <header><span>{String(index + 1).padStart(2, "0")}</span><BookOpen size={17} /></header>
        <div className="note-card-meta"><span><Clock3 size={12} /> {note.readingMinutes} min</span><span><CalendarDays size={12} /> {noteDate(note.publishedAt)}</span></div>
        <h3>{note.title}</h3>
        <p>{note.summary}</p>
        <div className="note-tags">{note.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
        <button type="button" onClick={() => onOpenNote(note.slug)}>Read note <ArrowUpRight size={14} /></button>
      </article>)}
    </div>
  </section>;
}

type TocItem = { id: string; label: string; level: number };

function prepareNoteHtml(markdown: string) {
  const raw = marked.parse(markdown, { gfm: true, breaks: false }) as string;
  const clean = DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "textarea", "select"],
    FORBID_ATTR: ["style", "srcset", "onerror", "onclick"],
  });
  const doc = new DOMParser().parseFromString(`<article>${clean}</article>`, "text/html");
  const toc: TocItem[] = [];
  doc.querySelectorAll("h2,h3").forEach((heading, index) => {
    const label = heading.textContent?.trim() || `Section ${index + 1}`;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `section-${index + 1}`;
    heading.id = id;
    toc.push({ id, label, level: heading.tagName === "H2" ? 2 : 3 });
  });
  doc.querySelectorAll("a").forEach(link => {
    const href = link.getAttribute("href") || "";
    if (/^https:\/\//i.test(href)) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  });
  doc.querySelectorAll("pre").forEach(pre => {
    pre.classList.add("note-code-block");
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "note-copy-code";
    button.setAttribute("data-copy-code", "1");
    button.textContent = "Copy";
    pre.insertBefore(button, pre.firstChild);
  });
  return { html: doc.body.firstElementChild?.innerHTML || clean, toc };
}

export function EngineeringNoteView({ slug, onClose }: { slug: string; onClose: () => void }) {
  const note = useMemo(() => engineeringNotes.find(item => item.slug === slug), [slug]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [html, setHtml] = useState("");
  const [toc, setToc] = useState<TocItem[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!note) { setState("error"); return; }
    const controller = new AbortController();
    setState("loading");
    fetch(`/notes-content/${encodeURIComponent(note.slug)}.md`, { signal: controller.signal, headers: { Accept: "text/markdown" } })
      .then(response => { if (!response.ok) throw new Error("note"); return response.text(); })
      .then(markdown => {
        const prepared = prepareNoteHtml(markdown);
        setHtml(prepared.html);
        setToc(prepared.toc);
        setState("ready");
      })
      .catch(error => { if (error?.name !== "AbortError") setState("error"); });
    return () => controller.abort();
  }, [note]);

  useEffect(() => {
    if (!note) return;
    document.title = `${note.title} — Osameh Irandoust`;
  }, [note]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
      notify("Note link copied.", "success");
    } catch { notify("Clipboard permission was blocked.", "error"); }
  };

  const share = async () => {
    if (!note) return;
    if (navigator.share) {
      try { await navigator.share({ title: note.title, text: note.summary, url: window.location.href }); return; } catch { return; }
    }
    await copyUrl();
  };

  const handleArticleClick = async (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>("[data-copy-code]");
    if (!button) return;
    const code = button.closest("pre")?.querySelector("code")?.textContent || "";
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = "Copy"; }, 1200);
    } catch { notify("Could not copy this code block.", "error"); }
  };

  if (!note) return <section className="note-detail note-detail-error"><h1>Note not found.</h1><button className="secondary-btn" onClick={onClose}><ArrowLeft size={15} /> Back to notes</button></section>;

  return <section className="note-detail" aria-labelledby="note-detail-title">
    <header className="note-detail-hero">
      <div className="note-detail-breadcrumb"><button type="button" onClick={onClose}><ArrowLeft size={14} /> Engineering Notes</button><span>/</span><code>{note.slug}.md</code></div>
      <p className="eyebrow">ENGINEERING NOTE / {note.tags[0]?.toUpperCase()}</p>
      <h1 id="note-detail-title">{note.title}</h1>
      <p>{note.summary}</p>
      <div className="note-detail-meta"><span><CalendarDays size={14} /> {noteDate(note.publishedAt)}</span><span><Clock3 size={14} /> {note.readingMinutes} min read</span><span><Hash size={14} /> {note.tags.join(" · ")}</span></div>
      <div className="note-detail-actions"><button className="secondary-btn" onClick={() => void share()}><Share2 size={14} /> Share note</button><button className="secondary-btn" onClick={() => void copyUrl()}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy link"}</button></div>
    </header>
    <div className="note-reading-layout">
      <aside className="note-toc"><p>ON THIS PAGE</p>{toc.length ? toc.map(item => <a key={item.id} className={item.level === 3 ? "nested" : ""} href={`#${item.id}`}>{item.label}</a>) : <span>Table of contents appears after the note loads.</span>}</aside>
      <main className="note-reading-pane">
        {state === "loading" ? <div className="note-loading"><LoaderCircle className="spin" size={20} /><span>Loading note.md…</span></div> : state === "error" ? <div className="note-loading error"><span>This note could not be loaded.</span></div> : <article className="note-markdown" onClick={handleArticleClick} dangerouslySetInnerHTML={{ __html: html }} />}
      </main>
    </div>
  </section>;
}
