// Extracted from the v5.2 AdvancedUI module during the v5.3.0 architecture
// refactor. Behavior is unchanged; only ownership moved.

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { changelog } from "../../data/portfolioData";
import { RELEASE_THEME, getReleaseCodename } from "../../lib/releaseMetadata";

export function ChangelogSection() {
  const initialVisible = 5;
  const [expanded, setExpanded] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(changelog[0]?.version || "");
  const [hoveredVersion, setHoveredVersion] = useState("");
  const visibleItems = expanded ? changelog : changelog.slice(0, initialVisible);
  const hiddenCount = Math.max(0, changelog.length - initialVisible);

  useEffect(() => {
    if (!visibleItems.length) return;
    if (!visibleItems.some(item => item.version === selectedVersion)) setSelectedVersion(visibleItems[0].version);
  }, [visibleItems, selectedVersion]);

  const selected = visibleItems.find(item => item.version === selectedVersion) || visibleItems[0];
  const selectedIndex = selected ? changelog.findIndex(item => item.version === selected.version) : 0;

  return <section id="changelog" className="changelog-section section-pad">
    <div className="section-heading"><span>07</span><div><p>CHANGELOG.MD</p><h2>This portfolio ships like software.</h2></div></div>
    <div className="changelog-graph-shell">
      <div className="changelog-graph-intro">
        <div>
          <p className="eyebrow">RELEASE GRAPH / LIVE HISTORY</p>
          <h3>Scan the latest releases, then drill into the exact version you want.</h3>
        </div>
        <p>The newest five releases stay visible by default so the first screen remains focused. Hover previews a node; select it to load that version and its shipped changes into the detail panel.</p>
      </div>
      <div className="changelog-graph-layout">
        <div className="changelog-graph-map" role="listbox" aria-label="Portfolio release graph">
          <div className="changelog-graph-line" aria-hidden="true" />
          {visibleItems.map((item, index) => {
            const isActive = selected?.version === item.version;
            const isPreview = hoveredVersion === item.version && !isActive;
            return <button
              key={item.version}
              type="button"
              role="option"
              aria-selected={isActive}
              className={`${isActive ? "changelog-node active" : "changelog-node"}${isPreview ? " preview" : ""}`}
              onMouseEnter={() => setHoveredVersion(item.version)}
              onMouseLeave={() => setHoveredVersion("")}
              onFocus={() => setHoveredVersion(item.version)}
              onBlur={() => setHoveredVersion("")}
              onClick={() => setSelectedVersion(item.version)}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="changelog-node-axis" aria-hidden="true">
                <span className="changelog-node-point"><span /></span>
                <small>v{item.version}</small>
              </span>
              <span className="changelog-node-content">
                <small>{index === 0 ? "LATEST" : !expanded ? "RECENT" : index < initialVisible ? "RECENT" : "ARCHIVE"}</small>
                <strong>{item.title}</strong>
                {getReleaseCodename(item.version) && <em className="release-codename" title={`${RELEASE_THEME} release family`}>{getReleaseCodename(item.version)}</em>}
              </span>
            </button>;
          })}
          {!expanded && hiddenCount > 0 && <div className="changelog-node-pending"><span />+{hiddenCount} older releases</div>}
        </div>
        {selected && <aside className="changelog-graph-detail" aria-live="polite">
          <div className="changelog-graph-detail-head">
            <div>
              <p className="eyebrow">SELECTED RELEASE</p>
              <h3>{selected.title}</h3>
              {getReleaseCodename(selected.version) && <p className="release-codename-line"><em className="release-codename">{getReleaseCodename(selected.version)}</em><span>{RELEASE_THEME} release family</span></p>}
            </div>
            <code>v{selected.version}</code>
          </div>
          <p className="changelog-detail-meta">Release {String(selectedIndex + 1).padStart(2, "0")} of {String(changelog.length).padStart(2, "0")} · Select a node in the graph to inspect that release. Hover only previews the node without changing the details panel.</p>
          <div className="changelog-detail-list">
            {selected.items.map((change, index) => <article key={change}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{change}</p>
            </article>)}
          </div>
        </aside>}
      </div>
      {hiddenCount > 0 && <div className="changelog-load-more">
        <div>
          <b>{expanded ? `Showing all ${changelog.length} releases.` : `Showing the latest ${initialVisible} of ${changelog.length} releases.`}</b>
          <span>{expanded ? "Collapse the older history if you want to return to the short release snapshot." : "Load the rest of the release history only when you want the deeper archive."}</span>
        </div>
        <button type="button" className={expanded ? "secondary-btn is-open" : "secondary-btn"} onClick={() => setExpanded(current => !current)}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {expanded ? "Collapse older releases" : `Load ${hiddenCount} older releases`}
        </button>
      </div>}
    </div>
  </section>;
}
