// Extracted from the v5.2 AdvancedUI module during the v5.3.0 architecture
// refactor. Behavior is unchanged; only ownership moved.

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import { resumeSummary } from "../../data/portfolioData";
import { useModalDialog } from "../../lib/modalScroll";
import { trackEvent } from "../../lib/analytics";

export function ResumeViewer({ onOpenChange }: { onOpenChange?: (open: boolean) => void } = {}) {
  const [open, setOpen] = useState(false);
  const changeOpen = (next: boolean) => { setOpen(next); onOpenChange?.(next); };
  const dialogRef = useModalDialog<HTMLElement>(open, () => changeOpen(false));
  useEffect(() => {
    const listener = () => { changeOpen(true); trackEvent("resume_open"); };
    window.addEventListener("portfolio:resume", listener);
    return () => window.removeEventListener("portfolio:resume", listener);
  }, [onOpenChange]);
  if (!open) return null;
  return <div className="advanced-modal-backdrop" onMouseDown={() => changeOpen(false)}><section ref={dialogRef} tabIndex={-1} className="advanced-modal resume-modal" role="dialog" aria-modal="true" aria-label="Resume viewer" onMouseDown={e => e.stopPropagation()}>
    <header><div><FileText size={17} /><span>resume.pdf</span></div><div className="resume-header-actions"><a href="/resume/Osameh_Irandoust_CV.pdf" target="_blank" rel="noreferrer" className="icon-text-btn"><ExternalLink size={14} /> Open PDF</a><a href="/resume/Osameh_Irandoust_CV.pdf" download className="icon-text-btn"><Download size={14} /> Download</a><button onClick={() => changeOpen(false)} aria-label="Close resume"><X size={17} /></button></div></header>
    <div className="modal-scroll-viewport">
      <div className="modal-content">
        <div className="resume-summary"><div><div className="resume-identity"><span className="resume-brand"><img src="/icons/icon-128x128.png" srcSet="/icons/icon-128x128.png 1x, /icons/icon-256x256.png 2x" width={56} height={56} alt="" aria-hidden="true" decoding="async" /></span><div><p className="eyebrow">CV / QUICK VIEW</p><h2>{resumeSummary.headline}</h2></div></div><p>{resumeSummary.profile}</p><small>{resumeSummary.education}</small></div><div className="resume-skill-cloud">{resumeSummary.skills.map(skill => <span key={skill}>{skill}</span>)}</div></div>
        <div className="resume-document">
          <article><small>PROFILE</small><p>{resumeSummary.profile}</p></article>
          <article><small>EDUCATION</small><p>{resumeSummary.education}</p></article>
          <article><small>LANGUAGES</small><p>{resumeSummary.languages.join(" · ")}</p></article>
          <article><small>FULL PDF</small><p>The complete PDF is packaged with the portfolio. Use the Open PDF or Download controls in the viewer header.</p></article>
        </div>
      </div>
    </div>
  </section></div>;
}
