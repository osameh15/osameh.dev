// Extracted from the v5.2 AdvancedUI module during the v5.3.0 architecture
// refactor. Behavior is unchanged; only ownership moved.

import { nowItems } from "../../data/portfolioData";

export function NowSection() {
  return <section id="now" className="now-section section-pad">
    <div className="section-heading"><span>06</span><div><p>NOW.MD</p><h2>What I’m focused on now.</h2></div></div>
    <div className="now-grid">{nowItems.map((item, index) => <article key={item.label}><span>{String(index + 1).padStart(2, "0")}</span><small>{item.label}</small><p>{item.value}</p></article>)}</div>
  </section>;
}
