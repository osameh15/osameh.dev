# Changelog

All notable changes to **osameh.dev** are documented here.

The project follows [Semantic Versioning](https://semver.org/). The early production releases were shipped in rapid succession while the portfolio was moved from its hosted prototype to the current ParsPack/CDN deployment.

## 5.6.3 - 2026-09-16 - Raven

A patch inside the **Raven** family: the two defects carried forward from 5.6.1 and 5.6.2, plus one small interface addition. No content, route, SEO or dependency change.

### A deployment can no longer serve a document whose assets are gone

- The deploy mirrored the artifact with `--delete`, so the previous build's fingerprinted assets were removed the instant the new build was published. Documents stay cacheable and the ParsPack edge keys variants by request headers, so some clients were still handed the previous build's HTML for minutes afterwards - HTML naming `/assets/index-<oldhash>.js`, which no longer existed. Those requests answered 404 and the application never booted. Measured on production right after the 5.6.2 deploy: requests without browser headers received HTML referencing the 5.6.1 bundle, both assets 404, while browser-header requests received fresh HTML.
- Deployment is now ordered rather than atomic-by-hope: new fingerprinted assets are published first, documents second, and superseded assets pruned last. New assets exist before any document names them, and the document mirror is forbidden from deleting the asset directory or the retention ledger.
- `scripts/asset-retention.mjs` owns the policy. A generation is retained while it is one of the newest three **or** younger than six hours, whichever keeps it longer; deletion is computed against the union of retained generations, so an asset carried unchanged into a newer build is never removed. A missing or malformed ledger authorises no deletion at all.
- CDN purge is no longer load-bearing. A purge can be delayed, partial or regionally inconsistent; correctness now rests on retention, so the deployment stays coherent even if every purge fails.
- Document `stale-while-revalidate` drops from 3600 to 60 seconds for note, case-study and project responses, bounding the stale-document window at six minutes. Hashed assets keep their one-year immutable policy - asset caching is not weakened to work around the problem.
- Rollback is covered by the same retention: restoring the previous build finds the assets its documents reference still present.
- The policy is proved by a deterministic simulation that contacts no server and no CDN, and a second gate fails the build unless both workflows apply the three steps in the correct order.

### Closing a case study restores what you were looking at

- Opening a case study recorded the scroll coordinate it covered. A coordinate describes the document, so it went stale whenever content above the viewport finished loading while the dialog was open: closing it returned the page shifted by exactly that growth. Measured at 580px on staging and 588px on production during 5.6.2 acceptance, and present on 5.6.1 as well.
- The origin now also records a visual anchor - the section the workspace was showing plus its exact viewport offset. On close the anchor is re-measured and the drift removed, so the same content returns to the same place however much grew above it.
- The compensation runs in the commit that closed the dialog. React fires every layout-effect cleanup before any layout-effect body, so the scroll lock has already restored the covered position and only real drift remains. An anchor that no longer resolves - returning into an open note, for example - leaves the existing restoration untouched.
- Nothing in the path is GitHub-specific. Project data is only the deterministic reproducer; any asynchronous content above the origin is handled the same way.
- The 5.6.2 stabilizer contract is unchanged: no timed re-snaps, no scroll-event intent detection, measured compensation only, and user input still wins.

### The status bar switches the programming-language presentation mode

- The status bar already named the active **programming-language presentation mode** - the language the workspace renders its code samples, file names and tab labels in. Clicking it now opens a compact selector anchored above the bar, like an IDE status-bar language picker, so the choice no longer requires opening the File menu.
- **This is not site localization.** The portfolio remains English-only. No natural-language switcher, no locale routes, no i18n, and no change to SEO language behaviour. Only the existing code-presentation mode changes.
- Both controls read and write one state from one source, `codeProfiles`: choosing Go in the File menu updates the status bar immediately, and choosing Java in the status bar shows as selected in the File menu. The existing `portfolio-language` preference is reused; no second list and no second storage key were introduced. The selectable languages are unchanged - TypeScript, C++, C#, Java, Go, Python and PHP - and JavaScript stays removed.
- The selector opens upward so it can never render below the viewport, closes on selection, Escape and an outside click, and is keyboard navigable with arrow keys, Home and End. Opening it focuses the active language without scrolling the workspace behind it, and an open menu owns Escape so dismissing it never also closes the editor tab.
- The control is reachable on phones as well: only the trailing "mode" word is dropped, and the popover is capped to the viewport so it cannot overflow at 320px.

### Engineering Notes reveal in batches

- The Notes index already used the same progressive disclosure as Projects - six notes, then six more - so nothing needed rebuilding. With six published notes nothing is hidden and no control is rendered, which is the correct state rather than a missing feature.
- The behaviour is now pinned: the visible set is always a prefix of the canonical newest-first list, never a separately sorted subset, and the batch size is gate-checked against the Projects one so the two cannot drift.
- Progressive disclosure stays presentation-only. Every note keeps its direct route, Command Palette entry, related-content links, sitemap entry and Activity presence, and Previous/Next still walks the full authored list rather than the visible subset. No pagination route or query parameter was added.

## 5.6.2 - 2026-09-15 - Raven

A patch inside the **Raven** family with exactly two fixes. No content, route, SEO or dependency change.

### System Health says what the backend measured

- Raven's health endpoint reports honest states - `operational`, `deployed`, `configured`, `degraded`, `unavailable`, `down` - but the System Health panel still rendered a binary label: operational, degraded, otherwise **Down**. Every healthy resting state appeared as an outage: GitHub proxy, Contact API and Build metadata (`deployed`), and Contact protection (`configured`).
- Labels and visual tone now come from one mapping in `frontend/src/features/diagnostics/healthStatus.ts`. Operational is positive. Deployed and Configured are informational: healthy, but a lesser proof than operational, so they look neither like a pass nor like a failure. Degraded is a warning, Unavailable and Down are errors, and anything missing or unrecognised is Unknown - never Down.
- The backend vocabulary is unchanged. Nothing is upgraded to `operational` to look greener.
- The label always names the state, so colour is never the only signal, and status text meets WCAG AA in both themes. Measuring it exposed the existing light-theme green and a new amber rendering below 4.5:1 on 9px text; both were darkened.

### Section scroll restoration without re-snaps

- Opening `/notes` or `/case-studies`, Browser Back to them, and returning Home to a tab's section used to re-apply the section's absolute position at 60, 220, 500 and 900ms. An absolute re-snap cannot tell layout movement from navigation it did not start, and the race made the case-study scroll-restore browser test fail intermittently in CI, blocking a production deploy until the job was re-run.
- Placement now runs as a bounded stabilization transaction in `frontend/src/lib/sectionStabilizer.ts`. The section is placed, the placement is confirmed over its first frames, and then a ResizeObserver on the elements that can move the section compensates by exactly the measured movement. Wherever the viewport sits relative to the section is preserved, so find-in-page, screen-reader navigation and in-page anchors are no longer pulled back.
- Native scroll anchoring is switched off only while a transaction runs, so the browser and the compensation never correct the same change twice.
- A transaction ends after a quiet period or a hard ceiling, on wheel, touch, pointer or navigation-key input (typing in a field does not count), when a dialog opens, or when a new section navigation replaces it. It always removes its observer, animation frame, timers and the `data-section-settling` attribute.
- Placement confirmation covers a case the old timers hid: pressing Back while the note view's smooth scroll to the top is still animating let one more animation step land after placement, leaving the section 20-50px off.
- An earlier approach cancelled stabilization from `scroll` events. It was discarded before release: the application's own smooth scrolls emit the same events, and Browser Back restoration went from 16/16 passing to 8/8 failing.
- Opening an Engineering Note now jumps to its beginning instead of animating there. The whole view is replaced, so the animation only scrolled through content that was already gone, and pressing Back while it was still running let one more animation step move the restored Notes index 20-50px after placement.

### Closing a case study returns to the editor it was opened from

- A case study opened from a note - through Continue exploring, the Command Palette or any other link - switched the editor to the Home tab. Escape and Browser Back then restored the note's address and scroll position but left Home active, with the note tab still open and its content hidden. This was already present in 5.6.1; it is a restoration correctness fix, not a new feature.
- The case-study origin now records the covered editor tab and document title alongside the address, section and scroll position. Opening a case study from a view keeps that view's tab active behind the dialog, and closing it by Escape, the close control or Browser Back restores the tab, section, title and position through one shared path. Home is used only when there is no covered editor, such as a directly loaded case-study address.
- The mechanism is the same for every origin: Home, a project, a note or the Command Palette.

### Release provenance record

- v5.6.1's history was recreated after release to remove a commit-message trailer. Production merge `6a10b38` became `7ed1b03` with the same tree, signed tag `5.6.1` was moved from tag object `409dccf` to `db65c8e`, and production was rebuilt from `7ed1b03` while still reporting 5.6.1. The code was equivalent; the commits and tags were not. The tag is not moved again, the full record is in `docs/DEPLOYMENT.md` §14.1, and published commits and tags are now permanent by rule.

## 5.6.1 - 2026-09-14 - Raven

A content release inside the **Raven** family: one client case study and two Engineering Notes, wired into the relationship graph that already exists. No architecture, UI or SEO redesign, and no new dependency, API or runtime behaviour.

### Hirava, published as a client case study

- **Hirava** is a trust-driven recruitment marketplace connecting companies with professional recruiters: companies post hiring requests, verified recruiters submit a capped number of structurally evaluated candidates, and the model is a success fee rather than a resume subscription.
- The published status is explicit. The **frontend is implemented** and reachable as a development preview at `https://hirava.osameh.dev`; the **Go backend is planned and not built**. Nothing in the case study describes an API, a database, authentication, KYC, scoring or payments as operational.
- The verified current stack - Nuxt 3.17.6 in Nuxt 4 compatibility mode (`future.compatibilityVersion: 4`), Vue 3.5, TypeScript in strict mode, Tailwind CSS 3.4, Pinia, TanStack Query, and Nuxt i18n with Persian as the primary right-to-left locale - was read from the project's own `package.json`, `nuxt.config.ts` and documentation, not inferred from the rendered site. The installed package is still Nuxt 3, so the framework is never described as Nuxt 4; it runs with Nuxt 4 behaviour and defaults enabled. The planned stack - Go on Fiber, PostgreSQL, Redis, MinIO - is named separately as planned, and every product rule the frontend models, including the five-candidate submission cap, is described as a rule the future backend must enforce rather than one enforced today.
- The live URL is a temporary preview, so the case study's live link is labelled **Open live preview** instead of the shared "Visit live site" wording. That is the only interface change in this release: one optional per-case-study label.
- Marketing figures visible on the Hirava preview - company counts, recruiter counts, a retention percentage - are prototype presentation content and are excluded from every claim in this portfolio.
- Published case studies now lay out in two columns and collapse to one at 1000px, the same breakpoint the Notes index already used. The grid was pinned to a single 720px column while only one case study existed, which left every later case study on a row of its own.
- Engineering Notes are authored newest first. The array in `notesData.ts` is the one order the index, adjacency, the Command Palette and the Terminal all read, so the order is visible in the diff rather than produced by a runtime sort.
- Continue exploring inside a case study now shares the modal's inline padding instead of running edge to edge.

### Two Engineering Notes

- **Architecting Hirava: A Two-Sided Recruitment Marketplace in Nuxt 4 Compatibility Mode** - separating companies and recruiters into distinct product contexts, modelling the hiring pipeline as a state machine, defining an API boundary that stays uncalled, and using mock data without letting the product depend on it.
- **Designing trust into hiring workflows** - candidate caps as a system constraint, structured evaluation with required negatives, verification that gates the action rather than the account, scoring that resists vanity, and an explicit split between what the frontend models and what the backend must guarantee.

### Discovery, unchanged mechanics

- The case study names both notes and both notes name the case study, so **Continue exploring** resolves them deterministically through the Null relationship model, capped at three.
- Both notes enter the engineering timeline through the existing Raven activity pipeline on their published date. No activity entry is hardcoded and no event is duplicated.
- Command Palette, Terminal (`notes`, `cat note <slug>`, `case <id>`) and search pick the new content up from the same data, with no new search surface.
- The sitemap grows from 17 to 20 canonical documents: two Note documents and one client case study. Client case studies already have independent canonical, indexable routes, so Hirava follows that existing contract rather than introducing a URL class.

## 5.6.0 - 2026-09-13 - Raven

First release in the **Raven** family. Every 5.6.x patch inherits the codename. The theme is engineering trust and live signals: everything important should leave a signal, and no signal should claim more than it can prove.

### Honest status semantics
- A status label now describes exactly what was measured. A check whose only evidence is that a file exists reports `deployed`, never `operational` - presence is not behaviour. Contact protection reports `configured`, which is what can be proven without spending a verification.
- Removed the `origin` check. It reported a constant `operational` with the detail *PHP runtime responding*, which the existence of the response already proves; a check that cannot fail is not a check.
- GitHub credential acceptance is now tri-state. `true` means GitHub accepted this environment's credential, `false` means there is none or it was rejected, and `null` means acceptance is unknown - a transport failure, timeout or upstream 5xx. Previously an unreachable GitHub still reported `authenticated: true` on the strength of the token merely existing, which is the same class of error the probe was originally built to remove.
- The deployment workflows accept the new vocabulary, so an honest status cannot fail a deploy gate written against the old wording.

### Release and content integrity
- Added deterministic gates for the canonical technology registry, fallback project data, this repository's `portfolio.json`, content relationships and release metadata. Every one is proved from files in this repository; none contacts a third party, because a gate that depends on a remote service fails for reasons unrelated to the change under test.
- Release metadata is validated against `config/releases.json` as the single source of truth: every live family, historical release and reserved family is exercised through the resolver, so activating a family no longer requires editing a hand-written list of test cases.
- README release history is checked for the latest six, newest first, with no duplicates and no version missing from the changelog.

### Provenance
- The build records the exact source commit it was built from, and Build Information shows the short SHA linked to its public GitHub commit page. Staging and production each link to the commit actually deployed there.
- No release link is shown: the signed tag and GitHub Release are created only after production acceptance, so a bundle can never guarantee the tag already exists.

### Freshness and activity
- Projects display their curated lifecycle - Active, Stable, Maintained or Legacy - authored in each repository's `portfolio.json`. Nothing is inferred from repository dates, because `updated_at` moves when a description or a star changes and cannot stand in for code freshness. A project without that metadata shows no lifecycle rather than a guess.
- Recent activity became an engineering timeline. Published releases and Engineering Notes rank above routine repository pushes, a GitHub release already documented locally is not shown twice, and ordering is fixed by date, then priority, then id. No commit is scored for importance.
- A GitHub outage degrades the timeline instead of emptying it: local releases and notes remain, with a short note that repository activity is unavailable.

### Trust in the client
- An already-open tab is told, once and quietly, when a newer build has taken control, with a Reload button and no forced refresh. A first-time visitor is never shown it, because a first installation is not an update.
- The Source Explorer distinguishes a repository with no previewable files from a tree that could not be loaded.

### Unchanged
- The editor tab lifecycle, Notes navigation and TOC, Null's canonical technology model, filter URL contract, skill provenance and related-content ranking, the Command Palette, Terminal, branded HTTP errors, the `/api/` JSON contract, Service Worker network-only, reCAPTCHA lazy-loading, the 17-URL sitemap, canonical strategy, favicon, Open Graph image and CDN-owned HSTS.
- No new runtime dependency, no polling, no telemetry, no monitoring backend.

## 5.5.0 - 2026-09-12 - Null

First release in the **Null** family. Every 5.5.x patch inherits the codename. The theme is *zero dead ends*: when a visitor finds one useful thing, the next relevant thing should be reachable.

### Technology identity
- Technology names now resolve through one canonical registry. The same platform arrived from four places with four spellings - GitHub's lowercase topics, a repository's `portfolio.json` stack, the skills catalog and the capability cards - which produced eighty project-filter commands in the Command Palette, six of them Android.
- Filtering, related content and skill evidence all match on canonical keys, while displayed labels are unchanged: a project listing `Nuxt 3` still reads `Nuxt 3`.
- Related but distinct technologies are kept distinct. `C# / .NET` resolves to both C# and .NET rather than collapsing into one, and the same is true of `Qt / QML` and `Nuxt/Vue`.
- Descriptive `portfolio.json` concepts are no longer offered as filters. They remain real metadata; they were simply never something to filter projects by.

### Evidence
- Skills now carry provenance: public work, professional, or freelance, and may carry several. There are no percentages, proficiency bars, scores or invented years.
- A skill links to projects only when a public repository genuinely demonstrates it. A professional-only skill renders as plain text naming its evidence rather than linking nowhere - C++ and Qt are real professional experience with no public repository behind them, and the portfolio now says so instead of implying otherwise.
- A test enforces the promise: every public-work claim must resolve to a real project, and no professional-only skill may claim one.

### Discovery
- Projects, Engineering Notes and client case studies end with a short **Continue exploring** block: at most three suggestions, each naming why it appeared.
- Ordering is deterministic - explicit relationship, then same repository, then case-study relationship, then shared canonical technology, then adjacent note order. No personalization, no randomness, no recommendations.
- Notes and client case studies gained optional explicit relationship fields; manual relationships stay authoritative over any derived match.
- The two different things called *case study* are now distinct in code: `ClientCaseStudy` is the client engagement, while the per-repository narrative remains the project deep-dive. No visible wording changed.

### Filters
- The project technology filter now lives in the URL as `?stack=<key>`, so a filtered view can be shared, restored on a direct load, and undone with Back or redone with Forward.
- Filter state is a query parameter on the existing document, not a new route. No new indexable URL class is introduced, the sitemap stays at 17 URLs, and the canonical is unchanged.
- The zero-result state, which already existed, now clears the URL as well as the filter and names the filter that matched nothing.

### Metadata
- Removed two superseded claims from this repository's own `portfolio.json`: *Internationalization architecture*, contradicted by the deliberately English-only product contract in its own README, and *Universal search*, superseded when the search surfaces were consolidated into one Command Palette in v5.1.0. Historical changelog entries that describe them are untouched.

### Unchanged
- The editor tab lifecycle, Notes Previous/Next and TOC geometry, whole-card navigation, the Command Palette shortcut, Terminal, modal stack, Phantom's contrast and touch-target work, the branded HTTP error architecture, the `/api/` JSON contract, Service Worker network-only, reCAPTCHA lazy-loading, sitemap, canonical strategy, favicon and Open Graph image URL.
- No new dependency, no new GitHub API request, no search or graph library, no SSR or prerendering.

## 5.4.0 - 2026-09-09 - Phantom

First release in the **Phantom** family. Every 5.4.x patch inherits the codename. The theme is portfolio experience and UX refinement; the work is what a measured audit found, not a redesign.

### Accessibility
- Text that carries meaning now meets WCAG AA contrast in both themes. The light theme was the weaker of the two: several IDE shell labels had no light-theme rule at all and were inheriting greys chosen for a near-black canvas.
- The mobile menu button - the only navigation affordance below 720px, and previously the smallest target on the site at 20x20 - now offers a 44x44 target while the icon keeps its size.
- An editor tab can now be closed with the keyboard. The close control was an icon with a click handler: unreachable by keyboard, and 12px across. It is now a real button with its own label, focus state and expanded hit area, placed beside the tab's activation button rather than inside it.
- Compact controls in the status bar, terminal head and note breadcrumb gained full touch targets. Where the interface benefits from compact chrome, the visual element is unchanged and only the touchable area grew.
- Line numbers remain deliberately subordinate, but no longer sit at 1.7:1 against the canvas.

### Identity and metadata
- Added the official X identity: `twitter:site`, `twitter:creator`, and `https://x.com/OsamehIr` in the Person schema. No existing identity was removed.
- One description now reaches every consumer. `twitter:description` was drifting because the runtime synchronised only the page and Open Graph descriptions; it is now part of that same synchronisation, and the static document carries the same sentence, so a crawler that runs no JavaScript reads what one that does reads.

### Packaging
- Stopped deploying `og-cover-social.png`, a 717 KB authoring master that nothing referenced. The active social image, `og-cover-social.jpg`, its URL, and every preview are unchanged.

### Verification
- Contrast is now asserted from rendered pixels. The audit demonstrated that computed-CSS checks both miss real failures and invent false ones - one element computed at 2.49:1 measured 11.75:1 once the painted pixels were read.
- Added touch-target assertions at 390px covering only controls that perform an action, and a keyboard-only editor tab close test that re-asserts the full tab lifecycle.

### Unchanged
- The editor tab contract, the branded HTTP error architecture, the `/api/` JSON contract, the Service Worker network-only rule, the lazy reCAPTCHA contract, the 17-URL sitemap, canonical strategy, robots policy, favicon URLs and the Open Graph image URL are all untouched.

## 5.3.4 - 2026-09-09 - Vanta

Patch release in the **Vanta** family, correcting the mobile Engineering Note table of contents.

### Engineering Notes
- The sticky table-of-contents rail now spans the full width of the screen below 720px. It previously sat flush against the left edge with a 36px gap on the right.
- Cause: the rail cancels the reading layout's 18px side padding with negative margins to reach both edges, but an inherited `max-width:100%` resolved against the padded containing block. That over-constrained the box, so the negative left margin was honoured, the width was clamped 36px short, and the browser recomputed the right margin away. Only the sub-720px breakpoint was affected; between 721px and 1000px there are no negative margins.
- Added browser regression coverage at 320, 360, 390, 412, 600 and 719px asserting the rail reaches both screen edges and that the page still does not scroll horizontally.

## 5.3.3 - 2026-09-09 - Vanta

Stabilization release in the **Vanta** family, unifying the browser-facing HTTP error experience.

### Error experience
- Added branded IDE-style HTTP error documents for 400, 401, 403, 404, 405, 408, 429, 500, 502, 503 and 504, using the portfolio's Cyber Noir editor identity with a C++ file tab.
- Origin-generated errors now replace the hosting provider's default error template. `ErrorDocument` resolves through an internal subrequest, never a redirect, so the original URL and the original status code both survive: a forbidden request still answers 403.
- The reported defect is closed at its source. A document-level forbidden request previously fell through to the host's own error page because the origin configured no error documents at all.
- Error documents are static HTML and CSS with no JavaScript, no bundle reference and no API call, so they still render when the application runtime is the thing that failed.
- One shared, self-contained stylesheet serves all eleven documents and follows `prefers-color-scheme` without scripting.

### API contract
- API errors stay machine-readable. Apache substitutes an error document only for a response it generated itself with no body, so every application-generated JSON response is untouched.
- Backend library includes are now refused by the API's own JSON endpoint rather than by an Apache error, so a client of `/api/` receives JSON rather than an HTML document. The include is still never executed or served.
- The analytics endpoint's 405 now carries a JSON body. A bodyless status is exactly what an error document would have replaced.
- `Allow` on 405 is preserved. No `WWW-Authenticate` or `Retry-After` behaviour is invented where the application does not already emit it.

### Reliability
- Added packaging and repository guards covering error-document presence, the status shown, the `noindex` directive, the absence of scripts and bundle dependencies, foreign hosting branding, and `ErrorDocument` targets resolving to packaged files.
- Both the staging and production bundles are verified to ship the error documents.
- Both deployments now prove the two contracts against the live environment before a release can advance: a forbidden document answers 403 with the branded workspace and no redirect, and a forbidden API path answers 403 with JSON. The document probed is an existing asset directory refused by `Options -Indexes`; nothing was created in order to be forbidden.

### Search
- Every error document is `noindex,nofollow,noarchive` in both the meta tag and the response header, is absent from both sitemaps, and publishes no canonical URL. The 17-URL sitemap contract is unchanged.
- Edge-generated 502, 503 and 504 responses are produced before a request reaches this server and cannot be customised from the origin. They are documented as such rather than claimed.

## 5.3.2 - 2026-09-08 — Vanta

Patch release in the **Vanta** family, correcting GitHub health reporting.

### Portfolio experience
- Changed the default selectable portfolio code language from TypeScript to C++, with `main.cpp` as the default Home editor tab. A visitor's explicitly selected language is still preserved, and an unusable stored value now falls back to C++.

### Health & observability
- The GitHub readiness probe now authenticates with the current environment's own token, matching the credential the GitHub proxy actually uses.
- `authenticated` now means GitHub accepted that credential. It previously meant only that a token string was present in configuration, so a revoked or expired token still reported as authenticated while every live GitHub feature failed.
- Reach and credential are now reported as separate facts: an unreachable upstream no longer implicates the credential, and an anonymous rate limit is no longer mistakable for a rejected one.
- Preserved separate production and staging credentials with no cross-environment fallback.
- Added deterministic coverage for probe decisions, header construction and environment token isolation.

## 5.3.1 - 2026-09-08 — Vanta

Stabilization release in the **Vanta** family.

### Navigation
- Project, Engineering Note, and Case Study cards are now navigable across their whole surface, not only through their explicit action link.
- The card's primary destination stays a real link, so modified clicks, new-tab actions, copy-link and keyboard activation keep working, and secondary controls such as Compare, npm and a client's live site keep performing their own action.

### Configuration & isolation
- Private configuration now resolves through one authoritative path: the `private/` directory beside the environment's own document root, and nothing else.
- Removed the shared `$HOME` lookup that three server files still carried. Both environments run as the same operating-system user, so that path was a route from one environment's code to the other's credentials.
- A missing, unreadable or malformed configuration file now fails closed and can no longer surface a PHP warning carrying the server's filesystem path.

### Health & observability
- `/api/health` now reports whether contact verification is configured, and Contact is reported unavailable when it is not - previously Contact could read operational while submissions were failing closed.
- Health also reports whether the GitHub proxy is running authenticated. No token, secret, prefix, length or scope is exposed.
- Staging and production deployments now fail if the deployed environment cannot report a configured, operational contact path.

### Architecture
- Extracted persisted workspace preferences and the repository README/gallery content layer out of the application shell.

### Search readiness
- Published the approved Neural Cipher favicon at a stable, never-hashed root path and declared it in the initial HTML.
- Added repository and bundle checks for homepage metadata, canonical URL, favicon declarations, sitemap membership, and the absence of the pre-portfolio hosting placeholder text.
- Search Console remains manually managed, and SSR/prerendering remains deferred.

## 5.3.0 - 2026-09-08 — Vanta

First release in the **Vanta** family. Every 5.3.x patch inherits the codename.

### Architecture
- Separated frontend and backend source into `frontend/` and `backend/` trees. The public runtime contract is unchanged: the deploy artifact is still `dist/` mirrored into the document root, and every API URL stays at `/api/...`.
- Reorganized the frontend by responsibility: an application shell with its own tab, section and preference model; one directory per product surface under `features/`; and shared infrastructure under `lib/` that knows nothing about features.
- Decomposed the mixed-responsibility `AdvancedUI` module into eleven feature modules, and moved the application shell's module-scope model out of `App.tsx`.
- Grouped backend code into API entrypoints, internal library includes, per-route metadata layers, server configuration and tests. Library includes are published outside the API path and refused over the web.
- Removed the superseded `src/`, `app/`, `public/`, `vendor/` and `tests/php/` top-level directories, and added quality gates that fail if they reappear or if either tree starts depending on the other.

### Engineering Notes
- Added Previous/Next navigation between published Engineering Notes.
- Added native crawlable adjacent-note links, so modified clicks, new-tab actions, copy-link and keyboard activation behave like ordinary links.
- Preserved the IDE tab lifecycle and deep-link behavior: an adjacent Note opens as an editor tab, an already-open Note is activated rather than duplicated, and other Project and Note tabs are untouched.
- A Note reached from its neighbour opens at its own beginning instead of inheriting the previous article's scroll position.

### Contact security
- Added Google reCAPTCHA v3 protection to server-side contact/email submission.
- Added environment-specific production and staging site keys, selected by exact hostname, alongside private server-side secrets that never reach the repository or the build.
- Added server-side `success`, `action`, `hostname` and score verification against Google, with a single configured minimum score.
- Preserved rate limiting and fail-closed mail behavior: no accepted verification means no message is handed to the mail service.
- Added distinct verification, sending, success and failure states with an accessible live status region.

### Security & reliability
- Added deterministic reCAPTCHA validation coverage in PHP and browser coverage with a mocked `grecaptcha`.
- Added secret-leakage safeguards across the repository, the tested bundle and both packaged environment bundles.
- Preserved a strict Content-Security-Policy with only the minimal reCAPTCHA script and frame origins added; no `unsafe-eval`, no inline scripts, no wildcard hosts.
- Preserved the Service Worker contract that `/api/*` is never intercepted or cached.

## 5.2.3 - 2026-09-07 — Cipher

Patch release in the **Cipher** family, correcting GitHub README asset resolution.

### Fixed
- README assets whose paths contain spaces or existing percent escapes are now encoded exactly once. A second encoding pass previously turned `%20` into `%2520`, so those images returned HTTP 404.
- A README image hosted on another account's `raw.githubusercontent.com` path is no longer rewritten onto this repository. Any well-formed raw URL now keeps its own owner, repository and ref; only genuinely prefix-less legacy paths are still repaired.

### Added
- Path normalization that is idempotent by construction and covers Unicode filenames, literal percent characters, reserved characters, malformed escapes, and encoded slashes, which are never promoted into path structure.
- A repository quality gate and browser regression coverage for README asset and link URLs.

## 5.2.2 - 2026-09-07 — Cipher

### SEO discovery

- Project, Engineering Note, and Case Study cards now expose native crawlable links while preserving SPA navigation and editor-tab behavior.
- The hero's **Explore my work** link now navigates reliably to the Projects route from every section deep link.
- The static and dynamic sitemaps now list only independently indexable detail documents whose canonical intent matches the submitted URL.
- WebSite structured data now identifies the site concisely as **Osameh Irandoust**, with **osameh.dev** as its alternate name; the existing Person entity and verified profile links remain unchanged.

### Accessibility

- Replaced interactive `article role="button"` project cards with structural articles and native links.
- Corrected the hero showcase heading level and targeted failing dark-theme secondary-text contrast.
- Corrected activity timeline secondary text to meet WCAG AA contrast requirements.
- Replaced the status pulse's paint-heavy box-shadow animation with compositor-safe opacity and transform.

### Loading performance

- Core project cards now render immediately from local portfolio data instead of waiting for the GitHub repository request.
- Live GitHub metrics continue to enhance project cards asynchronously with stable neutral values while unresolved.
- Staging tests now derive runtime environment state, fixture volatile GitHub data, and wait on meaningful async UI state.

### Search readiness

- Production indexability and staging noindex protections remain unchanged.
- SSR and prerendering are intentionally deferred while Google Search Console collects indexing evidence.

## 5.2.1 - 2026-09-06 — Cipher

Patch release in the **Cipher** family, consolidating post-5.2.0 reliability work.

### Fixed
- The Build Information panel no longer assumes it is running in production while the runtime environment is still being read. Opening the panel on a slow connection previously showed **PRODUCTION BUILD** for a moment before correcting itself, and a failed metadata request left the same incorrect label in place. The environment is now shown only once it is actually known, and stays neutral otherwise.
- The System Health panel no longer reports a guessed environment before the health endpoint responds.

### Changed
- **HSTS is owned solely by the ParsPack CDN edge.** The origin no longer emits `Strict-Transport-Security`, removing the duplicate header that previously appeared alongside the edge value on error responses.
- Staging and production now occupy separate document roots with separate, directory-scoped FTP accounts. Production deployment mirrors destructively, so filesystem isolation is a deployment safety contract rather than a convention.

### Added
- A quality gate that fails the build if an origin HSTS directive is reintroduced into `.htaccess`.
- Regression coverage proving the Build Information panel never reports production while the environment is unresolved, on a delayed response, on a production response, and on a failed request.

## 5.2.0 - 2026-09-06 — Cipher

First release in the **Cyber Noir** codename line.

### Added
- **Neural Cipher visual identity.** A new brand mark replaces the previous monogram across the header, and a complete icon pack ships for favicons, Apple touch, PWA install, and in-app use.
- Release **codenames**. A codename identifies a release family, so every patch in the family inherits it: 5.2.0, 5.2.1 and later 5.2.x releases are all **Cipher**. The current release and its codename now appear in the status bar, Build Information panel, and Terminal.
- The Resume Viewer carries the Neural Cipher mark in its profile block.

### Changed
- Favicons now use a multi-size `favicon.ico` plus 16/32/48 px PNGs, replacing the previous monogram favicon.
- The PWA manifest installs the new 192 px and 512 px icons.
- Social sharing artwork was refreshed; the 1200x630 card remains the canonical Open Graph and Twitter image.
- Editor tabs scroll the active tab into view automatically. On narrow screens an activated tab could previously sit outside the visible strip and had to be found by hand; the strip now scrolls only when the tab is not already fully visible, and respects reduced-motion preferences.

### Fixed
- The deployment bundle no longer ships icon authoring assets (design source, 1024 px master, duplicate variants), removing roughly 5 MB from every deploy.

## 5.1.1 - 2026-09-05

### Fixed
- A **GitHub Source Explorer** file that cannot be loaded no longer leaves the panel stuck: the repository tree stays usable, the failure is reported in place with a retry action, and selecting another file recovers immediately.
- A slow or failed source request can no longer overwrite a file the reader has since selected; each request is now matched to the selection that started it.
- Corrected **Service Worker** response handling. A cached copy is now taken before the response body is consumed, which removes the `Failed to execute 'clone' on 'Response'` error, and a failed cache write can no longer disturb an otherwise successful request.
- **Recruiter Mode** tour is usable on mobile. The panel stays inside the viewport with symmetric margins at 320-412px widths, the footer no longer wraps its navigation off-screen, and the close button, progress bar, and Back/Next actions stay reachable.
- Unknown URLs now return a real **HTTP 404** while still rendering the custom IDE-style 404 workspace, instead of answering 200 for a page that does not exist. Invalid Engineering Note, Case Study, and project routes return 404 as well.
- Closing a project now returns to the **Projects** section of the workspace instead of an arbitrary position, matching how closing an Engineering Note already returned to Notes.
- Editor tabs behave consistently for every view type. Projects and Engineering Notes can now be open side by side as independent tabs, and selecting Home no longer closes the Note or project you were reading — it simply switches to Home and restores the section that tab belongs to.
- Closing an editor tab now activates the tab to its left rather than jumping to Home, and closing a tab you are not currently viewing no longer changes which tab is active.
- The build-information panel reports the environment it is actually running in, so staging identifies itself as **staging** instead of always reading production.

### Security
- Repository source paths are validated by normalized path segments. A leading dot is treated as an ordinary directory name, so `.idea/`, `.github/`, and `.vscode/` files remain previewable, while traversal, absolute paths, protocol injection, and control characters are rejected. The path is no longer decoded a second time after the server has already decoded it, which also stops a literal `%` in a filename from being corrupted.

### Changed
- The Service Worker leaves `/api/` requests entirely to the network, so a transient GitHub failure or rate-limit response can never be replayed from cache.
- Source Explorer availability was verified end to end after an edge cache configuration change corrected the handling of client query strings. The Source Explorer outage was caused by that edge behaviour, not by the application's repository path validation, which had always accepted dot-prefixed directories.
- 404 responses are sent with `Cache-Control: no-store` so an invalid route is never cached by the browser or the CDN.

## 5.1.0 - 2026-09-02

### Added
- Dedicated right-click context actions for **Engineering Notes** and **Case Studies**, including open, copy/share-link, and live-site actions where appropriate.
- Terminal commands for `activity`, `case-studies`, `case <id>`, `capabilities`, `palette`, `mood:list`, availability/mood status, and Accessibility controls so the v5 product layer is reachable from the IDE terminal.

### Changed
- Consolidated the site-wide ranked search experience into a single **Command Palette** surface with one `Ctrl/Cmd + Shift + P` shortcut; the redundant application-level `Ctrl/Cmd + K` alias was removed.
- Standardized Header utility controls to one 34px control height, including **Install app**, Command Palette, Accessibility, and Portfolio Mood actions, with explicit icon/label vertical centering.
- Portfolio Mood now shows the full active availability message in the Header (for example, `Open to selected opportunities`) instead of a shortened status word.
- Portfolio Mood CLI output now distinguishes the preset key, short label, and full public Header label without duplicating availability configuration.
- Documented the exact Vite 8 runtime floor: Node.js >=20.19.0 or >=22.12.0; CI remains on Node.js 22.
- Scroll behavior is unified across the IDE: transparent tracks, low-opacity thumbs that become fully visible on hover, no permanent scrollbar gutters, and measured native-width compensation so modal cards keep equal visual left/right spacing.

### Fixed
- Closing a Case Study now restores the exact covered workspace without scheduling a later section-03 scroll; delayed initial route timers were removed, the pre-modal position is restored explicitly, and real wheel/touch/pointer/keyboard navigation cancels stale section-restoration work.
- Browser Back from an open Case Study restores the canonical Case Studies index anchor, while Escape/close preserves the exact covered workspace position.
- Added `/activity` to first-class Apache routing and both sitemap implementations so direct GitHub Activity navigation and SEO discovery match the SPA.
- Allowed the exact staging origin to exercise the Contact API without weakening the production/staging allowlist or accepting arbitrary origins.
- Project context-menu Gallery navigation now targets the rendered repository-name identifier instead of the unrelated numeric repository ID.
- All dialog consumers now share Escape close, focus trapping, focus return, background locking, and deterministic scroll restoration behavior.
- Modal chrome now stays edge-to-edge across feature, diagnostics, resume, compare, and Recruiter Mode dialogs; title dividers/progress lines no longer stop short because of a reserved right scrollbar gutter.
- Explicit semantic Light Theme surfaces now cover Case Study, capability, Accessibility, Availability, and Command Palette surfaces consistently with the 4.2 redesign, without transient dark-to-light card interpolation.
- Removed an accidental duplicate local declaration in project-tab close logic and expanded regression coverage around route-anchor restoration, modal scroll restoration, header sizing/centering, context menus, modal gutter symmetry, mobile Gallery pinning, and Light Theme stability.

## 5.0.0 - 2026-09-02

### Added
- Published **Freelance / Client Case Studies** with stable deep links, crawler metadata, structured data, sitemap coverage, and live-site links. **Amorella Beauty** is the first public client case study.
- A separate **What I can build** capability layer for real-time communications, business-platform modernization, and marketplace/mobile product delivery, without presenting capability examples as named client work.
- A five-state **Portfolio Mood** system for availability: `open`, `selective`, `freelance`, `focused`, and `unavailable`. One repository-owned `config/availability.json` value drives the header status, Availability modal, Terminal/Search metadata, CTA behavior, opportunity types, work modes, and timezone.
- Local mood commands (`npm run mood -- <preset>` and `npm run mood:list`) plus a manual **Set portfolio mood** GitHub Action that updates `develop` and follows the normal staging verification flow before production promotion.
- `availabilityMood` in generated `build-info.json` so the deployed mood can be verified independently on staging and production.
- **Accessibility Control Center** with persistent Reduce Motion, Increased Contrast, Larger Text, and Enhanced Focus preferences, including operating-system reduced-motion support and accessible switch semantics.
- Ranked **Universal Search** across navigation, projects, Engineering Notes, published case studies, capabilities, skills, experience, and portfolio settings, available from a visible header action and the conflict-safe `Ctrl/Cmd + Shift + P` shortcut.
- Terminal integration for case studies, GitHub Activity, availability/mood status, and accessibility controls.

### Changed
- Extended the v4.2 semantic Light Theme system to all v5 surfaces, including Case Studies, capability cards, Portfolio Mood/Availability, Accessibility, Universal Search, dialogs, interactive states, and focus treatments.
- Explorer and Outline navigation now follow the document sequence consistently: Projects → Case Studies → Experience → GitHub Activity → Now → Changelog → Engineering Notes.
- GitHub Activity is now a first-class navigation destination in the left-side workspace navigation instead of being reachable only by scrolling the page.
- Availability is managed as operational portfolio state rather than duplicated UI copy, so one mood change updates every relevant surface consistently.
- Staging and production deployment remain fully isolated: `develop` uses only the five `STAGING_FTP_*` secrets, `main` uses only the five production `FTP_*` secrets, and both deploy only after the reusable quality workflow has passed and produced the tested artifact.

### Security
- Published case-study content is limited to client work that is safe to identify publicly. Capability cards are explicitly separated from client claims, and no private metrics, secrets, deployment credentials, or confidential implementation details are exposed.
- The existing private GitHub API token boundary, staging `noindex` behavior, CSP, API protections, and environment-specific deployment-secret isolation remain intact.

## 4.2.2 - 2026-09-02 — Specter

### Fixed
- Hardened the Engineering Notes light-theme contrast regression selector and visibility assertion used by the browser quality suite.

## 4.2.1 - 2026-09-02

### Fixed
- Tightened light-theme Skills Preview contrast checks.
- Kept the mobile project Gallery quick-access item fully visible when it becomes active at the end of the document.
- Returning from Engineering Notes bypasses smooth scrolling for deterministic restoration.

### Changed
- Expanded browser regressions around light-theme contrast and mobile project-navigation visibility.

## 4.2.0 - 2026-09-02

### Changed
- Rebuilt Light Theme around semantic canvas, surface, text, accent, and border behavior across the IDE shell.
- Redesigned the light Hero/workbench treatment and unified light styling for projects, Notes, Recruiter Mode, 404, compare, command surfaces, modals, and navigation states.
- Improved hover, selected, focus, and disabled-state contrast across primary interactive surfaces.

## 4.1.1 - 2026-09-02

### Fixed
- Engineering Note close and browser Back navigation now restore the exact Engineering Notes anchor only after the portfolio DOM has committed, eliminating the mixed Changelog/Notes landing position.
- Browser history scroll restoration is controlled by the SPA while mounted so native history restoration cannot overwrite the final Notes position.
- Engineering Note TOC selection stays pinned to the clicked destination during smooth scrolling and resumes live scroll-spy tracking after the jump or any manual wheel, touch, pointer, or keyboard navigation.
- TOC heading lookup is scoped to the active note article and duplicate generated heading IDs are de-duplicated, preventing unstable selections and accidental jumps.
- Header PWA install/download action no longer wraps with the availability label and its Lucide icon uses explicit block/flex centering on desktop, tablet, and mobile.

### Changed
- Mobile/tablet Engineering Note TOC automatically keeps the active chip visible inside its horizontal scroller without moving the document itself.
- Expanded Playwright coverage for repeated TOC jumps, manual scroll-spy updates, exact note-return positioning, and browser Back behavior.

## 4.1.0 - 2026-09-01

### Added
- Six-at-a-time lazy rendering for the Engineering Notes index, ready to scale as the article library grows.
- Scroll-synchronized Engineering Note table of contents with persistent selected state and reliable heading jumps.
- Mobile project bottom navigation derived from the existing project quick-access sections.

### Fixed
- Returning from an Engineering Note now restores the beginning of the Engineering Notes section instead of landing at an offset scroll position.
- Removed the gray backing exposed by the incomplete final row in the System Health check grid.
- Release graph hover no longer replaces the detail panel; the panel now follows the explicitly selected release node.
- Improved mobile modal overflow so large dialogs remain capped and internally scrollable rather than taking over the whole viewport.
- Centered compact download/install controls and improved narrow-screen source/editor status layouts.

### Changed
- Audited light-theme contrast across Recent GitHub Activity, Notes, Source Explorer, Health Center, Changelog, modals, and interactive controls.
- Tablet/mobile Engineering Note navigation becomes a horizontally scrollable sticky TOC instead of disappearing.
- Responsive layouts now reserve space for the mobile project bottom navigation and reduce oversized typography/padding on narrow screens.
- Expanded Playwright regression coverage for note navigation, viewport-capped diagnostics, mobile project quick access, and light-theme controls.
- Lighthouse preview readiness retries are now silent until a real timeout/failure, avoiding misleading transient curl errors in CI logs.

## 4.0.0 - 2026-09-01

### Added
- Dynamic project structured data using `SoftwareSourceCode` / `SoftwareApplication` plus breadcrumb markup.
- Dynamic `sitemap.xml` generation from live public repositories and engineering notes, with a static fallback sitemap.
- `develop` → `staging.osameh.dev` deployment channel with staging-specific `noindex`, `nofollow`, and `noarchive` protection.
- Repository quality gates for metadata, notes, PHP lint, TypeScript, built-file verification, browser E2E smoke, accessibility checks, and Lighthouse SEO/accessibility/best-practices thresholds.
- Live `/api/health` endpoint and an expanded System Health Center with safe dependency checks and client-to-origin latency history.
- Engineering Notes section with Markdown-backed articles, deep links, table of contents, code-copy controls, tags, reading time, sharing, Terminal integration, and Command Palette integration.
- Note-specific `TechArticle` and breadcrumb structured data for `/notes/<slug>`.

### Changed
- Production deployment now runs repository quality checks, PHP linting, deployment-bundle verification, and browser smoke tests before FTPS upload.
- `portfolio.json` now advertises staging, quality gates, dynamic SEO, health checks, and engineering notes as first-class project capabilities.
- System Diagnostics is now a live privacy-safe operational health view rather than a mostly local client snapshot.

### Security
- Staging responses are explicitly excluded from indexing.
- Health diagnostics expose only operational status, safe labels, build metadata, and latency — never secrets, raw filesystem paths, IPs, or credentials.
- Project and note deep links preserve the existing noindex behavior for invalid soft-404 routes.

## 3.1.1 - 2026-09-01

### Fixed
- Aligned the `RELEASE GRAPH / LIVE HISTORY` label with the explanatory text in the changelog intro by overriding the inherited global eyebrow top margin only inside that panel.
- Fixed Source Explorer status-bar clipping so language, file size, and line count remain vertically centered and fully visible.
- Added subtle status separators that remain consistent in dark and light themes.

## 3.1.0 - 2026-09-01 — Shadow

### Added
- Pointer-responsive parallax for the custom engineering showcase on the home screen.
- Animated hero counters for production experience, public repositories, and engineering focus modes.
- Mini-terminal readiness pulse inside the hero Build Rhythm panel.
- Programming-language-aware Stack Surface cards that react to the existing language preference.
- Explicit source-file loading skeleton and status before code rendering.

### Fixed
- Source Explorer left repository tree now keeps its own visible scroll area for long file trees.
- Project quick-access rail is visually masked behind the icon pads so the vertical line never cuts through toolbar icons.

### Changed
- Refined hero motion for reduced-motion preferences and responsive layouts.
- Synchronized README release notes with the hero redesign and current repository-intelligence release history.

## 3.0.5 - 2026-09-01

### Changed
- Replaced the generic hero orbit on the home screen with a custom engineering showcase panel.
- Redesigned the right side of the opening section into a layered snapshot of workflow, impact metrics, stack surface, and shipping rhythm.
- Tuned the hero layout for both dark and light themes and improved the first impression away from template-like visuals.

## 3.0.4 - 2026-09-01

### Fixed
- Command Palette technology-filter actions now scroll directly to the project search/filter controls instead of stopping at the Featured/Recruiter shortlist.

### Added
- Terminal ghost autocomplete preview. Typing a partial command such as `he` shows the remaining `lp` in muted text before the user presses Tab.
- Existing Tab/Shift+Tab completion cycling remains available for commands, projects, services, and search terms.

## 3.0.3 - 2026-09-01

### Added
- Terminal Tab autocomplete with forward/backward cycling for commands, repositories, service destinations, and technology search terms.
- Technology-aware Command Palette entries for fast project filtering.

### Fixed
- Source Explorer code panes now keep their own vertical and horizontal scroll areas instead of clipping long files to the visible viewport.
- Project quick-access selection now follows natural scrolling reliably and remains selected during smooth toolbar navigation.
- Terminal search now indexes repository `portfolio.json` metadata, stack, recruiter skills, and project content, so searches such as `Docker` and `WPF` resolve correctly.
- Command Palette project search now uses the same repository metadata index.

## 3.0.2 - 2026-09-01

### Added
- Floating project quick-access rail for Overview, README, Metadata, Metrics, Case Study, Architecture, Source, and Gallery.

### Fixed
- Source Explorer request lifecycle so a successful repository-tree response can no longer remain stuck on `Loading repository tree…`.
- Featured project cards now expose project context to the custom right-click menu.
- Changelog graph panels now share the same height and scroll independently, keeping release details visible while browsing older history.
- Changelog version labels no longer overlap release titles.

### Changed
- Increased Recruiter Mode typography, progress/navigation visibility, and dark-theme contrast.
- Applied a readability pass to repository metadata, architecture, source explorer, and featured-project microcopy in both themes.

## 3.0.1 - 2026-09-01

### Added
- Interactive changelog release graph with focusable version nodes and a dedicated detail panel.
- Lazy-loaded archive behavior: the latest five releases render first, with an animated control to reveal or collapse older versions.

### Changed
- Redesigned the changelog from static release boxes into a graph/timeline experience better matched to the IDE-style portfolio UI.
- Hovering, focusing, or clicking a release node now updates the release details panel without moving the user away from the changelog section.

## 3.0.0 - 2026-09-01

### Added
- Repository-owned `portfolio.json` loader backed by the canonical `portfolio.schema.json`.
- Featured-project shortlist driven by `project.featured` and `featuredOrder`.
- Guided Recruiter Mode with project-specific skills, talking points, role, and direct project navigation.
- Per-project architecture viewer rendered from `architecture.nodes` and `architecture.edges`.
- Same-origin GitHub Source Explorer with repository tree browsing, entry points, file search, code preview, basic syntax highlighting, copy, and GitHub deep links.
- Live project metrics with language percentages, repository size, license, update signals, and latest release data.
- New GitHub proxy endpoints for project metadata, metrics, source trees, and source files.

### Changed
- Project names, taglines, type, lifecycle, ownership, responsibilities, stack, case studies, recruiter content, and SEO can now come directly from repository metadata.
- Project search and technology filtering include richer `portfolio.json` stack metadata.
- The public `osameh.dev` repository is included in the embedded fallback project set.
- Project deep-link metadata uses repository `portfolio.json` SEO fields when available.

### Security
- Source Explorer requests are restricted to repositories already exposed by the portfolio.
- Source paths reject traversal, generated/dependency trees, configured exclusions, binary content, and files above each repository's preview limit.
- GitHub credentials remain server-side; the browser only talks to same-origin PHP endpoints.

## 2.2.4 - 2026-08-31 — Pixel

### Fixed
- Restored the IDE-style 404 workspace for unknown routes behind ParsPack CDN.
- Unknown project deep links now render the same in-app 404 instead of ParsPack's upstream error page.

### Changed
- Unknown browser routes use a CDN-compatible soft-404 response: HTTP 200 with `X-Robots-Tag: noindex, nofollow` and `X-Portfolio-Route-Status: 404`.
- The 404 document removes canonical/Open Graph URL metadata and uses a dedicated not-found title to avoid advertising an invalid route.

## 2.2.3 - 2026-08-31

### Fixed
- Explorer/sidebar entries now receive a selected state when clicked and while their section is visible during scrolling.
- Project detail routes keep the Projects entry selected instead of leaving the Explorer state ambiguous.

### Changed
- Moved the resume out of the `OSAMEH-PORTFOLIO` file tree.
- Added a distinct `PORTFOLIO PLUGINS` area with a Resume Viewer card that reflects modal open/closed state.
- Added `aria-current`/`aria-pressed` state to the Explorer and Resume Viewer controls for clearer keyboard and assistive-technology feedback.

## 2.2.2 - 2026-08-31

### Added
- Complete repository-level changelog for the production history.
- Production screenshots under `docs/img/` for the public GitHub README.
- README release summary limited to the five latest releases with a link to this file.

### Changed
- Finalized CI/CD documentation for the dedicated ParsPack deployment account.
- Documentation-only changes, including `docs/CHANGELOG.md`, no longer trigger a production deployment workflow.

## 2.2.1 - 2026-08-31

### Added
- GitHub Actions workflow for automatic production delivery on pushes to `main`.
- Manual `workflow_dispatch` support for controlled redeploys.
- Deployment bundle validation before upload.
- Public `build-info.json` verification after deployment with cache-busting retries.
- GitHub Actions deployment summary containing commit and build identifiers.

### Security
- Deployment credentials are isolated in GitHub Actions repository secrets.
- CI is designed for a dedicated FTP account scoped only to `public_html`.
- Explicit FTPS/TLS is required by the workflow; runtime GitHub API secrets remain outside the web root.

### Changed
- Recent public GitHub activity messaging now reflects GitHub's 30-day public-events window.

## 2.2.0 - 2026-08-31

### Added
- Resizable IDE-style terminal panel with drag handle.
- Terminal maximize/restore controls and double-click maximize behavior.
- Shared toast notification system with `success`, `info`, `warning`, and `error` variants.
- Repository-wide authored-image discovery for project galleries.

### Fixed
- Command Palette keyboard selection now scrolls the active item into view.
- Contact filename follows the currently selected programming language.
- Status-bar build-version hover contrast improved.

### Changed
- Operational errors and feedback were consolidated into the toast system.
- Repository README was rewritten for normal public/open-source use rather than deployment-session notes.

## 2.1.0 - 2026-08-31

### Added
- Ongoing `Freelance Software Developer` experience from 2017 to present.

### Fixed
- Contact form initialization so the send action does not remain disabled when the initial CSRF bootstrap is delayed.
- Stateless same-origin CSRF flow with automatic token refresh/retry behavior.
- Light-theme search field, shortcut badge, form, modal, and menu contrast issues.

### Changed
- Increased typography sizes across the interface, including menus, forms, metadata, modals, and microcopy.
- Improved dark/light section-label contrast.
- Header actions wrap as complete items instead of breaking labels such as `Install app` across lines.
- `Open PDF` moved next to `Download` in the resume viewer header.

## 2.0.1 - 2026-08-31

### Fixed
- TypeScript build errors caused by an unavailable Lucide `Github` icon export.
- React click-handler typing issues around `showHome`.

### Changed
- Clicking a build version opens an in-app Build Info modal instead of raw `build-info.json`.
- Terminal `build` opens the Build Info modal.
- Terminal `version` remains a concise text-only command.

## 2.0.0 - 2026-08-31

### Added
- Project case-study structure: problem, solution, architecture, challenges, and results.
- Project search, technology filters, sorting, and two-project comparison.
- Tech Stack Explorer linked to project filtering.
- Built-in PDF resume viewer and downloadable CV.
- Recent public GitHub activity panel.
- `Now` section and in-site changelog.
- PWA manifest, install flow, service worker, and offline shell.
- Production contact form with PHP backend, validation, honeypot, CSRF protection, and rate limiting.
- Privacy-friendly aggregate analytics without cookies or persistent visitor identifiers.
- System diagnostics panel.
- Keyboard-first navigation and expanded Command Palette.
- Advanced terminal commands including `neofetch`, project lookup, resume, status, and sharing commands.
- Project sharing and project-specific social metadata/cards.
- Developer-style 404 page and offline/error states.
- Project comparison modal.

### Security
- Browser-to-GitHub traffic remains same-origin through the PHP proxy.
- Server-side secrets remain outside `public_html`.

## 1.3.0 - 2026-08-31

### Added
- Context-aware custom right-click menu for desktop pointers.
- Theme-aware context-menu styling for dark and light modes.
- `Ctrl/Cmd + K` Command Palette.
- Context actions for projects, images, links, selected text, navigation, theme switching, terminal access, and clipboard operations.
- Developer easter egg: `sudo hire osameh`.
- Deep project links such as `/projects/Mizekar`.
- Clipboard feedback toasts.

### Fixed
- Terminal command input now autofocuses whenever the terminal is opened or reactivated.

## 1.2.0 - 2026-08-31

### Added
- Automatic build IDs and build timestamps generated during production builds.
- In-site build-version display and `build-info.json` diagnostics endpoint.
- `version` / `build` terminal support.
- Social preview JPEG (`1200x630`) for broad Open Graph crawler compatibility.
- Expanded Open Graph and Twitter/X metadata.

### Fixed
- Social preview reliability for platforms that did not consistently render the earlier WebP OG image.

## 1.1.0 - 2026-08-31

### Added
- Project Gallery backed by `/api/github/images/{repo}`.
- Repository tree image discovery across README, `images`, `docs`, screenshots, and media paths.
- Fullscreen gallery lightbox with keyboard navigation.
- Server-side image-list caching.

### Fixed
- Root-relative GitHub image paths such as `/Images/splash_screen.jpg` now resolve against the correct repository/branch.
- Relative README image normalization for repositories such as Dialysis and MizeKar.

### Security
- Gallery endpoints validate repository names against the public portfolio repository set before using the GitHub API.

## 1.0.0 - 2026-08-31

### Added
- Production migration from the hosted prototype to a shared-hosting-compatible React/Vite frontend.
- PHP GitHub proxy for server-side authenticated repository requests.
- Dynamic public repository loading with archived/profile-repository filtering and embedded fallback data.
- README loading and sanitized Markdown rendering with `marked` + DOMPurify.
- Server-side GitHub origin caching and stale-cache fallback.
- ParsPack shared-hosting deployment support.
- CDN-oriented immutable caching for hashed assets.
- HTTPS/security headers, CSP, HSTS, anti-framing, referrer policy, and permissions policy.
- SEO metadata, canonical URL, sitemap, robots file, favicon, and social metadata foundation.

### Security
- `GITHUB_TOKEN` stays outside the web root and is never included in browser bundles or Git history.
- Browser GitHub access is proxied through same-origin PHP endpoints.
