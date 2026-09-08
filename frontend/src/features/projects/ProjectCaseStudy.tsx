// Extracted from the v5.2 AdvancedUI module during the v5.3.0 architecture
// refactor. Behavior is unchanged; only ownership moved.

import { useMemo } from "react";
import { caseStudyFor, type RepoLike } from "../../data/portfolioData";

export function ProjectCaseStudy({ repo }: { repo: RepoLike }) {
  const study = useMemo(() => caseStudyFor(repo), [repo]);
  return <section className="case-study" aria-labelledby={`case-study-${repo.id}`}>
    <div className="advanced-section-head"><div><p className="eyebrow">PROJECT / CASE STUDY</p><h2 id={`case-study-${repo.id}`}>How it was engineered.</h2></div><span>Problem → decision → result</span></div>
    <div className="case-study-grid">
      <article><small>01 / PROBLEM</small><h3>The problem</h3><p>{study.problem}</p></article>
      <article><small>02 / SOLUTION</small><h3>The approach</h3><p>{study.solution}</p></article>
      <article><small>03 / ARCHITECTURE</small><h3>Architecture</h3><ul>{study.architecture.map(item => <li key={item}>{item}</li>)}</ul></article>
      <article><small>04 / CHALLENGES</small><h3>Engineering challenges</h3><ul>{study.challenges.map(item => <li key={item}>{item}</li>)}</ul></article>
      <article className="case-study-result"><small>05 / RESULT</small><h3>What shipped</h3><ul>{study.results.map(item => <li key={item}>{item}</li>)}</ul></article>
    </div>
  </section>;
}
