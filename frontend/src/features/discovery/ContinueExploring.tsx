import { ArrowUpRight, Braces, Code2, FileText } from "lucide-react";
import type { RelatedItem } from "../../lib/relatedContent";

const ICON = {
  project: Code2,
  note: Braces,
  "case-study": FileText,
} as const;

/**
 * The end of a project, note or case study. Real anchors, so a modified or
 * middle click behaves natively and the address is shareable; a plain left
 * click is handed to the existing SPA lifecycle by the caller, which keeps the
 * editor-tab contract intact and never opens a duplicate tab.
 *
 * Renders nothing when there is nothing genuinely related - an empty block
 * would be its own dead end.
 */
export function ContinueExploring({ items, onOpen }: { items: RelatedItem[]; onOpen: (item: RelatedItem) => void }) {
  if (!items.length) return null;

  return (
    <nav className="continue-exploring" aria-label="Continue exploring">
      <p className="continue-exploring-title">Continue exploring</p>
      <ul>
        {items.map(item => {
          const Icon = ICON[item.kind];
          return (
            <li key={`${item.kind}:${item.id}`}>
              <a
                className="continue-exploring-link"
                href={item.href}
                onClick={event => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  onOpen(item);
                }}
              >
                <span className="continue-exploring-kind"><Icon size={13} aria-hidden="true" /> {item.hint}</span>
                <span className="continue-exploring-name">{item.title}</span>
                <span className="continue-exploring-reason">{item.reason}</span>
                <ArrowUpRight size={14} aria-hidden="true" className="continue-exploring-arrow" />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
