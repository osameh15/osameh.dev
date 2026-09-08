// Extracted from the v5.2 AdvancedUI module during the v5.3.0 architecture
// refactor. Behavior is unchanged; only ownership moved.

import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { useModalDialog } from "../../lib/modalScroll";

export function ShortcutGuide() {
  const [open, setOpen] = useState(false);
  const dialogRef = useModalDialog<HTMLElement>(open, () => setOpen(false));
  useEffect(() => { const listener = () => setOpen(true); window.addEventListener("portfolio:shortcuts", listener); return () => window.removeEventListener("portfolio:shortcuts", listener); }, []);
  if (!open) return null;
  const rows = [["Ctrl/Cmd + Shift + P", "Command Palette"], ["`", "Toggle terminal"], ["Tab", "Terminal autocomplete"], ["Shift + Tab", "Previous autocomplete suggestion"], ["G then P", "Projects"], ["G then A", "About"], ["G then E", "Experience"], ["G then N", "Now"], ["G then C", "Contact"], ["/", "Focus project search"], ["?", "Keyboard shortcuts"], ["Esc", "Close active modal/tab"]];
  return <div className="advanced-modal-backdrop" onMouseDown={() => setOpen(false)}><section ref={dialogRef} tabIndex={-1} className="advanced-modal shortcuts-modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onMouseDown={e => e.stopPropagation()}><header><div><Keyboard size={17} /><span>keyboard-shortcuts.md</span></div><button onClick={() => setOpen(false)} aria-label="Close keyboard shortcuts"><X size={17} /></button></header><div className="modal-scroll-viewport"><div className="modal-content"><div className="shortcut-grid">{rows.map(([keys, action]) => <div key={keys}><kbd>{keys}</kbd><span>{action}</span></div>)}</div></div></div></section></div>;
}
