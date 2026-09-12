"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  Accessibility as AccessibilityIcon, AlertTriangle, ArrowUpRight, Braces, BriefcaseBusiness as Linkedin, Camera as Instagram,
  Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Code2, Command, Copy, Download, ExternalLink, FileCode2,
  FolderOpen, GitBranch as Github, GitFork as Gitlab, Home as HomeIcon, Link2, Mail, MapPin, Menu,
  CornerDownLeft, Info, ListTree, LoaderCircle, Maximize2, MessageCircle, Minimize2, PanelBottom, RefreshCw,
  Image as ImageIcon, LayoutGrid, Monitor, Moon, Package, Search, Send, ServerCog, Star, Sun, Terminal, Type, X, Zap,
} from "lucide-react";
import { BUILD_CODENAME, BUILD_DISPLAY, BUILD_ID, BUILD_TIME, BUILD_VERSION } from "../generated/build";
import { formatReleaseLabel } from "../lib/releaseMetadata";
import { canonicalKeys, canonicalKeysFor, technologyLabel, TECHNOLOGIES } from "../lib/technology";
import { trackEvent } from "../lib/analytics";
import { shareProject } from "../lib/share";
import { ContactForm } from "../features/contact/ContactForm";
import { GithubActivity } from "../features/activity/GithubActivity";
import { NowSection } from "../features/now/NowSection";
import { ChangelogSection } from "../features/changelog/ChangelogSection";
import { ResumeViewer } from "../features/resume/ResumeViewer";
import { BuildInfoModal } from "../features/diagnostics/BuildInfoModal";
import { SystemDiagnostics } from "../features/diagnostics/SystemDiagnostics";
import { ShortcutGuide } from "../features/workspace/ShortcutGuide";
import { PwaInstallControl } from "../features/workspace/PwaInstallControl";
import { ProjectCompare } from "../features/projects/ProjectCompare";
import type { ToastKind, ToastPayload } from "../lib/toast";
import { FeaturedProjects, ProjectArchitecture, ProjectCaseStudyV3, ProjectMetadataPanel, ProjectMetrics, ProjectQuickAccess, ProjectSourceExplorer, RecruiterMode } from "../features/projects/ProjectIntelligence";
import { fetchPortfolioMetadata, type PortfolioMetadata } from "../features/projects/projectMetadata";
import { EngineeringNotesSection, EngineeringNoteView } from "../features/notes/EngineeringNotes";
import { ContinueExploring } from "../features/discovery/ContinueExploring";
import { relatedToCaseStudy, relatedToNote, relatedToProject, type RelatedItem, type RelatedSource } from "../lib/relatedContent";
import { engineeringNotes, adjacentNotes } from "../features/notes/notesData";
import { AccessibilityControlButton, AvailabilityBadge, CaseStudiesSection, CaseStudyModal, PortfolioFeatureModals, availabilityConfig, availabilityProfile, capabilities, caseStudies, usePortfolioFeatures } from "../features/portfolio/PortfolioFeatures";
import type { CaseStudy } from "../data/caseStudiesData";
import { getWorkspaceScrollPosition, useModalDialog } from "../lib/modalScroll";
import { HOME_TAB_ID, noteTab, noteTabId, projectTab, projectTabId, tabAfterClose, type EditorTab } from "./editorTabs";
import { codeProfiles, contactFiles, fontOptions, roles, skillSource, skills, type CodeLanguage, type FontPreference, type ThemePreference, skillCatalog, skillGroups, EVIDENCE_LABEL } from "./workspacePreferences";
import { sectionByPath, sections, type SearchResult } from "./sections";
import { useWorkspacePreferences } from "./useWorkspacePreferences";
import { universalSearchScore, type PaletteCommand } from "../lib/universalSearch";
import { fallbackRepos, npmPackages, npmUrl, type GithubRepo } from "../features/projects/repoTypes";
import { GITHUB_OWNER, getMarkdownTools, readmeRepoRef, renderMarkdown, type RepoGalleryImage } from "../features/projects/readmeGallery";
import { useRepositoryContent } from "../features/projects/useRepositoryContent";
import { BrandMark, HeroShowcase } from "../features/home/HeroShowcase";

type ContextMenuState = {
  x: number;
  y: number;
  repoName?: string;
  imageUrl?: string;
  imageIndex?: number;
  linkUrl?: string;
  linkLabel?: string;
  selection?: string;
  noteSlug?: string;
  caseStudyId?: string;
};

type ToastState = { message: string; kind: ToastKind } | null;

export default function Home() {
  const { t, setAccessibilityOpen, setAvailabilityOpen } = usePortfolioFeatures();
  const [menuOpen, setMenuOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [activeSectionPath, setActiveSectionPath] = useState<string>("/home");
  const [resumeOpen, setResumeOpen] = useState(false);
  const { theme, setTheme, font, setFont, codeLanguage, setCodeLanguage } = useWorkspacePreferences();
  const [skillsView, setSkillsView] = useState<"code" | "ui">("code");
  const [copied, setCopied] = useState(false);
  const [repos, setRepos] = useState<GithubRepo[]>(fallbackRepos);
  const [repoMetadata, setRepoMetadata] = useState<Record<string, PortfolioMetadata | undefined>>({});
  const [metadataState, setMetadataState] = useState<"idle" | "loading" | "ready">("idle");
  const [recruiterModeOpen, setRecruiterModeOpen] = useState(false);
  const [visibleRepos, setVisibleRepos] = useState(6);
  const [repoState, setRepoState] = useState<"loading" | "ready">("loading");
  const [liveRepoData, setLiveRepoData] = useState(false);
  // One ordered collection is the single source of truth for every closable
  // editor tab. Projects previously lived in an array while a Note lived in a
  // lone "active slug", so activating any other view destroyed the Note tab.
  // Home is implicit, always first, and never stored here.
  const [editorTabs, setEditorTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>(HOME_TAB_ID);
  const tabsRowRef = useRef<HTMLDivElement>(null);
  const [activeCaseStudy, setActiveCaseStudy] = useState<CaseStudy | null>(null);
  const activeTab = editorTabs.find(tab => tab.id === activeTabId) || null;
  const activeRepo = activeTab?.kind === "project" ? activeTab.repo : null;
  const activeNoteSlug = activeTab?.kind === "note" ? activeTab.slug : null;
  const openedRepos = editorTabs.flatMap(tab => tab.kind === "project" ? [tab.repo] : []);
  const [readmeHtml, setReadmeHtml] = useState<Record<string, string>>({});
  const { loadReadme, loadGallery, loadingGalleries, readmeMarkdown, repoGalleries, repoImages } = useRepositoryContent();
  const [loadingReadmes, setLoadingReadmes] = useState<string[]>([]);
  const [galleryLightbox, setGalleryLightbox] = useState<{ repo: string; index: number } | null>(null);
  const readmeRenderRequests = useRef<Set<string>>(new Set());
  const projectsSectionRef = useRef<HTMLElement>(null);
  const [projectsNearViewport, setProjectsNearViewport] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notFoundPath, setNotFoundPath] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"outline" | "terminal">("terminal");
  const [terminalInput, setTerminalInput] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  // Destination chosen in the Command Palette, held until the palette has
  // actually closed and released its share of the shared modal lock.
  const pendingPaletteActionRef = useRef<(() => void) | null>(null);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [actionToast, setActionToast] = useState<ToastState>(null);
  const [panelHeight, setPanelHeight] = useState(290);
  const [panelMaximized, setPanelMaximized] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectTech, setProjectTech] = useState("all");
  const [projectSort, setProjectSort] = useState<"recent" | "stars" | "name">("recent");
  const [compareRepos, setCompareRepos] = useState<GithubRepo[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "› cat welcome.txt",
    "Hi — I'm Osameh, software engineer in Tehran. This site is a small editor.",
    "Type `help` for commands, or just scroll.",
  ]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const commandPaletteDialogRef = useModalDialog<HTMLElement>(commandPaletteOpen, () => setCommandPaletteOpen(false));
  const galleryDialogRef = useModalDialog<HTMLDivElement>(Boolean(galleryLightbox), () => setGalleryLightbox(null));
  const terminalOutputRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const terminalCompletionRef = useRef<{ seed: string; matches: string[]; index: number; applied: string }>({ seed: "", matches: [], index: -1, applied: "" });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const commandPaletteInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteListRef = useRef<HTMLDivElement>(null);
  const projectSearchRef = useRef<HTMLInputElement>(null);
  const panelResizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const keyboardChordRef = useRef<{ key: string; at: number } | null>(null);
  const actionToastTimerRef = useRef<number | null>(null);
  const pendingSectionScrollRef = useRef<{ id: string; behavior: ScrollBehavior; exact: boolean; token: number } | null>(null);
  const sectionScrollTokenRef = useRef(0);
  const sectionScrollTimersRef = useRef<number[]>([]);

  const cancelSectionScroll = useCallback(() => {
    sectionScrollTokenRef.current += 1;
    pendingSectionScrollRef.current = null;
    sectionScrollTimersRef.current.forEach(timer => window.clearTimeout(timer));
    sectionScrollTimersRef.current = [];
  }, []);
  const caseStudyOriginRef = useRef<{ path: string; sectionPath: string; scrollX: number; scrollY: number } | null>(null);
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);
  const code = codeProfiles[codeLanguage];
  const skillLines = skillSource(codeLanguage);

  const showActionToast = (message: string, kind: ToastKind = "info", duration = 3200) => {
    setActionToast({ message, kind });
    if (actionToastTimerRef.current !== null) window.clearTimeout(actionToastTimerRef.current);
    actionToastTimerRef.current = window.setTimeout(() => setActionToast(null), duration);
  };

  const copyText = async (value: string, message = "Copied to clipboard") => {
    try {
      await navigator.clipboard.writeText(value);
      showActionToast(message, "success");
      return true;
    } catch {
      showActionToast("Clipboard permission was blocked by the browser.", "error", 4200);
      return false;
    }
  };

  const openTerminal = (prefill?: string) => {
    setPanelTab("terminal");
    setPanelOpen(true);
    if (prefill !== undefined) setTerminalInput(prefill);
    window.requestAnimationFrame(() => {
      const input = terminalInputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    });
  };

  const togglePanelMaximized = () => {
    setPanelMaximized(value => !value);
    window.requestAnimationFrame(() => terminalInputRef.current?.focus({ preventScroll: true }));
  };

  const beginPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const renderedHeight = event.currentTarget.parentElement?.getBoundingClientRect().height || panelHeight;
    if (panelMaximized) setPanelMaximized(false);
    panelResizeRef.current = { startY: event.clientY, startHeight: renderedHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("panel-resizing");
  };

  const resizePanel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panelResizeRef.current;
    if (!state) return;
    const maxHeight = Math.max(260, window.innerHeight - 86);
    setPanelHeight(Math.max(190, Math.min(maxHeight, state.startHeight + state.startY - event.clientY)));
  };

  const endPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panelResizeRef.current) return;
    panelResizeRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer capture may already be released */ }
    document.body.classList.remove("panel-resizing");
    window.requestAnimationFrame(() => terminalInputRef.current?.focus({ preventScroll: true }));
  };

  const toggleThemeMode = () => {
    const resolved = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(resolved === "dark" ? "light" : "dark");
  };

  const runHireEasterEgg = () => {
    setTerminalLines(lines => [...lines,
      "› sudo hire osameh",
      "Checking skills...",
      ".NET / backend          ✓",
      "React / Vue / Nuxt      ✓",
      "Systems / DevOps        ✓",
      "Product engineering     ✓",
      "",
      "Access granted.",
      "Let's build something great.",
    ]);
    setSearchResults([]);
    setTerminalInput("");
    openTerminal();
  };

  useLayoutEffect(() => {
    const path = window.location.pathname;
    const knownPaths = ["/", "/home", "/about", "/projects", "/case-studies", "/experience", "/activity", "/now", "/changelog", "/notes", "/contact", "/resume", "/status"];
    const noteMatch = path.match(/^\/notes\/([a-z0-9-]+)\/?$/i);
    const caseStudyMatch = path.match(/^\/case-studies\/([a-z0-9-]+)\/?$/i);
    const project = fallbackRepos.find(repo => `/${repo.name.toLowerCase()}` === path.toLowerCase() || `/projects/${repo.name.toLowerCase()}` === path.toLowerCase());
    if (caseStudyMatch) {
      const study = caseStudies.find(item => item.id === caseStudyMatch[1].toLowerCase());
      if (study) { setActiveCaseStudy(study); setActiveSectionPath("/case-studies"); } else setNotFoundPath(path);
    } else if (noteMatch && engineeringNotes.some(note => note.slug === noteMatch[1].toLowerCase())) {
      const slug = noteMatch[1].toLowerCase();
      setEditorTabs(current => current.some(tab => tab.id === noteTabId(slug)) ? current : [...current, noteTab(slug)]);
      setActiveTabId(noteTabId(slug));
      setActiveSectionPath("/notes");
    } else if (noteMatch) setNotFoundPath(path);
    else if (project) openProject(project, false);
    else if (path.toLowerCase() === "/resume") window.setTimeout(() => window.dispatchEvent(new Event("portfolio:resume")), 50);
    else if (path.toLowerCase() === "/status") window.setTimeout(() => window.dispatchEvent(new Event("portfolio:diagnostics")), 80);
    else if (knownPaths.includes(path.toLowerCase()) && !["/", "/home", "/resume", "/status"].includes(path.toLowerCase())) {
      setActiveSectionPath(path.toLowerCase());
      const target = path.toLowerCase() === "/projects" ? "work" : path.slice(1);
      // Resolve deep-link section navigation immediately. A delayed route timer
      // can race with opening a modal and later snap the workspace back to the
      // section after the dialog closes. scrollToSection already waits for two
      // animation frames, which is enough for the portfolio DOM to commit.
      if (document.documentElement.dataset.modalOpen !== "true") {
        const exact = path.toLowerCase() === "/notes" || path.toLowerCase() === "/case-studies";
        scrollToSection(target, "auto", exact);
      }
    } else if (!knownPaths.includes(path.toLowerCase()) && !/^\/projects\/[^/]+\/?$/i.test(path) && !/^\/notes\/[^/]+\/?$/i.test(path) && !/^\/case-studies\/[^/]+\/?$/i.test(path)) setNotFoundPath(path);
  }, []);

  useEffect(() => { trackEvent("page_view"); }, []);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      if (!detail?.message) return;
      showActionToast(detail.message, detail.kind || "info", detail.duration || 3200);
    };
    window.addEventListener("portfolio:toast", onToast);
    return () => window.removeEventListener("portfolio:toast", onToast);
  }, []);

  useEffect(() => {
    if (!panelOpen || panelTab !== "terminal") return;
    const frame = window.requestAnimationFrame(() => {
      terminalInputRef.current?.focus({ preventScroll: true });
      const input = terminalInputRef.current;
      if (input) input.setSelectionRange(input.value.length, input.value.length);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [panelOpen, panelTab]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    // Escape is owned by the shared modal stack in useModalDialog, which closes
    // only the topmost dialog. A second listener here would close the palette
    // out of stack order.
    const frame = window.requestAnimationFrame(() => commandPaletteInputRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [commandPaletteOpen]);

  // A palette destination runs only once the palette is gone. This is a passive
  // effect, so React has already flushed the palette's layout-effect cleanup -
  // its modal lock is released, the body is unfrozen and the workspace scroll
  // is restored - before the destination takes over focus, history and scroll.
  useEffect(() => {
    if (commandPaletteOpen) return;
    const action = pendingPaletteActionRef.current;
    if (!action) return;
    pendingPaletteActionRef.current = null;
    action();
  }, [commandPaletteOpen]);

  useEffect(() => { setCommandIndex(0); }, [commandQuery]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    const frame = window.requestAnimationFrame(() => {
      commandPaletteListRef.current?.querySelector<HTMLElement>("[aria-selected='true']")?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [commandIndex, commandQuery, commandPaletteOpen]);

  useEffect(() => {
    const sync = () => {
      const nextOffline = !navigator.onLine;
      setOffline(nextOffline);
      showActionToast(nextOffline ? "You are offline. Cached portfolio content remains available." : "Connection restored.", nextOffline ? "warning" : "success", 3800);
    };
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing = !!target?.closest("input, textarea, select, [contenteditable='true']");
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "?") { event.preventDefault(); window.dispatchEvent(new Event("portfolio:shortcuts")); return; }
      if (event.key === "/") {
        if (!activeRepo && !notFoundPath) { event.preventDefault(); projectSearchRef.current?.focus({ preventScroll: false }); document.getElementById("work")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
        return;
      }
      const now = Date.now();
      if (event.key.toLowerCase() === "g") { keyboardChordRef.current = { key: "g", at: now }; return; }
      const chord = keyboardChordRef.current;
      keyboardChordRef.current = null;
      if (!chord || now - chord.at > 900) return;
      const map: Record<string, SearchResult> = { h: sectionByPath("/home"), a: sectionByPath("/about"), p: sectionByPath("/projects"), e: sectionByPath("/experience"), n: sectionByPath("/now"), c: sectionByPath("/contact") };
      const destination = map[event.key.toLowerCase()];
      if (destination) { event.preventDefault(); goTo(destination); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeRepo, notFoundPath, repos]);

  useEffect(() => {
    const sequence = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    let index = 0;
    const konami = (event: KeyboardEvent) => {
      if (event.key === sequence[index]) index += 1; else index = event.key === sequence[0] ? 1 : 0;
      if (index === sequence.length) {
        index = 0;
        setTerminalLines(lines => [...lines, "› konami", "Achievement unlocked: curious engineer ✦", "You found the hidden input sequence. Type `neofetch` for another one."]);
        openTerminal();
      }
    };
    document.addEventListener("keydown", konami);
    return () => document.removeEventListener("keydown", konami);
  }, []);

  const openUniversalSearch = useCallback(() => {
    setContextMenu(null);
    setFileMenuOpen(false);
    setCommandQuery("");
    setCommandIndex(0);
    setCommandPaletteOpen(true);
  }, []);

  useEffect(() => {
    const openPalette = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const primaryShortcut = modifier && event.shiftKey && !event.altKey && key === "p";
      if (!primaryShortcut) return;
      event.preventDefault();
      event.stopPropagation();
      openUniversalSearch();
    };
    const openFromEvent = () => openUniversalSearch();
    // Modals hand section navigation back to the shell instead of calling
    // scrollIntoView themselves: a modal's own scroll-lock restore runs during
    // its closing commit and would otherwise undo the jump. goTo() routes
    // through the tokenized section scroller, which applies after that commit
    // and is cancelled by real user scrolling.
    const navigateFromEvent = (event: Event) => {
      const path = (event as CustomEvent<{ path?: string }>).detail?.path;
      if (path) goTo(sectionByPath(path));
    };
    window.addEventListener("keydown", openPalette, true);
    window.addEventListener("portfolio:search", openFromEvent);
    window.addEventListener("portfolio:navigate", navigateFromEvent);
    return () => {
      window.removeEventListener("keydown", openPalette, true);
      window.removeEventListener("portfolio:search", openFromEvent);
      window.removeEventListener("portfolio:navigate", navigateFromEvent);
    };
  }, [openUniversalSearch]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (target.closest(".custom-context-menu, .command-palette")) { event.preventDefault(); return; }

      const keyboardInvocation = event.clientX === 0 && event.clientY === 0;
      const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (!finePointer && !keyboardInvocation) return;

      event.preventDefault();
      // A context menu is direct user intent. Cancel route stabilization before
      // opening it so a later programmatic scroll cannot dismiss or replace the
      // Note/Case Study specific menu while the user is reading it.
      cancelSectionScroll();
      setFileMenuOpen(false);
      setCommandPaletteOpen(false);

      const projectTarget = target.closest<HTMLElement>("[data-project-name]");
      const repoName = projectTarget?.dataset.projectName || (target.closest(".ide-project-view") ? activeRepo?.name : undefined);
      const noteTarget = target.closest<HTMLElement>("[data-note-slug]");
      const caseStudyTarget = target.closest<HTMLElement>("[data-case-study-id]");
      const noteSlug = noteTarget?.dataset.noteSlug || activeNoteSlug || undefined;
      const caseStudyId = caseStudyTarget?.dataset.caseStudyId || activeCaseStudy?.id || undefined;
      const imageTarget = target.closest<HTMLElement>("[data-image-url]");
      let imageUrl = imageTarget?.dataset.imageUrl;
      let imageIndex = imageTarget?.dataset.imageIndex ? Number(imageTarget.dataset.imageIndex) : undefined;

      if (!imageUrl && target instanceof HTMLImageElement && target.src) {
        imageUrl = target.currentSrc || target.src;
        if (repoName) {
          const gallery = repoGalleries[repoName] || [];
          const match = gallery.findIndex(item => item.url === imageUrl);
          if (match >= 0) imageIndex = match;
        }
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      const selectedText = window.getSelection()?.toString().trim() || "";
      let x = event.clientX;
      let y = event.clientY;
      if (keyboardInvocation) {
        const rect = target.getBoundingClientRect();
        x = rect.left + Math.min(24, Math.max(8, rect.width / 2));
        y = rect.top + Math.min(rect.height + 8, 36);
      }

      setContextMenu({
        x, y, repoName, noteSlug, caseStudyId, imageUrl, imageIndex,
        linkUrl: anchor?.href,
        linkLabel: anchor?.textContent?.trim() || anchor?.getAttribute("aria-label") || undefined,
        selection: selectedText || undefined,
      });
    };

    const closeOnPointer = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest(".custom-context-menu")) setContextMenu(null);
    };
    const closeOnScrollIntent = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".custom-context-menu")) return;
      setContextMenu(null);
    };
    const closeOnResize = () => setContextMenu(null);

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("pointerdown", closeOnPointer);
    window.addEventListener("wheel", closeOnScrollIntent, { passive: true });
    window.addEventListener("touchstart", closeOnScrollIntent, { passive: true });
    window.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("pointerdown", closeOnPointer);
      window.removeEventListener("wheel", closeOnScrollIntent);
      window.removeEventListener("touchstart", closeOnScrollIntent);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [activeRepo, activeNoteSlug, activeCaseStudy, repoGalleries, cancelSectionScroll]);

  useEffect(() => {
    if (!contextMenu) return;
    const frame = window.requestAnimationFrame(() => {
      const menu = contextMenuRef.current;
      if (!menu) return;
      const margin = 10;
      const rect = menu.getBoundingClientRect();
      const left = Math.max(margin, Math.min(contextMenu.x, window.innerWidth - rect.width - margin));
      const top = Math.max(margin, Math.min(contextMenu.y, window.innerHeight - rect.height - margin));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const navigateMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setContextMenu(null); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) return;
      const menu = contextMenuRef.current;
      if (!menu) return;
      const items = Array.from(menu.querySelectorAll<HTMLButtonElement>("button.context-menu-item:not(:disabled)"));
      if (!items.length) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Enter" || event.key === " ") {
        if (current >= 0) { event.preventDefault(); items[current].click(); }
        return;
      }
      event.preventDefault();
      if (event.key === "Home") items[0].focus();
      else if (event.key === "End") items[items.length - 1].focus();
      else if (event.key === "ArrowDown") items[(current + 1 + items.length) % items.length].focus();
      else items[(current - 1 + items.length) % items.length].focus();
    };
    document.addEventListener("keydown", navigateMenu);
    return () => document.removeEventListener("keydown", navigateMenu);
  }, [contextMenu]);

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".ide-file-menu")) setFileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setFileMenuOpen(false); };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeMenu); document.removeEventListener("keydown", closeOnEscape); };
  }, []);

  useEffect(() => {
    const closeActiveTab = (event: KeyboardEvent) => {
      if (contextMenu || commandPaletteOpen) return;
      if (galleryLightbox) {
        const gallery = repoGalleries[galleryLightbox.repo] || [];
        if (event.key === "Escape") {
          event.preventDefault();
          setGalleryLightbox(null);
          return;
        }
        if (gallery.length > 1 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          event.preventDefault();
          const direction = event.key === "ArrowRight" ? 1 : -1;
          setGalleryLightbox(current => current ? { ...current, index: (current.index + direction + gallery.length) % gallery.length } : current);
        }
        return;
      }
      if (event.key !== "Escape" || fileMenuOpen) return;
      // Every close path - X button, Back to Portfolio, Escape - runs the same
      // tab-selection algorithm.
      if (notFoundPath) showHome();
      else if (activeTabId !== HOME_TAB_ID) closeTab(activeTabId);
    };
    document.addEventListener("keydown", closeActiveTab);
    return () => document.removeEventListener("keydown", closeActiveTab);
  }, [activeTabId, editorTabs, notFoundPath, fileMenuOpen, galleryLightbox, repoGalleries, contextMenu, commandPaletteOpen]);

  useEffect(() => {
    const toggleTerminal = (event: KeyboardEvent) => {
      if (event.key !== "`" || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      setPanelOpen(open => {
        const next = !open;
        if (next) setPanelTab("terminal");
        return next;
      });
    };
    document.addEventListener("keydown", toggleTerminal);
    return () => document.removeEventListener("keydown", toggleTerminal);
  }, []);

  useEffect(() => {
    if (!panelOpen || panelTab !== "terminal") return;
    const output = terminalOutputRef.current;
    if (output) output.scrollTo({ top: output.scrollHeight, behavior: "smooth" });
  }, [terminalLines, searchResults, panelOpen, panelTab]);


  useEffect(() => {
    if (activeRepo || activeNoteSlug || notFoundPath || resumeOpen) return;

    const targets = [
      { path: "/home", id: "home" },
      { path: "/about", id: "about" },
      { path: "/projects", id: "work" },
      { path: "/case-studies", id: "case-studies" },
      { path: "/experience", id: "experience" },
      { path: "/activity", id: "activity" },
      { path: "/now", id: "now" },
      { path: "/changelog", id: "changelog" },
      { path: "/notes", id: "notes" },
      { path: "/contact", id: "contact" },
    ].map(item => ({ ...item, element: document.getElementById(item.id) })).filter(item => item.element) as Array<{ path: string; id: string; element: HTMLElement }>;

    if (!targets.length) return;
    let frame = 0;
    const syncExplorerSelection = () => {
      frame = 0;
      const probe = Math.min(190, Math.max(105, window.innerHeight * 0.24));
      let current = targets[0];
      for (const target of targets) {
        if (target.element.getBoundingClientRect().top <= probe) current = target;
        else break;
      }
      setActiveSectionPath(path => path === current.path ? path : current.path);
    };
    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncExplorerSelection);
    };

    syncExplorerSelection();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
    };
  }, [activeRepo, activeNoteSlug, notFoundPath, resumeOpen]);

  useEffect(() => {
    // A double-clicked dist/index.html runs on file:// and has no PHP server.
    // Render the embedded projects immediately instead of attempting a file:// API request.
    if (window.location.protocol === "file:") {
      setRepos(fallbackRepos);
      setRepoState("ready");
      return;
    }

    const fetchRepositories = async () => {
      for (const endpoint of ["/api/github/repos", "/api/github.php"]) {
        try {
          const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
          if (!response.ok) continue;
          const data = await response.json() as GithubRepo[];
          if (Array.isArray(data) && data.length) return data;
        } catch {
          // Try the compatibility endpoint next.
        }
      }
      throw new Error("GitHub request failed");
    };

    fetchRepositories()
      .then((data: GithubRepo[]) => {
        const activeRepos = data
          .filter(repo => !repo.archived && repo.name.toLowerCase() !== "osameh15")
          .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
        if (!activeRepos.length) throw new Error("No repositories returned");
        setRepos(activeRepos);
        setLiveRepoData(true);
        setRepoState("ready");
      })
      .catch(() => {
        setRepos(fallbackRepos);
        setRepoState("ready");
        showActionToast("GitHub is temporarily unavailable. Showing the embedded project fallback.", "warning", 4600);
      });
  }, []);

  useEffect(() => {
    if (!activeRepo) return;
    const meta = repoMetadata[activeRepo.name];
    if (meta?.seo.title) document.title = meta.seo.title;
  }, [activeRepo, repoMetadata]);

  useEffect(() => {
    if (repoState !== "ready" || !repos.length) return;
    let cancelled = false;
    setMetadataState("loading");
    let cursor = 0;
    const workers = Array.from({ length: Math.min(3, repos.length) }, async () => {
      while (!cancelled) {
        const index = cursor;
        cursor += 1;
        const repo = repos[index];
        if (!repo) break;
        const metadata = await fetchPortfolioMetadata(repo);
        if (cancelled) break;
        setRepoMetadata(current => ({ ...current, [repo.name]: metadata }));
      }
    });
    Promise.all(workers).then(() => { if (!cancelled) setMetadataState("ready"); });
    return () => { cancelled = true; };
  }, [repoState, repos]);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/projects\/([^/]+)\/?$/i);
    if (!match) return;
    let requested = match[1];
    try { requested = decodeURIComponent(requested); } catch { /* Keep the encoded value for the 404 path. */ }
    const repo = repos.find(item => item.name.toLowerCase() === requested.toLowerCase());
    if (repo) {
      setNotFoundPath(null);
      if (activeRepo?.name.toLowerCase() !== repo.name.toLowerCase()) openProject(repo);
    } else {
      setNotFoundPath(window.location.pathname);
    }
  }, [repos]);

  useEffect(() => {
    if (repoState !== "ready" || projectsNearViewport) return;
    const section = projectsSectionRef.current;
    if (!section || !("IntersectionObserver" in window)) {
      setProjectsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setProjectsNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "700px 0px" });

    observer.observe(section);
    return () => observer.disconnect();
  }, [repoState, projectsNearViewport]);

  useEffect(() => {
    if (repoState !== "ready" || !projectsNearViewport) return;
    repos.slice(0, visibleRepos).forEach(repo => { void loadReadme(repo); });
  }, [repos, visibleRepos, repoState, projectsNearViewport]);
  const copyEmail = async () => {
    const ok = await copyText("osirandoust@gmail.com", "Email copied");
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const ensureReadmeHtml = (repo: GithubRepo) => {
    if (readmeHtml[repo.name] !== undefined || readmeRenderRequests.current.has(repo.name)) return;
    readmeRenderRequests.current.add(repo.name);
    setLoadingReadmes(current => current.includes(repo.name) ? current : [...current, repo.name]);

    void (async () => {
      const existing = readmeMarkdown[repo.name];
      const markdown = existing !== undefined ? existing : await loadReadme(repo);
      const html = markdown ? await renderMarkdown(markdown, repo) : "";
      setReadmeHtml(current => ({ ...current, [repo.name]: html }));
    })().finally(() => {
      readmeRenderRequests.current.delete(repo.name);
      setLoadingReadmes(current => current.filter(name => name !== repo.name));
    });
  };

  const openProject = (repo: GithubRepo, updateHistory = true) => {
    setNotFoundPath(null);
    setActiveCaseStudy(null);
    setActiveSectionPath("/projects");
    // Reuse the existing tab for this entity; opening it twice never duplicates.
    setEditorTabs(current => current.some(tab => tab.id === projectTabId(repo)) ? current : [...current, projectTab(repo)]);
    setActiveTabId(projectTabId(repo));
    if (updateHistory) {
      const path = `/projects/${encodeURIComponent(repo.name)}`;
      if (window.location.pathname !== path) window.history.pushState({ project: repo.name }, "", path);
    }
    document.title = `${repo.name} — Osameh Irandoust`;
    trackEvent("project_open", repo.name);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setPanelOpen(false);
    ensureReadmeHtml(repo);
    void loadGallery(repo);
  };

  /**
   * Activates Home. Home is a singleton that is always present and never
   * closable, and selecting it only changes which tab is active - every other
   * editor tab stays open.
   *
   * `returnSection` belongs to the transition, not to global state: it is the
   * Home section owned by the tab we are leaving, so a Project -> Home move can
   * never be redirected to Notes by a Note that happens to be open.
   */
  const showHome = (updateHistory = true, scrollToTop = true, returnSection?: string) => {
    setNotFoundPath(null);
    setActiveCaseStudy(null);
    setActiveTabId(HOME_TAB_ID);
    document.title = "Osameh Irandoust — Software Engineer";
    if (updateHistory && window.location.pathname !== "/") window.history.pushState({}, "", "/");
    const section = returnSection && returnSection !== "/home" ? returnSection : null;
    if (section) {
      setActiveSectionPath(section);
      // Same deterministic restoration the Notes path already uses: no timers,
      // no guessed frame counts, and obsolete work is cancelled by user intent.
      cancelSectionScroll();
      scrollToSection(section === "/projects" ? "work" : section.slice(1), "auto", true);
      return;
    }
    setActiveSectionPath("/home");
    if (scrollToTop) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /**
   * Keeps the active editor tab visible in the horizontal strip.
   *
   * On narrow viewports the strip scrolls, so a newly activated tab could sit
   * outside the visible area and had to be found by hand. This scrolls the
   * container itself rather than calling scrollIntoView, which would also move
   * the page vertically. It runs in a layout effect after the active tab has
   * committed - no timers - and does nothing when the tab is already fully
   * visible, so it never fights a deliberate horizontal scroll.
   */
  useLayoutEffect(() => {
    const strip = tabsRowRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLElement>(".editor-tab.active");
    if (!active) return;
    const margin = 12;
    const stripBox = strip.getBoundingClientRect();
    const tabBox = active.getBoundingClientRect();
    let delta = 0;
    if (tabBox.left < stripBox.left + margin) delta = tabBox.left - stripBox.left - margin;
    else if (tabBox.right > stripBox.right - margin) delta = tabBox.right - stripBox.right + margin;
    if (Math.abs(delta) < 1) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollBy({ left: delta, behavior: reduceMotion ? "auto" : "smooth" });
  }, [activeTabId, editorTabs.length, notFoundPath]);

  /** The one close path for every editor tab, whatever triggered it. */
  const closeTab = (tabId: string) => {
    const closing = editorTabs.find(tab => tab.id === tabId);
    if (!closing) return;
    const previous = tabAfterClose(editorTabs, tabId);
    setEditorTabs(current => current.filter(tab => tab.id !== tabId));
    // Closing a tab that is not active must never steal focus from the active one.
    if (activeTabId !== tabId) return;
    cancelSectionScroll();
    if (previous) {
      setActiveTabId(previous.id);
      setActiveSectionPath(previous.homeSection);
      document.title = previous.kind === "project" ? `${previous.repo.name} — Osameh Irandoust` : "Osameh Irandoust — Software Engineer";
      if (window.location.pathname !== previous.path) window.history.pushState({}, "", previous.path);
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    // Home is the previous tab: restore the section this tab belongs to.
    showHome(true, false, closing.homeSection);
  };

  useEffect(() => {
    const cancelForModal = () => cancelSectionScroll();
    window.addEventListener("portfolio:modal-open", cancelForModal);
    return () => window.removeEventListener("portfolio:modal-open", cancelForModal);
  }, [cancelSectionScroll]);

  // Any real user navigation wins over delayed exact-scroll stabilization.
  // This is especially important after closing a modal: wheel/touch/keyboard
  // input must never be followed by an old timer pulling the workspace back.
  useEffect(() => {
    const cancelForUserIntent = () => cancelSectionScroll();
    const cancelForKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) cancelSectionScroll();
    };
    window.addEventListener("wheel", cancelForUserIntent, { passive: true });
    window.addEventListener("touchstart", cancelForUserIntent, { passive: true });
    window.addEventListener("pointerdown", cancelForUserIntent, { passive: true });
    window.addEventListener("keydown", cancelForKey, true);
    return () => {
      window.removeEventListener("wheel", cancelForUserIntent);
      window.removeEventListener("touchstart", cancelForUserIntent);
      window.removeEventListener("pointerdown", cancelForUserIntent);
      window.removeEventListener("keydown", cancelForKey, true);
    };
  }, [cancelSectionScroll]);

  const applySectionScroll = (request: { id: string; behavior: ScrollBehavior; exact: boolean; token: number }) => {
    if (request.token !== sectionScrollTokenRef.current) return false;
    // Browser Back can fire while a modal is still in the layout-effect cleanup
    // phase. Keep the request pending until the body scroll lock is released.
    if (document.documentElement.dataset.modalOpen === "true") return false;
    const target = document.getElementById(request.id);
    if (!target) return false;

    const move = (behavior: ScrollBehavior) => {
      if (request.token !== sectionScrollTokenRef.current || document.documentElement.dataset.modalOpen === "true") return;
      const currentTarget = document.getElementById(request.id);
      if (!currentTarget) return;
      const stickyOffset = window.innerWidth <= 720 ? 72 : 96;
      const top = currentTarget.getBoundingClientRect().top + window.scrollY - stickyOffset;
      const destination = Math.max(0, top);
      if (request.exact) {
        const root = document.documentElement;
        const previousScrollBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        // scrollIntoView establishes the element boundary using the browser's
        // current layout, then a small deterministic correction exposes it
        // below the fixed IDE chrome. This is more robust than a stale absolute
        // document coordinate when content above the section is still settling.
        currentTarget.scrollIntoView({ behavior: "auto", block: "start" });
        const correction = currentTarget.getBoundingClientRect().top - stickyOffset;
        if (Math.abs(correction) > 0.5) window.scrollBy(0, correction);
        root.style.scrollBehavior = previousScrollBehavior;
        return;
      }
      window.scrollTo({ top: destination, behavior });
    };

    move(request.exact ? "auto" : request.behavior);
    if (request.exact) {
      sectionScrollTimersRef.current.forEach(timer => window.clearTimeout(timer));
      // Re-apply after async content/layout settles. 4.2.x used the first two
      // passes; the later passes protect Notes/Case Studies from v5 content
      // above the target changing height after Browser Back.
      sectionScrollTimersRef.current = [60, 220, 500, 900].map(delay => window.setTimeout(() => move("auto"), delay));
    }
    if (pendingSectionScrollRef.current?.token === request.token) pendingSectionScrollRef.current = null;
    return true;
  };

  const scrollToSection = (id: string, behavior: ScrollBehavior = "smooth", exact = false) => {
    const request = { id, behavior, exact, token: ++sectionScrollTokenRef.current };
    pendingSectionScrollRef.current = request;
    // Exact route restoration must establish the anchor before the user can
    // interact with controls inside the section. Repeated passes still cover
    // late layout changes, but the first move is synchronous/deterministic.
    if (exact && behavior === "auto" && document.documentElement.dataset.modalOpen !== "true") applySectionScroll(request);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => { applySectionScroll(request); }));
  };

  useLayoutEffect(() => {
    const request = pendingSectionScrollRef.current;
    if (!request || activeRepo || activeNoteSlug || activeCaseStudy || notFoundPath || resumeOpen) return;
    applySectionScroll(request);
  }, [activeRepo, activeNoteSlug, activeCaseStudy, notFoundPath, resumeOpen]);

  useEffect(() => () => {
    sectionScrollTimersRef.current.forEach(timer => window.clearTimeout(timer));
  }, []);

  const openNote = (slug: string, updateHistory = true) => {
    const note = engineeringNotes.find(item => item.slug === slug);
    if (!note) { setNotFoundPath(`/notes/${slug}`); return; }
    setNotFoundPath(null);
    setActiveCaseStudy(null);
    setEditorTabs(current => current.some(tab => tab.id === noteTabId(slug)) ? current : [...current, noteTab(slug)]);
    setActiveTabId(noteTabId(slug));
    setActiveSectionPath("/notes");
    if (updateHistory) {
      const path = `/notes/${encodeURIComponent(slug)}`;
      if (window.location.pathname !== path) window.history.pushState({ note: slug }, "", path);
    }
    document.title = `${note.title} — Osameh Irandoust`;
    trackEvent("note_open", slug);
    // Moving between Notes replaces the whole reading pane, so the destination
    // must start at its own beginning. Animating there from the bottom of the
    // note being left would scroll through content that is already unmounting.
    // "instant" is required rather than "auto": html{scroll-behavior:smooth} is
    // exactly what "auto" defers to, so "auto" would still animate.
    window.scrollTo({ top: 0, behavior: activeNoteSlug && activeNoteSlug !== slug ? "instant" : "smooth" });
    setPanelOpen(false);
  };

  const closeNote = (returnToNotes = true) => {
    const slug = activeNoteSlug;
    if (!slug) return;
    if (!returnToNotes) {
      setEditorTabs(current => current.filter(tab => tab.id !== noteTabId(slug)));
      showHome(true, true);
      return;
    }
    // Closing the active Note follows the shared rule: activate the tab to its
    // left. Only when that is Home does the Notes section get restored, which
    // is the behavior this path already had.
    closeTab(noteTabId(slug));
  };

  const openCaseStudy = (study: CaseStudy, updateHistory = true) => {
    cancelSectionScroll();
    if (updateHistory) {
      // Never read window.scrollY here. Opening from the Command Palette (or any
      // other dialog) means the body is already frozen and window.scrollY is 0,
      // which would make closing this Case Study jump to the top of the page.
      const origin = getWorkspaceScrollPosition();
      caseStudyOriginRef.current = {
        path: window.location.pathname,
        sectionPath: activeSectionPath,
        scrollX: origin.x,
        scrollY: origin.y,
      };
    } else {
      caseStudyOriginRef.current = null;
    }
    setNotFoundPath(null);
    setActiveTabId(HOME_TAB_ID);
    setActiveCaseStudy(study);
    setActiveSectionPath("/case-studies");
    document.title = `${study.title} — Case Study | Osameh Irandoust`;
    if (updateHistory) {
      const path = `/case-studies/${encodeURIComponent(study.id)}`;
      if (window.location.pathname !== path) window.history.pushState({ caseStudy: study.id }, "", path);
    }
    trackEvent("case_study_open", study.id);
  };

  const closeCaseStudy = (returnToSection = true) => {
    // Closing a dialog must restore the view it covered, not navigate the
    // document. This prevents delayed section-scroll timers from pulling the
    // user back to section 03 after Escape/mouse-close.
    cancelSectionScroll();
    const origin = caseStudyOriginRef.current;
    caseStudyOriginRef.current = null;
    setActiveCaseStudy(null);
    document.title = "Osameh Irandoust — Software Engineer";
    if (!returnToSection) return;

    if (origin) {
      setActiveSectionPath(origin.sectionPath);
      if (window.location.pathname !== origin.path) {
        window.history.replaceState({ restoredFromCaseStudy: true }, "", origin.path);
      }
      // useModalDialog restores the exact covered scroll position during
      // the same React commit. Do not schedule any section scroll here.
      return;
    }

    // A directly loaded /case-studies/:id URL has no covered workspace to
    // restore, so closing it intentionally lands on the Case Studies index.
    setActiveSectionPath("/case-studies");
    if (window.location.pathname !== "/case-studies") window.history.replaceState({}, "", "/case-studies");
    window.requestAnimationFrame(() => scrollToSection("case-studies", "auto", true));
  };

  const closeProject = (repo: GithubRepo, returnHome = false) => {
    if (returnHome) {
      // "Back to Portfolio" with no tab to its left lands on Home at Projects.
      setEditorTabs(current => current.filter(tab => tab.id !== projectTabId(repo)));
      showHome(true, false, "/projects");
      return;
    }
    closeTab(projectTabId(repo));
  };

  const goTo = (result: SearchResult) => {
    if (result.path.startsWith("/case-studies/") && result.path !== "/case-studies") {
      const study = caseStudies.find(item => `/case-studies/${item.id}` === result.path);
      if (study) openCaseStudy(study);
      return;
    }
    if (result.path.startsWith("/notes/") && result.path !== "/notes") {
      openNote(result.path.slice("/notes/".length));
      return;
    }
    if (result.kind === "project") {
      const repo = repos.find(item => item.name.toLowerCase() === result.label.toLowerCase());
      if (repo) openProject(repo);
      return;
    }
    setActiveSectionPath(result.path);
    showHome(false, false);
    setActiveSectionPath(result.path);
    if (window.location.pathname !== result.path) window.history.pushState({}, "", result.path);
    const target = result.path === "/projects" ? "work" : result.path === "/home" ? "home" : result.path.slice(1);
    scrollToSection(target);
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const coveredCaseStudyOrigin = caseStudyOriginRef.current;
      if (activeCaseStudy && coveredCaseStudyOrigin && path === coveredCaseStudyOrigin.path) {
        cancelSectionScroll();
        caseStudyOriginRef.current = null;
        setActiveCaseStudy(null);
        document.title = "Osameh Irandoust — Software Engineer";
        // Browser Back is navigation to the Case Studies index, so restore the
        // canonical section anchor. Escape/close still restores the exact
        // covered workspace position via useModalDialog.
        if (coveredCaseStudyOrigin.path === "/case-studies") {
          setActiveSectionPath("/case-studies");
          scrollToSection("case-studies", "auto", true);
        } else {
          setActiveSectionPath(coveredCaseStudyOrigin.sectionPath);
        }
        return;
      }
      const caseStudyMatch = path.match(/^\/case-studies\/([a-z0-9-]+)\/?$/i);
      if (caseStudyMatch) {
        const study = caseStudies.find(item => item.id === caseStudyMatch[1].toLowerCase());
        if (study) { openCaseStudy(study, false); return; }
      }
      const noteMatch = path.match(/^\/notes\/([a-z0-9-]+)\/?$/i);
      // The filter is part of the address, so Back and Forward restore it
      // before any route decision is made. The value is resolved rather than
      // trusted: history can carry an alias or a key that no longer exists.
      const restored = resolveStackParam(stackParamValue());
      setProjectTech(restored);
      normalizeStackParam(restored);
      if (noteMatch) {
        const slug = noteMatch[1].toLowerCase();
        if (engineeringNotes.some(note => note.slug === slug)) { openNote(slug, false); return; }
      }
      const projectMatch = path.match(/^\/projects\/([^/]+)\/?$/i);
      if (projectMatch) {
        let requested = projectMatch[1];
        try { requested = decodeURIComponent(requested); } catch { /* ignore */ }
        const repo = repos.find(item => item.name.toLowerCase() === requested.toLowerCase());
        if (repo) { openProject(repo, false); return; }
      }
      const section = sections.find(item => item.path === path);
      if (section) {
        showHome(false, false);
        setActiveSectionPath(section.path);
        const target = section.path === "/projects" ? "work" : section.path === "/home" ? "home" : section.path.slice(1);
        const exact = section.path === "/notes" || section.path === "/case-studies";
        scrollToSection(target, "auto", exact);
        return;
      }
      if (path === "/") { showHome(false); return; }
      setNotFoundPath(path);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [repos, activeCaseStudy, cancelSectionScroll]);

  // Filter state lives in the query string so it can be shared, restored on a
  // direct load, and undone with Back. It is a query parameter on the existing
  // document rather than a new route, so no new indexable URL class is created
  // and the canonical stays the one the page already declares.
  const stackParamValue = () => new URLSearchParams(window.location.search).get("stack") || "all";

  /**
   * The one canonical reading of ?stack=. An alias resolves to its canonical
   * key, and anything that names no available technology resolves to "all" -
   * so a stale or hand-typed value can never leave the controls showing "All
   * technologies" beside an empty result.
   */
  const resolveStackParam = (raw: string): string => {
    if (!raw || raw === "all") return "all";
    if (projectTechOptions.includes(raw)) return raw;
    const [canonical] = canonicalKeys(raw);
    return canonical && projectTechOptions.includes(canonical) ? canonical : "all";
  };

  /** Rewrite the address to the canonical form, without adding history noise. */
  const normalizeStackParam = (resolved: string) => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("stack");
    if (raw === null) return;
    if (resolved === "all") url.searchParams.delete("stack");
    else if (raw !== resolved) url.searchParams.set("stack", resolved);
    else return;
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  };

  const writeStackParam = (key: string) => {
    const url = new URL(window.location.href);
    if (key === "all") url.searchParams.delete("stack");
    else url.searchParams.set("stack", key);
    const next = url.pathname + (url.search ? url.search : "") + url.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.pushState({ ...(window.history.state || {}), stack: key }, "", next);
    }
  };

  /** Set the technology filter and record it in the URL. */
  const applyProjectTech = (key: string, updateHistory = true) => {
    setProjectTech(key);
    setVisibleRepos(6);
    if (updateHistory) writeStackParam(key);
  };

  const clearProjectFilters = () => {
    setProjectQuery("");
    applyProjectTech("all");
  };

  const projectSearchText = (repo: GithubRepo) => {
    const meta = repoMetadata[repo.name];
    const metadataTerms = meta ? [
      meta.project.name, meta.project.tagline, meta.project.summary, meta.project.type, meta.project.lifecycle,
      meta.ownership.role, meta.ownership.organization || "", ...meta.ownership.responsibilities,
      ...meta.stack.languages, ...meta.stack.frameworks, ...meta.stack.libraries, ...meta.stack.platforms,
      ...meta.stack.databases, ...meta.stack.tooling, ...meta.stack.concepts, ...meta.recruiter.skillsDemonstrated,
      ...meta.recruiter.talkingPoints, meta.caseStudy.problem, meta.caseStudy.solution,
    ].join(" ") : "";
    return `${repo.name} ${repo.description || ""} ${repo.language || ""} ${repo.topics.join(" ")} ${metadataTerms}`.toLowerCase();
  };

  // Every raw technology spelling a repository carries, in one place.
  const repoTechTokens = (repo: GithubRepo): string[] => {
    const meta = repoMetadata[repo.name];
    return [repo.language || "", ...repo.topics, ...(meta ? [...meta.stack.languages, ...meta.stack.frameworks, ...meta.stack.libraries, ...meta.stack.databases, ...meta.stack.platforms, ...meta.stack.tooling] : [])].filter(Boolean);
  };

  // Filter options are canonical technologies, not raw tokens. Descriptive
  // portfolio.json concepts are deliberately absent: they are real metadata but
  // nothing a visitor would filter projects by, and they were most of the noise.
  const projectTechOptions: string[] = Array.from(new Set(repos.flatMap(repo => canonicalKeysFor(repoTechTokens(repo)))))
    .sort((a, b) => technologyLabel(a).localeCompare(technologyLabel(b)));

  // One view of how content connects, assembled from data already loaded.
  // No extra request, no index file, no graph library.
  const relatedSource: RelatedSource = {
    projects: repos.map(repo => ({
      name: repo.name,
      title: repoMetadata[repo.name]?.project.name || repo.name,
      hint: repoMetadata[repo.name]?.project.type || repo.language || "Repository",
      technologies: repoTechTokens(repo),
    })),
    notes: engineeringNotes.map(note => ({ slug: note.slug, title: note.title, hint: "Engineering note", tags: note.tags, relatedProjects: note.relatedProjects, relatedCaseStudies: note.relatedCaseStudies })),
    caseStudies: caseStudies.map(study => ({ id: study.id, title: study.title, hint: "Client case study", stack: study.stack, relatedProjects: study.relatedProjects, relatedNotes: study.relatedNotes })),
  };

  const openRelated = (item: RelatedItem) => {
    if (item.kind === "project") { const repo = repos.find(candidate => candidate.name === item.id); if (repo) openProject(repo); return; }
    if (item.kind === "note") { openNote(item.id); return; }
    const study = caseStudies.find(candidate => candidate.id === item.id);
    if (study) openCaseStudy(study);
  };


  const terminalBaseCommands = [
    "help", "whoami", "ls", "exp", "skills", "projects", "contact", "version", "build", "neofetch",
    "resume", "recruiter", "now", "activity", "changelog", "notes", "case-studies", "cases", "capabilities", "palette", "availability", "mood", "mood:list", "accessibility", "health", "status", "diagnostics", "install", "shortcuts", "theme",
    "clear", "sudo hire osameh", "sudo su", "cat welcome.txt",
    ...sections.map(item => item.path),
  ];

  const terminalCompletionCandidates = (value: string) => {
    const raw = value.trimStart();
    const lower = raw.toLowerCase();
    const projectNames = repos.map(repo => repo.name);
    let candidates: string[];
    if (lower.startsWith("cat note ")) candidates = engineeringNotes.map(note => `cat note ${note.slug}`);
    else if (lower.startsWith("cat ")) candidates = [...projectNames.map(name => `cat ${name}`), "cat note "];
    else if (lower.startsWith("notes ")) candidates = engineeringNotes.flatMap(note => [note.slug, ...note.tags]).map(term => `notes ${term}`);
    else if (lower.startsWith("case ")) candidates = caseStudies.map(study => `case ${study.id}`);
    else if (lower.startsWith("share ")) candidates = projectNames.map(name => `share ${name}`);
    else if (lower.startsWith("open ")) candidates = ["github", "gitlab", "linkedin", "telegram", "instagram", "whatsapp", "mail", "business"].map(name => `open ${name}`);
    else if (lower.startsWith("search ")) candidates = [...projectTechOptions, ...projectNames].map(term => `search ${term}`);
    else candidates = [...terminalBaseCommands, "cat ", "cat note ", "notes", "notes ", "case ", "health", "share ", "open ", "search "];
    return Array.from(new Set(candidates)).filter(candidate => candidate.toLowerCase().startsWith(lower));
  };

  const terminalGhostSuffix = (() => {
    if (!terminalInput) return "";
    const match = terminalCompletionCandidates(terminalInput)[0];
    if (!match || match.length <= terminalInput.length) return "";
    if (!match.toLowerCase().startsWith(terminalInput.toLowerCase())) return "";
    return match.slice(terminalInput.length);
  })();

  const autocompleteTerminal = (reverse = false) => {
    const current = terminalInput;
    const state = terminalCompletionRef.current;
    const continuing = state.matches.length > 0 && current === state.applied;
    const matches = continuing ? state.matches : terminalCompletionCandidates(current);
    if (!matches.length) {
      terminalCompletionRef.current = { seed: "", matches: [], index: -1, applied: "" };
      showActionToast(`No autocomplete match for “${current || "command"}”.`, "info", 1800);
      return;
    }
    const nextIndex = continuing
      ? (state.index + (reverse ? -1 : 1) + matches.length) % matches.length
      : (reverse ? matches.length - 1 : 0);
    const next = matches[nextIndex];
    terminalCompletionRef.current = { seed: continuing ? state.seed : current, matches, index: nextIndex, applied: next };
    setTerminalInput(next);
    window.requestAnimationFrame(() => {
      const input = terminalInputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(next.length, next.length);
    });
  };

  const runTerminal = (event: FormEvent) => {
    event.preventDefault();
    const raw = terminalInput.trim();
    if (!raw) return;
    setTerminalInput("");
    const command = raw.toLowerCase();
    if (command === "clear") { setTerminalLines([]); setSearchResults([]); return; }
    if (command === "cat welcome.txt") {
      setTerminalLines(lines => [...lines, "› " + raw, "Hi — I'm Osameh, software engineer in Tehran. This site is a small editor.", "Type `help` for commands, or just scroll."]);
      setSearchResults([]); return;
    }
    if (command === "help" || command === "/help") {
      setTerminalLines(lines => [...lines, "› " + raw,
        "whoami        who is this guy",
        "ls            list live open tabs",
        "exp           work history",
        "skills        tech stack",
        "projects      jump to projects",
        "cat <repo>    open a project in an IDE tab",
        "contact       all the ways to reach me",
        "open <where>  github | gitlab | linkedin | telegram | instagram | whatsapp | mail",
        "search <text> search site content",
        "version       print deployed version",
        "build         open build information",
        "neofetch      portfolio system summary",
        "resume        open the embedded CV",
        "recruiter     start the guided recruiter tour",
        "now           current focus",
        "activity      recent GitHub repository activity",
        "changelog     portfolio release history",
        "notes         engineering notes index",
        "notes <text>  search engineering notes",
        "cat note <id> open an engineering note",
        "case-studies  published client work + capabilities",
        "case <id>     open a case study directly",
        "capabilities  list what I can build",
        "palette       open Command Palette (Ctrl/Cmd+Shift+P)",
        "availability  current collaboration status",
        "mood          current portfolio availability mood",
        "mood:list     list the five availability presets",
        "accessibility open accessibility controls",
        "health        live origin and GitHub health center",
        "status        local diagnostics",
        "install       install the PWA when available",
        "shortcuts     keyboard navigation map",
        "share <repo>  share a project deep link",
        "hire          run a tiny easter egg",
        "clear         clear the screen",
        "tab           autocomplete commands, projects, services, and search terms",
        "shift+tab     cycle autocomplete backwards",
        "`             toggle terminal  ·  esc closes the active tab"]);
      setSearchResults([]);
      return;
    }
    if (command === "version" || command === "--version") {
      setTerminalLines(lines => [...lines, "› " + raw, `osameh.dev ${formatReleaseLabel(BUILD_VERSION, { uppercase: false })}`]);
      setSearchResults([]); return;
    }
    if (command === "build") {
      setTerminalLines(lines => [...lines, "› " + raw, "opening build-info.json…"]);
      setSearchResults([]);
      window.dispatchEvent(new Event("portfolio:build"));
      return;
    }
    if (command === "sudo hire osameh" || command === "hire" || command === "hire osameh") {
      setTerminalLines(lines => [...lines, "› " + raw,
        "Checking skills...",
        ".NET / backend          ✓",
        "React / Vue / Nuxt      ✓",
        "Systems / DevOps        ✓",
        "Product engineering     ✓",
        "",
        "Access granted.",
        "Let's build something great.",
      ]);
      setSearchResults([]); return;
    }
    if (command === "neofetch") {
      setTerminalLines(lines => [...lines, "› " + raw,
        "        OSAMEH.DEV // NEURAL CIPHER",
        "  -----------------------------",
        "  Role      Software Engineer",
        "  Focus     Backend · Full-Stack · Systems",
        "  Stack     .NET · C++ · Nuxt · PHP · SQL",
        `  Projects  ${repos.length} public repositories`,
        `  Build     ${BUILD_VERSION}`,
        ...(BUILD_CODENAME ? [`  Codename  ${BUILD_CODENAME}`] : []),
        `  Mood      ${availabilityConfig.activeStatus} · ${availabilityProfile.shortLabel}`,
        `  Cases     ${caseStudies.length} published · ${capabilities.length} capabilities`,
        `  Theme     ${document.documentElement.dataset.theme || "dark"}`,
        `  Network   ${navigator.onLine ? "online" : "offline"}`,
        "  Status    Ready to build_",
      ]); setSearchResults([]); return;
    }
    if (command === "sudo su") {
      setTerminalLines(lines => [...lines, "› " + raw, "root access denied: this portfolio follows least privilege.", "Nice try though. ✦"]); setSearchResults([]); return;
    }
    if (command === "resume" || command === "cv") {
      setTerminalLines(lines => [...lines, "› " + raw, "opening resume.pdf…"]); setSearchResults([]); window.dispatchEvent(new Event("portfolio:resume")); return;
    }
    if (command === "recruiter" || command === "recruiter-mode") {
      setTerminalLines(lines => [...lines, "› " + raw, "starting recruiter-mode.tour…"]); setSearchResults([]); setRecruiterModeOpen(true); return;
    }
    if (command === "now") { setTerminalLines(lines => [...lines, "› " + raw, "opening /now…"]); setSearchResults([]); goTo(sectionByPath("/now")); return; }
    if (command === "activity" || command === "github-activity") { setTerminalLines(lines => [...lines, "› " + raw, "opening /activity…"]); setSearchResults([]); goTo(sectionByPath("/activity")); return; }
    if (command === "changelog") { setTerminalLines(lines => [...lines, "› " + raw, "opening /changelog…"]); setSearchResults([]); goTo(sectionByPath("/changelog")); return; }
    if (command === "notes") { setTerminalLines(lines => [...lines, "› " + raw, "opening /notes…"]); setSearchResults([]); goTo(sectionByPath("/notes")); return; }
    if (command === "case-studies" || command === "cases") { setTerminalLines(lines => [...lines, "› " + raw, `published case studies: ${caseStudies.length}`, ...caseStudies.map(study => `  ${study.id}  ${study.title}`), `capabilities: ${capabilities.length}`, "opening /case-studies…"]); setSearchResults([]); goTo(sectionByPath("/case-studies")); return; }
    if (command.startsWith("case ")) { const id = raw.slice(5).trim().toLowerCase(); const study = caseStudies.find(item => item.id === id); if (study) { setTerminalLines(lines => [...lines, "› " + raw, `opening case-study/${study.id}.md…`]); setSearchResults([]); openCaseStudy(study); } else { setTerminalLines(lines => [...lines, "› " + raw, `case study not found: ${id}`, "Run `case-studies` to list published work."]); } return; }
    if (command === "capabilities") { setTerminalLines(lines => [...lines, "› " + raw, `capabilities (${capabilities.length}):`, ...capabilities.map(item => `  ${item.title} — ${item.focus.slice(0, 2).join(" · ")}`)]); setSearchResults([]); return; }
    if (command === "palette" || command === "command-palette") { setTerminalLines(lines => [...lines, "› " + raw, "opening Command Palette…"]); setSearchResults([]); openUniversalSearch(); return; }
    if (command === "mood:list") { const statuses = Object.entries(availabilityConfig.profiles).flatMap(([id, profile]) => [`Preset: ${id}`, `  Short label: ${profile.shortLabel}`, `  Public header label: ${profile.label}`]); setTerminalLines(lines => [...lines, "› " + raw, ...statuses]); setSearchResults([]); return; }
    if (command === "availability" || command === "mood") { setTerminalLines(lines => [...lines, "› " + raw, `mood: ${availabilityConfig.activeStatus}`, availabilityProfile.label]); setSearchResults([]); setAvailabilityOpen(true); return; }
    if (command === "accessibility" || command === "a11y") { setTerminalLines(lines => [...lines, "› " + raw, "opening accessibility controls…"]); setSearchResults([]); setAccessibilityOpen(true); return; }
    if (command === "health" || command === "status-server") { setTerminalLines(lines => [...lines, "› " + raw, "opening live system health…"]); setSearchResults([]); window.dispatchEvent(new Event("portfolio:diagnostics")); return; }
    if (command.startsWith("cat note ")) { const slug = raw.slice(9).trim().toLowerCase(); const note = engineeringNotes.find(item => item.slug === slug); if (note) { setTerminalLines(lines => [...lines, "› " + raw, `opening ${slug}.md…`]); setSearchResults([]); openNote(note.slug); } else { setTerminalLines(lines => [...lines, "› " + raw, `note not found: ${slug}`]); } return; }
    if (command.startsWith("notes ")) { const noteQuery = raw.slice(6).trim().toLowerCase(); const matches = engineeringNotes.filter(note => `${note.title} ${note.summary} ${note.tags.join(" ")} ${note.slug}`.toLowerCase().includes(noteQuery)); setTerminalLines(lines => [...lines, "› " + raw, matches.length ? `Found ${matches.length} engineering note${matches.length === 1 ? "" : "s"}.` : `No notes match “${noteQuery}”.`]); setSearchResults(matches.map(note => ({ label: note.title, path: `/notes/${note.slug}`, kind: "section" as const }))); return; }
    if (command === "status" || command === "diagnostics") { setTerminalLines(lines => [...lines, "› " + raw, "opening live system health…"]); setSearchResults([]); window.dispatchEvent(new Event("portfolio:diagnostics")); return; }
    if (command === "shortcuts" || command === "keys") { setTerminalLines(lines => [...lines, "› " + raw, "opening keyboard-shortcuts.md…"]); setSearchResults([]); window.dispatchEvent(new Event("portfolio:shortcuts")); return; }
    if (command === "install" || command === "pwa") { setTerminalLines(lines => [...lines, "› " + raw, "requesting install prompt…"]); setSearchResults([]); window.dispatchEvent(new Event("portfolio:install")); return; }
    if (command === "theme") { toggleThemeMode(); setTerminalLines(lines => [...lines, "› " + raw, "theme toggled."]); setSearchResults([]); return; }
    if (command.startsWith("share ")) {
      const name = raw.slice(6).trim().toLowerCase();
      const repo = repos.find(item => item.name.toLowerCase() === name);
      if (repo) { void shareProject(repo); setTerminalLines(lines => [...lines, "› " + raw, `sharing ${repo.name}…`]); }
      else {
        setTerminalLines(lines => [...lines, "› " + raw, `share: project “${name}” not found`]);
        showActionToast(`Project “${name}” was not found.`, "error", 4200);
      }
      setSearchResults([]); return;
    }
    if (command === "whoami") {
      setTerminalLines(lines => [...lines, "› " + raw, "osameh irandoust — software engineer (backend | full-stack | systems)", "Tehran, Iran · B.Sc. University of Tehran · currently @ Navatel"]);
      setSearchResults([]); return;
    }
    if (command === "ls") {
      const liveTabs = [
        `${activeTabId === HOME_TAB_ID && !activeCaseStudy && !notFoundPath ? "*" : " "} ${code.file}  [home]`,
        ...editorTabs.map(tab => `${activeTabId === tab.id ? "*" : " "} ${tab.title}  [${tab.kind}]`),
        ...(activeCaseStudy ? [`* case-study/${activeCaseStudy.id}.md  [case-study]`] : []),
        ...(notFoundPath ? ["* 404.md  [not found]"] : []),
      ];
      setTerminalLines(lines => [...lines, "› " + raw, `open tabs (${liveTabs.length}):`, ...liveTabs, "* = active tab"]);
      setSearchResults([]); return;
    }
    if (command === "exp") {
      setTerminalLines(lines => [...lines, "› " + raw,
        "Navatel        Software Engineer        Apr 2026 — present",
        "Fluxudio       Software Engineer        2024 — 2026",
        "Datall         Full Stack Developer     2021 — 2024",
        "Arrap Startup  Android Developer        2019 — 2021",
        "Freelance      Software Developer       2017 — present"]);
      setSearchResults([]); return;
    }
    if (command === "skills") {
      setTerminalLines(lines => [...lines, "› " + raw,
        "C++ · C# / .NET · Nuxt.js · Python · Java · Kotlin · PHP · Ruby",
        "PostgreSQL · MySQL · Cassandra · Elasticsearch · Docker · ELK · Linux"]);
      setSearchResults([]); return;
    }
    if (command === "projects") {
      setTerminalLines(lines => [...lines, "› " + raw, `${repos.length} projects loaded from GitHub — scrolling down.`]);
      setSearchResults([]); goTo(sectionByPath("/projects")); return;
    }
    if (command === "contact") {
      setTerminalLines(lines => [...lines, "› " + raw,
        "personal  osirandoust@gmail.com",
        "business  support@osameh.dev",
        "telegram  @osameh_ir",
        "whatsapp  +98 936 964 2754",
        "instagram @osameh.ir",
        "linkedin  osameh-irandoust"]);
      setSearchResults([]); return;
    }
    if (command.startsWith("cat ")) {
      const name = raw.slice(4).trim().replace(/\.md$/i, "").toLowerCase();
      const repo = repos.find(item => item.name.toLowerCase() === name);
      if (repo) {
        setTerminalLines(lines => [...lines, "› " + raw, `opening ${repo.name} in an IDE tab…`]);
        setSearchResults([]); openProject(repo);
      } else {
        setTerminalLines(lines => [...lines, "› " + raw, `cat: ${name || "<repo>"}: project not found`, "Run `projects` to view available repositories."]);
        setSearchResults([]);
        showActionToast(`Project “${name || "<repo>"}” was not found.`, "error", 4200);
      }
      return;
    }
    if (command.startsWith("open ")) {
      const service = command.slice(5).trim();
      const destinations: Record<string, string> = {
        github: "https://github.com/osameh15", gitlab: "https://gitlab.com/osameh15",
        linkedin: "https://www.linkedin.com/in/osameh-irandoust-493359173/", telegram: "https://t.me/osameh_ir",
        instagram: "https://instagram.com/osameh.ir", whatsapp: "https://wa.me/989369642754",
        mail: "mailto:osirandoust@gmail.com", business: "mailto:support@osameh.dev",
      };
      if (destinations[service]) {
        setTerminalLines(lines => [...lines, "› " + raw, `opening ${service}…`]);
        setSearchResults([]); window.open(destinations[service], "_blank", "noopener,noreferrer");
      } else {
        setTerminalLines(lines => [...lines, "› " + raw, `open: unknown destination “${service}”`, "Try github, gitlab, linkedin, telegram, instagram, whatsapp, mail, or business."]);
        setSearchResults([]);
        showActionToast(`Unknown destination “${service}”.`, "warning", 4000);
      }
      return;
    }
    const route = sections.find(item => item.path === raw.toLowerCase());
    if (route) {
      setTerminalLines(lines => [...lines, "› " + raw, "Opening " + route.label + "…"]);
      setSearchResults([]);
      goTo(route);
      return;
    }
    if (raw.startsWith("/")) {
      const name = raw.replace(/^\/projects?\//, "").replace(/^\//, "").toLowerCase();
      const repo = repos.find(item => item.name.toLowerCase() === name);
      if (repo) {
        setTerminalLines(lines => [...lines, "› " + raw, "Opening " + repo.name + ".md…"]);
        setSearchResults([]);
        openProject(repo);
      } else {
        setTerminalLines(lines => [...lines, "› " + raw, "Command not found: " + raw, "Try /help or /projects."]);
        setSearchResults([]);
        showActionToast(`Command not found: ${raw}`, "error", 4000);
      }
      return;
    }
    const query = raw.toLowerCase().replace(/^search\s+/, "").trim();
    const sectionTerms: Record<string, string> = {
      "/home": "home portfolio software engineer",
      "/about": "about profile bio skills stack docker linux wpf dotnet nuxt backend full stack systems",
      "/projects": "projects work repositories github source architecture code technologies",
      "/case-studies": "case studies client freelance amorella capabilities product delivery modernization communications",
      "/experience": "experience career jobs freelance backend full stack android wordpress",
      "/activity": "github activity commits repository recent activity",
      "/now": "now current working learning focus",
      "/changelog": "changelog release versions updates history",
      "/notes": "notes engineering blog articles architecture devops security caching github",
      "/contact": "contact email telegram linkedin whatsapp business",
    };
    const sectionMatches = sections.filter(item => `${item.label} ${item.path} ${sectionTerms[item.path] || ""}`.toLowerCase().includes(query));
    const projectMatches = repos
      .filter(repo => projectSearchText(repo).includes(query))
      .map(repo => ({ label: repo.name, path: "/" + repo.name, kind: "project" as const }));
    const noteMatches = engineeringNotes
      .filter(note => `${note.title} ${note.summary} ${note.tags.join(" ")} ${note.slug}`.toLowerCase().includes(query))
      .map(note => ({ label: note.title, path: `/notes/${note.slug}`, kind: "section" as const }));
    const caseStudyMatches = caseStudies
      .filter(study => `${study.title} ${study.client} ${study.industry} ${study.stack.join(" ")} ${study.summary}`.toLowerCase().includes(query))
      .map(study => ({ label: study.title, path: `/case-studies/${study.id}`, kind: "section" as const }));
    const matches: SearchResult[] = [...sectionMatches, ...projectMatches, ...noteMatches, ...caseStudyMatches].filter((item, index, all) => all.findIndex(other => other.kind === item.kind && other.path === item.path) === index);
    setTerminalLines(lines => [...lines, "› " + raw, matches.length ? "Found " + matches.length + " result" + (matches.length === 1 ? "." : "s.") : "No matches for “" + query + "”."]);
    setSearchResults(matches.slice(0, 10));
    if (!matches.length) showActionToast(`No matches for “${query}”.`, "info");
  };

  const paletteCommands: PaletteCommand[] = [
    { id: "home", label: "Go to Home", hint: "/home", keywords: "home start portfolio", icon: "home", action: () => goTo(sectionByPath("/home")) },
    { id: "projects", label: "Go to Projects", hint: "/projects", keywords: "work repos github projects", icon: "code", action: () => goTo(sectionByPath("/projects")) },
    { id: "about", label: "Go to About", hint: "/about", keywords: "about profile bio", icon: "about", action: () => goTo(sectionByPath("/about")) },
    { id: "experience", label: "Go to Experience", hint: "/experience", keywords: "experience jobs career", icon: "experience", action: () => goTo(sectionByPath("/experience")) },
    { id: "activity", label: "Open GitHub Activity", hint: "/activity", keywords: "github activity commits repositories recent", icon: "github", action: () => goTo(sectionByPath("/activity")) },
    { id: "contact", label: "Go to Contact", hint: "/contact", keywords: "contact email social", icon: "contact", action: () => goTo(sectionByPath("/contact")) },
    { id: "now", label: "Go to Now", hint: "/now", keywords: "now current working learning", icon: "about", action: () => goTo(sectionByPath("/now")) },
    { id: "changelog", label: "Open Changelog", hint: "/changelog", keywords: "changelog releases versions updates", icon: "build", action: () => goTo(sectionByPath("/changelog")) },
    { id: "notes", label: "Open Engineering Notes", hint: "/notes", keywords: "notes blog articles engineering architecture devops", icon: "about", action: () => goTo(sectionByPath("/notes")) },
    { id: "case-studies", label: "Open Case Studies", hint: "/case-studies", keywords: "case studies freelance client work outcomes architecture consulting", icon: "experience", action: () => goTo(sectionByPath("/case-studies")) },
    { id: "availability", label: t("availabilityTitle"), hint: availabilityProfile.label, keywords: `availability hiring freelance opportunities work recruiter ${availabilityProfile.label}`, icon: "hire", action: () => setAvailabilityOpen(true) },
    { id: "accessibility", label: t("accessibilityTitle"), hint: "preferences", keywords: "accessibility contrast motion focus larger text wcag", icon: "theme", action: () => setAccessibilityOpen(true) },
    { id: "resume", label: "Open Resume", hint: "resume.pdf", keywords: "resume cv download career", icon: "experience", action: () => window.dispatchEvent(new Event("portfolio:resume")) },
    { id: "recruiter", label: "Start Recruiter Mode", hint: "guided tour", keywords: "recruiter tour featured hiring shortlist", icon: "hire", action: () => setRecruiterModeOpen(true) },
    { id: "diagnostics", label: "System Health Center", hint: "/status", keywords: "status health diagnostics latency system pwa api build github", icon: "build", action: () => window.dispatchEvent(new Event("portfolio:diagnostics")) },
    { id: "shortcuts", label: "Keyboard Shortcuts", hint: "?", keywords: "keyboard shortcuts keys navigation", icon: "copy", action: () => window.dispatchEvent(new Event("portfolio:shortcuts")) },
    { id: "install", label: "Install Portfolio App", hint: "PWA", keywords: "install pwa offline app", icon: "build", action: () => window.dispatchEvent(new Event("portfolio:install")) },
    { id: "terminal", label: "Open Terminal", hint: "`", keywords: "terminal shell cli command", icon: "terminal", action: () => openTerminal() },
    { id: "theme", label: `Switch to ${document.documentElement.dataset.theme === "light" ? "Dark" : "Light"} Theme`, hint: "theme", keywords: "theme dark light appearance", icon: "theme", action: toggleThemeMode },
    { id: "github", label: "Open GitHub", hint: "github.com/osameh15", keywords: "github source repositories", icon: "github", action: () => window.open("https://github.com/osameh15", "_blank", "noopener,noreferrer") },
    { id: "linkedin", label: "Open LinkedIn", hint: "linkedin", keywords: "linkedin career profile", icon: "linkedin", action: () => window.open("https://www.linkedin.com/in/osameh-irandoust-493359173/", "_blank", "noopener,noreferrer") },
    { id: "copy-url", label: "Copy Portfolio URL", hint: "osameh.dev", keywords: "copy link url share", icon: "copy", action: () => { void copyText(window.location.origin + "/", "Portfolio URL copied"); } },
    { id: "build", label: "View Build Info", hint: BUILD_DISPLAY, keywords: "build version deploy cache", icon: "build", action: () => window.dispatchEvent(new Event("portfolio:build")) },
    { id: "hire", label: "sudo hire osameh", hint: "easter egg", keywords: "hire sudo easter egg terminal", icon: "hire", action: runHireEasterEgg },
    ...projectTechOptions.map(tech => ({ id: `tech-${tech}`, label: `Filter projects by ${technologyLabel(tech)}`, hint: "technology", keywords: `technology stack skill filter projects ${technologyLabel(tech)} ${(TECHNOLOGIES[tech]?.aliases || []).join(" ")}`, icon: "code" as const, action: () => exploreTech(tech) })),
    ...engineeringNotes.map(note => ({ id: `note-${note.slug}`, label: `Read note: ${note.title}`, hint: `${note.readingMinutes} min · ${note.tags[0]}`, keywords: `note article blog ${note.slug} ${note.summary} ${note.tags.join(" ")}`, icon: "about" as const, action: () => openNote(note.slug) })),
    ...capabilities.map(capability => ({ id: `capability-${capability.id}`, label: `Capability: ${capability.title}`, hint: "What I can build", keywords: `capability services freelance ${capability.summary} ${capability.focus.join(" ")} ${capability.technologies.join(" ")}`, icon: "code" as const, action: () => goTo(sectionByPath("/case-studies")) })),
    ...caseStudies.map(study => ({ id: `case-study-${study.id}`, label: `Case study: ${study.title}`, hint: study.industry, keywords: `case study client freelance ${study.summary} ${study.stack.join(" ")} ${study.relatedSkills.join(" ")}`, icon: "experience" as const, action: () => openCaseStudy(study) })),
    ...skills.flatMap(([group, ...items]) => items.map((skill, index) => ({ id: `skill-${group}-${index}-${skill}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: `Skill: ${skill}`, hint: group, keywords: `skill technology stack ${group} ${skill}`, icon: "code" as const, action: () => exploreTech(skill) }))),
    ...roles.map((role, index) => ({ id: `role-${index}`, label: `${role.role} @ ${role.company}`, hint: role.years, keywords: `experience career role company ${role.company} ${role.role} ${role.detail}`, icon: "experience" as const, action: () => goTo(sectionByPath("/experience")) })),
    ...repos.map(repo => ({ id: `project-${repo.id}`, label: `Open project: ${repoMetadata[repo.name]?.project.name || repo.name}`, hint: repoMetadata[repo.name]?.project.type || repo.language || "GitHub", keywords: `project repo ${projectSearchText(repo)}`, icon: "code" as const, action: () => openProject(repo) })),
  ];
  const normalizedCommandQuery = commandQuery.trim().toLowerCase();
  const filteredPaletteCommands = paletteCommands
    .map(item => ({ item, score: universalSearchScore(normalizedCommandQuery, item) }))
    .filter(entry => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .map(entry => entry.item);
  const safeCommandIndex = filteredPaletteCommands.length ? Math.min(commandIndex, filteredPaletteCommands.length - 1) : 0;
  const runPaletteCommand = (item: PaletteCommand) => {
    // Queue the destination rather than running it here. Behind a still-open
    // palette a destination would read a frozen body, and its own scroll would
    // then be overridden by the palette's restore on unlock.
    pendingPaletteActionRef.current = item.action;
    setCommandPaletteOpen(false);
    setCommandQuery("");
  };
  const paletteIcon = (icon: PaletteCommand["icon"]) => {
    if (icon === "home") return <HomeIcon size={16} />;
    if (icon === "code") return <Code2 size={16} />;
    if (icon === "about") return <Braces size={16} />;
    if (icon === "experience") return <FileCode2 size={16} />;
    if (icon === "contact") return <Mail size={16} />;
    if (icon === "terminal") return <Terminal size={16} />;
    if (icon === "theme") return document.documentElement.dataset.theme === "light" ? <Moon size={16} /> : <Sun size={16} />;
    if (icon === "github") return <Github size={16} />;
    if (icon === "linkedin") return <Linkedin size={16} />;
    if (icon === "copy") return <Copy size={16} />;
    if (icon === "build") return <RefreshCw size={16} />;
    return <Command size={16} />;
  };
  const contextRepo = contextMenu?.repoName ? repos.find(repo => repo.name.toLowerCase() === contextMenu.repoName?.toLowerCase()) || fallbackRepos.find(repo => repo.name.toLowerCase() === contextMenu.repoName?.toLowerCase()) || null : null;
  const contextNote = contextMenu?.noteSlug ? engineeringNotes.find(note => note.slug === contextMenu.noteSlug) || null : null;
  const contextCaseStudy = contextMenu?.caseStudyId ? caseStudies.find(study => study.id === contextMenu.caseStudyId) || null : null;
  // A filtered URL opened directly restores its filter once the options exist.
  useEffect(() => {
    if (!repos.length) return;
    const resolved = resolveStackParam(stackParamValue());
    if (resolved !== projectTech) setProjectTech(resolved);
    normalizeStackParam(resolved);
  }, [repos.length, projectTechOptions.join("|")]);

  const projectShareUrl = (repo: GithubRepo) => `${window.location.origin}/projects/${encodeURIComponent(repo.name)}`;
  const noteShareUrl = (slug: string) => `${window.location.origin}/notes/${encodeURIComponent(slug)}`;
  const caseStudyShareUrl = (id: string) => `${window.location.origin}/case-studies/${encodeURIComponent(id)}`;
  const runContextAction = (action: () => void) => { setContextMenu(null); action(); };
  const normalizedProjectQuery = projectQuery.trim().toLowerCase();
  const filteredRepos = [...repos].filter(repo => {
    const queryMatch = !normalizedProjectQuery || projectSearchText(repo).includes(normalizedProjectQuery);
    const techMatch = projectTech === "all" || canonicalKeysFor(repoTechTokens(repo)).includes(projectTech);
    return queryMatch && techMatch;
  }).sort((a, b) => projectSort === "stars" ? b.stargazers_count - a.stargazers_count : projectSort === "name" ? a.name.localeCompare(b.name) : Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const toggleCompareRepo = (repo: GithubRepo) => setCompareRepos(current => current.some(item => item.id === repo.id) ? current.filter(item => item.id !== repo.id) : current.length >= 2 ? [current[1], repo] : [...current, repo]);
  const exploreTech = (tech: string) => {
    // One registry decides what a technology name means, so "Android Studio",
    // "android-app" and "Android" all land on the same filter.
    const [canonical] = canonicalKeys(tech);
    const available = canonical && projectTechOptions.includes(canonical) ? canonical : "";
    // Filtering from the Command Palette should land on the actual filter controls,
    // not at the Featured/Recruiter block above them.
    setNotFoundPath(null);
    setActiveTabId(HOME_TAB_ID);
    setActiveSectionPath("/projects");
    setPanelOpen(false);
    document.title = "Osameh Irandoust — Software Engineer";
    // The route is normalised first; the filter is written onto it afterwards,
    // so this push cannot discard the query string the filter just added.
    if (window.location.pathname !== "/") window.history.pushState({}, "", "/");

    if (available) { applyProjectTech(available); setProjectQuery(""); }
    else { applyProjectTech("all"); setProjectQuery(tech); }
    window.setTimeout(() => document.getElementById("project-filter-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 70);
  };

  return (
    <main>
      <header className="topbar">
        <a href="#home" className="logo-link" aria-label="Osameh Irandoust — home"><BrandMark /></a>
        <div className="ide-file-menu">
          <button className={fileMenuOpen ? "file-menu-trigger active" : "file-menu-trigger"} onClick={() => setFileMenuOpen(open => !open)} aria-expanded={fileMenuOpen} aria-haspopup="menu">File <ChevronDown size={12} /></button>
          {fileMenuOpen && <div className="file-menu-popover" role="menu">
            <div className="menu-group"><p><Sun size={13} /> Theme</p>
              {(["light", "dark", "system"] as ThemePreference[]).map(option => <button key={option} onClick={() => setTheme(option)}><span>{option === "light" ? <Sun size={14} /> : option === "dark" ? <Moon size={14} /> : <Monitor size={14} />}{option[0].toUpperCase() + option.slice(1)}</span>{theme === option && <Check size={14} />}</button>)}
            </div>
            <div className="menu-group"><p><Type size={13} /> Font</p>
              {fontOptions.map(option => <button key={option.id} onClick={() => setFont(option.id)}><span><i className={'font-sample sample-' + option.id}>{option.sample}</i>{option.label}</span>{font === option.id && <Check size={14} />}</button>)}
            </div>
            <div className="menu-group"><p><Code2 size={13} /> Programming language</p>
              {(Object.entries(codeProfiles) as [CodeLanguage, typeof code][]).map(([id, profile]) => <button key={id} onClick={() => setCodeLanguage(id)}><span><i className="language-dot" />{profile.label}</span>{codeLanguage === id && <Check size={14} />}</button>)}
            </div>
            <div className="menu-group accessibility-menu-group"><p><AccessibilityIcon size={13} /> {t("accessibility")}</p>
              <button onClick={() => { setFileMenuOpen(false); setAccessibilityOpen(true); }}><span><AccessibilityIcon size={14} />{t("accessibilityTitle")}</span><ChevronRight size={14} /></button>
            </div>
            <div className="menu-foot">{t("preferencesSaved")}</div>
          </div>}
        </div>
        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Primary navigation">
          {[{ label: t("navAbout"), section: sectionByPath("/about") }, { label: t("navWork"), section: sectionByPath("/projects") }, { label: t("navCaseStudies"), section: sectionByPath("/case-studies") }, { label: t("navExperience"), section: sectionByPath("/experience") }, { label: t("navNow"), section: sectionByPath("/now") }, { label: t("navNotes"), section: sectionByPath("/notes") }, { label: t("navContact"), section: sectionByPath("/contact") }].map(item => <a href={item.section.path} key={item.label} onClick={event => { event.preventDefault(); setMenuOpen(false); goTo(item.section); }}>{item.label}</a>)}
        </nav>
        <div className="header-actions">
          <PwaInstallControl />
          <button type="button" className="feature-icon-button universal-search-button" aria-label={t("universalSearch")} title={`${t("universalSearch")} (Ctrl/Cmd + Shift + P)`} onClick={openUniversalSearch}><Search size={16} aria-hidden="true" /></button>
          <AccessibilityControlButton />
          <AvailabilityBadge />
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>
      {offline && <div className="offline-banner" role="status"><span>OFFLINE MODE</span> Cached portfolio shell is active. GitHub content may use the last available data.</div>}

      <div className="workspace">
        <aside className="contact-dock" aria-label="Quick contact">
          <a href="https://instagram.com/osameh.ir" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={19} /><span>Instagram</span></a>
          <a href="https://wa.me/989369642754" target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={19} /><span>WhatsApp</span></a>
          <a href="https://t.me/osameh_ir" target="_blank" rel="noreferrer" aria-label="Telegram"><Send size={18} /><span>Telegram</span></a>
        </aside>
        <aside className="activity-bar" aria-label="Social links">
          <Code2 className="active-icon" size={21} />
          <a href="https://github.com/osameh15" target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={20} /></a>
          <a href="https://gitlab.com/osameh15" target="_blank" rel="noreferrer" aria-label="GitLab"><Gitlab size={20} /></a>
          <a href="https://www.linkedin.com/in/osameh-irandoust-493359173/" target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin size={20} /></a>
          <a href="https://t.me/osameh_ir" target="_blank" rel="noreferrer" aria-label="Telegram"><Send size={19} /></a>
          <span className="activity-line" /><span className="vertical-name">OSAMEH.DEV</span>
        </aside>

        <aside className="explorer">
          <p className="explorer-title">EXPLORER</p>
          <p className="folder"><ChevronDown size={14} /> OSAMEH-PORTFOLIO</p>
          <button className={activeSectionPath === "/home" && !activeRepo && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/home" && !activeRepo && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => showHome()}><FileCode2 size={15} /> {code.file}</button>
          <button className={activeSectionPath === "/about" && !activeRepo && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/about" && !activeRepo && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sectionByPath("/about"))}><Braces size={15} /> about.json</button>
          <button className={activeSectionPath === "/projects" && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/projects" && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sectionByPath("/projects"))}><FileCode2 size={15} /> {code.projects}</button>
          <button className={activeSectionPath === "/case-studies" && !activeRepo && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/case-studies" && !activeRepo && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sectionByPath("/case-studies"))}><FileCode2 size={14} /> case-studies</button>
          <button className={activeSectionPath === "/experience" && !activeRepo && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/experience" && !activeRepo && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sectionByPath("/experience"))}><ChevronRight size={14} /> experience</button>
          <button className={activeSectionPath === "/activity" && !activeRepo && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/activity" && !activeRepo && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sectionByPath("/activity"))}><Github size={14} /> github-activity</button>
          <button className={activeSectionPath === "/now" && !activeRepo && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/now" && !activeRepo && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sectionByPath("/now"))}><Zap size={14} /> now.md</button>
          <button className={activeSectionPath === "/changelog" && !activeRepo && !activeNoteSlug && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/changelog" && !activeRepo && !activeNoteSlug && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sectionByPath("/changelog"))}><RefreshCw size={14} /> changelog.md</button>
          <button className={activeSectionPath === "/notes" && !activeRepo && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/notes" && !activeRepo && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sectionByPath("/notes"))}><Braces size={14} /> engineering-notes</button>
          <button className={activeSectionPath === "/contact" && !activeRepo && !activeNoteSlug && !notFoundPath && !resumeOpen ? "file active" : "file"} aria-current={activeSectionPath === "/contact" && !activeRepo && !activeNoteSlug && !notFoundPath && !resumeOpen ? "page" : undefined} onClick={() => goTo(sectionByPath("/contact"))}><Mail size={14} /> contact.md</button>

          <div className="explorer-plugins" aria-label="Portfolio tools">
            <p className="explorer-plugins-title"><PanelBottom size={13} /> PORTFOLIO PLUGINS</p>
            <button className={resumeOpen ? "explorer-plugin active" : "explorer-plugin"} aria-pressed={resumeOpen} onClick={() => window.dispatchEvent(new Event("portfolio:resume"))}>
              <span className="explorer-plugin-icon"><Download size={16} /></span>
              <span className="explorer-plugin-copy"><b>Resume Viewer</b><small>CV preview · local PDF</small></span>
              <span className="explorer-plugin-badge">PDF</span>
            </button>
          </div>
          <div className="explorer-footer">
            <button onClick={() => { setPanelTab("outline"); setPanelOpen(true); }}><ListTree size={14} /> OUTLINE</button>
            <button onClick={() => openTerminal()}><Terminal size={14} /> TERMINAL</button>
          </div>
        </aside>

        <div className="editor">
          <div className="tabs-row" ref={tabsRowRef}>
            <button aria-current={activeTabId === HOME_TAB_ID && !notFoundPath ? "page" : undefined} className={activeTabId !== HOME_TAB_ID || notFoundPath ? "editor-tab" : "editor-tab active"} onClick={() => showHome(true, true, activeTab?.homeSection)}><FileCode2 size={14} /> {code.file}</button>
            {/* Two real buttons per tab: one activates, one closes. A button
                cannot legally contain another, so the tab box is the wrapper
                and keeps its class, data attributes and visual chrome. The
                lifecycle below is unchanged - the same openProject/openNote and
                closeTab calls, in the same order. */}
            {editorTabs.map(tab => <span
              key={tab.id}
              data-tab-id={tab.id}
              data-tab-kind={tab.kind}
              className={activeTabId === tab.id && !notFoundPath ? "editor-tab project-tab active" : "editor-tab project-tab"}
            >
              <button
                type="button"
                className="editor-tab-open"
                aria-current={activeTabId === tab.id && !notFoundPath ? "page" : undefined}
                onClick={() => tab.kind === "project" ? openProject(tab.repo) : openNote(tab.slug)}
              >
                {tab.kind === "project" ? <Code2 size={14} /> : <Braces size={14} />}
                <span>{tab.title}</span>
              </button>
              {/* stopPropagation keeps closing from also activating the tab. */}
              <button
                type="button"
                className="editor-tab-close"
                aria-label={`Close ${tab.title}`}
                onClick={event => { event.stopPropagation(); closeTab(tab.id); }}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>)}
            {notFoundPath && <span className="editor-tab project-tab error-tab active">
              <span className="editor-tab-open" aria-current="page"><FileCode2 size={14} /><span>404.md</span></span>
              <button type="button" className="editor-tab-close" aria-label="Close 404.md" onClick={event => { event.stopPropagation(); showHome(); }}><X size={12} aria-hidden="true" /></button>
            </span>}
          </div>

          {notFoundPath ? <section className="not-found-view">
            <div className="not-found-code" aria-hidden="true"><span>4</span><i>/</i><span>4</span></div>
            <p className="eyebrow">ROUTE_RESOLUTION_ERROR</p>
            <h1>File not found.</h1>
            <p>The route <code>{notFoundPath}</code> doesn’t exist in this workspace. It may have moved, been renamed, or never made it past review.</p>
            <div className="not-found-terminal"><span>osameh@portfolio:~$</span> resolve {notFoundPath}<br /><b>error:</b> no matching file or project route</div>
            <div className="detail-actions">
              <button className="primary-btn" onClick={() => showHome()}>Return to home <ArrowUpRight size={16} /></button>
              <button className="secondary-btn" onClick={() => { showHome(false, false); setActiveSectionPath("/projects"); if (window.location.pathname !== "/projects") window.history.pushState({}, "", "/projects"); scrollToSection("work"); }}>Browse projects</button>
            </div>
          </section> : activeNoteSlug ? <EngineeringNoteView slug={activeNoteSlug} onClose={() => closeNote()} onOpenNote={openNote} related={<ContinueExploring items={relatedToNote(activeNoteSlug, relatedSource, adjacentNotes(activeNoteSlug).next?.slug)} onOpen={openRelated} />} /> : activeRepo ? <section className="ide-project-view" data-project-name={activeRepo.name}>
            <ProjectQuickAccess repo={activeRepo} />
            <header id={`overview-${activeRepo.name}`} className="ide-project-hero">
              <div>
                <p className="eyebrow">PROJECT / {activeRepo.language || "CODE"}</p>
                <h1>{repoMetadata[activeRepo.name]?.project.name || activeRepo.name}</h1>
                <p>{repoMetadata[activeRepo.name]?.project.tagline || activeRepo.description || "Explore the source, architecture, and implementation of this project."}</p>
                <div className="detail-actions">
                  <a href={'https://github.com/osameh15/' + activeRepo.name} target="_blank" rel="noreferrer" className="primary-btn">View source <ArrowUpRight size={16} /></a>
                  {npmUrl(activeRepo.name) && <a href={npmUrl(activeRepo.name)} target="_blank" rel="noreferrer" className="npm-btn"><Package size={16} /> View on npm <ArrowUpRight size={14} /></a>}
                  <button className="secondary-btn" onClick={() => { void shareProject(activeRepo).then(ok => showActionToast(ok ? "Project shared" : "Share cancelled")); }}>Share project <Send size={15} /></button>
                  <button className="secondary-btn back-portfolio" onClick={() => closeProject(activeRepo, true)}>Back to portfolio</button>
                </div>
              </div>
              <div className="ide-project-image">{repoImages[activeRepo.name] && <img src={repoImages[activeRepo.name]} alt={'Preview from ' + activeRepo.name + ' README'} onError={event => { event.currentTarget.hidden = true; }} />}<div className="image-fallback"><Code2 size={34} /><span>README preview</span></div></div>
            </header>
            <div className="ide-project-body">
              <aside className="repo-facts">
                <div><Star size={17} /><span><b>{liveRepoData ? activeRepo.stargazers_count : "—"}</b> stars</span></div>
                <div><Github size={17} /><span><b>{liveRepoData ? activeRepo.forks_count : "—"}</b> forks</span></div>
                <div><Code2 size={17} /><span><b>{activeRepo.language || "Mixed"}</b> language</span></div>
                <p className="facts-label">TECH & TOPICS</p>
                <div className="tags">{[activeRepo.language, ...activeRepo.topics].filter(Boolean).map(tag => <span key={tag}>{tag}</span>)}</div>
              </aside>
              <article id={`readme-${activeRepo.name}`} className="readme-card"><div className="readme-head"><span>README.md · Preview</span><span>github / {activeRepo.name}</span></div>
                {loadingReadmes.includes(activeRepo.name) ? <div className="readme-loading"><LoaderCircle className="spin" size={19} /> Rendering README preview…</div> : readmeHtml[activeRepo.name] ? <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: readmeHtml[activeRepo.name] }} /> : <div className="empty-readme">This repository does not include a public README yet. Open the source to explore its files and implementation.</div>}
              </article>
            </div>
            <ProjectMetadataPanel repo={activeRepo} metadata={repoMetadata[activeRepo.name]} />
            <ProjectMetrics repo={activeRepo} />
            <ProjectCaseStudyV3 repo={activeRepo} metadata={repoMetadata[activeRepo.name]} />
            <ProjectArchitecture repo={activeRepo} metadata={repoMetadata[activeRepo.name]} />
            <ProjectSourceExplorer repo={activeRepo} metadata={repoMetadata[activeRepo.name]} />
            <section id={`gallery-${activeRepo.name}`} className="project-gallery" aria-labelledby={`gallery-title-${activeRepo.id}`}>
              <div className="project-gallery-heading">
                <div><p className="eyebrow">PROJECT / GALLERY</p><h2 id={`gallery-title-${activeRepo.id}`}>Project visuals.</h2></div>
                <span>{repoGalleries[activeRepo.name]?.length ? `${repoGalleries[activeRepo.name].length} repository images discovered automatically` : "Images are discovered across the repository automatically."}</span>
              </div>
              {loadingGalleries.includes(activeRepo.name) ? <div className="gallery-loading"><LoaderCircle className="spin" size={19} /> Discovering project images…</div> : repoGalleries[activeRepo.name]?.length ? <div className="project-gallery-grid">
                {repoGalleries[activeRepo.name].map((image, index) => <button type="button" className="project-gallery-item" key={`${image.url}-${index}`} data-project-name={activeRepo.name} data-image-url={image.url} data-image-index={index} onClick={() => setGalleryLightbox({ repo: activeRepo.name, index })} aria-label={`Open ${image.name || image.path} in gallery`}>
                  <img src={image.url} alt={image.name || `${activeRepo.name} project image ${index + 1}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={event => { event.currentTarget.closest("button")?.setAttribute("hidden", ""); }} />
                  <span><ImageIcon size={13} />{image.path}</span>
                </button>)}
              </div> : <div className="gallery-empty"><ImageIcon size={22} /><span>No project images were found in the repository or README.</span></div>}
            </section>
            <ContinueExploring items={relatedToProject(activeRepo.name, relatedSource)} onOpen={openRelated} />
          </section> : <>
          <section id="home" className="hero section-pad">
            <div className="line-nums" aria-hidden="true">01<br />02<br />03<br />04<br />05<br />06<br />07<br />08<br />09<br />10<br />11<br />12</div>
            <div className="hero-content">
              <p className={'code-kicker language-' + codeLanguage}>{code.open}</p>
              <p className="eyebrow">SOFTWARE ENGINEER · BACKEND · FULL-STACK · SYSTEMS</p>
              <h1>I build software<br />that stays <em>solid.</em></h1>
              <p className="hero-copy">I’m Osameh Irandoust — a software engineer turning complex systems into clear, fast, dependable products. From C++ internals to modern web experiences.</p>
              <div className="hero-actions">
                <a href="/projects" className="primary-btn" onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); goTo(sectionByPath("/projects")); }}>Explore my work <ArrowUpRight size={17} /></a>
                <button onClick={copyEmail} className="text-btn">{copied ? <><Check size={16} /> Email copied</> : <>Copy email <span>⌘E</span></>}</button>
              </div>
              <p className="code-close"><b>{code.close}</b> <span>{code.comment}</span></p>
            </div>
            <HeroShowcase codeLanguage={codeLanguage} repoCount={repos.length} />
          </section>

          <section id="about" className="about section-pad">
            <div className="section-heading"><span>01</span><div><p>ABOUT.ME</p><h2>{t("aboutTitle")}</h2></div></div>
            <div className="about-grid">
              <div className="about-copy">
                <p>{t("aboutP1")}</p>
                <p><strong>{t("aboutP2")}</strong></p>
                <div className="signal-row"><span><Zap size={15} /> {t("productionYears")}</span><span><MapPin size={15} /> {t("location")}</span></div>
              </div>
              <div className="skills-viewer">
                <div className="skills-view-toolbar"><div><button className={skillsView === "code" ? "active" : ""} onClick={() => setSkillsView("code")}><Code2 size={13} /> Code</button><button className={skillsView === "ui" ? "active" : ""} onClick={() => setSkillsView("ui")}><LayoutGrid size={13} /> Preview</button></div><span>{skillsView === "code" ? code.label + " source" : "Visual stack"}</span></div>
                {skillsView === "code" ? <div className="skills-code" aria-label={'Skills rendered as ' + code.label + ' source code'}>
                  <div className="skills-code-head"><span><i /><i /><i /></span><p>{code.stack}</p><small>{code.label}</small></div>
                  <div className="skills-code-body"><div className="skill-line-numbers" aria-hidden="true">{skillLines.map((_, index) => <span key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div><pre><code>{skillLines.join("\n")}</code></pre></div>
                  <div className="skills-code-foot"><span><i /> Valid stack</span><span>UTF-8</span><span>Ln {skillLines.length}, Col 1</span></div>
                </div> : <div className="skills-preview" aria-label="Skills card preview">
                  {skillGroups.map((title, index) => <article key={title} className={'skill-card accent-' + index}><header><span>{String(index + 1).padStart(2, "0")}</span><i /></header><h3>{title}</h3><div>{skillCatalog.filter(skill => skill.group === title).map(skill => {
                    // A skill only becomes a project link when a real project
                    // demonstrates it. Professional-only skills stay plain text
                    // with their evidence named, rather than linking nowhere.
                    const hasProjects = skill.evidence.includes("public-repo") && projectTechOptions.includes(skill.key);
                    const evidenceNames = skill.evidence.map(source => EVIDENCE_LABEL[source]).join(", ");
                    return hasProjects
                      ? <button type="button" key={skill.key} className="skill-chip skill-chip-linked" onClick={() => exploreTech(skill.key)} title={`Show projects using ${skill.label}`}>{skill.label}<small className="skill-evidence">{evidenceNames}</small></button>
                      : <span key={skill.key} className="skill-chip">{skill.label}<small className="skill-evidence">{evidenceNames}</small></span>;
                  })}</div></article>)}
                </div>}
              </div>
            </div>
          </section>

          <section id="work" ref={projectsSectionRef} className="work section-pad">
            <div className="section-heading"><span>02</span><div><p>{code.projects.toUpperCase()}</p><h2>{t("projectsTitle")}</h2></div><div className="section-heading-actions"><button type="button" className="section-link section-link-button" onClick={() => setRecruiterModeOpen(true)}><Command size={15} /> {t("recruiterMode")}</button><a href="https://github.com/osameh15?tab=repositories" target="_blank" rel="noreferrer" className="section-link">{t("githubProfile")} <ArrowUpRight size={15} /></a></div></div>
            <p className="projects-intro">{t("projectsIntro")}</p>
            {metadataState === "loading" && <div className="metadata-loading"><LoaderCircle className="spin" size={14} /> Reading project metadata…</div>}
            <FeaturedProjects repos={repos} metadata={repoMetadata} onOpen={repo => { const full = repos.find(item => item.id === repo.id); if (full) openProject(full); }} onRecruiterMode={() => setRecruiterModeOpen(true)} />
            <div id="project-filter-panel" className="project-controls" aria-label="Project search and filters">
              <label className="project-search"><Search size={15} /><input ref={projectSearchRef} value={projectQuery} onChange={event => { setProjectQuery(event.target.value); setVisibleRepos(6); }} placeholder="Search repositories, stack, topics…" aria-label="Search projects" /><kbd>/</kbd></label>
              <select value={projectTech} onChange={event => applyProjectTech(event.target.value)} aria-label="Filter by technology"><option value="all">All technologies</option>{projectTechOptions.map(tech => <option key={tech} value={tech}>{technologyLabel(tech)}</option>)}</select>
              <select value={projectSort} onChange={event => setProjectSort(event.target.value as "recent" | "stars" | "name")} aria-label="Sort projects"><option value="recent">Recently updated</option><option value="stars">Most starred</option><option value="name">Name A-Z</option></select>
              {(projectQuery || projectTech !== "all") && <button className="clear-filter" onClick={clearProjectFilters}><X size={14} /> Clear</button>}
            </div>
            <div className="stack-explorer" aria-label="Technology explorer"><span>Explore by stack</span>{["csharp", "vue", "typescript", "php", "java", "kotlin", "nuxt", "android"].map(tech => <button key={tech} className={projectTech === tech ? "active" : ""} aria-pressed={projectTech === tech} onClick={() => exploreTech(tech)}>{technologyLabel(tech)}</button>)}</div>
            {repoState === "loading" && <div className="metadata-loading" role="status"><LoaderCircle className="spin" size={14} /> Refreshing live GitHub metrics…</div>}
            <>
              <div className="project-grid">{filteredRepos.slice(0, visibleRepos).map((project, index) => (
                <article className={'project-card tone-' + (index % 3)} key={project.id} data-project-name={project.name}>
                  <div className="project-top"><span>{String(index + 1).padStart(2, "0")}</span><span className="project-stats"><Star size={13} /> {liveRepoData ? project.stargazers_count : "—"}<Github size={13} /> {liveRepoData ? project.forks_count : "—"}</span><ArrowUpRight size={19} /></div>
                  <div className="project-image">
                    {repoImages[project.name] && <img src={repoImages[project.name]} alt={'Preview from ' + project.name + ' README'} loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
                    <div className="image-fallback"><Code2 size={31} /><span>{project.language || "Code"}</span></div>
                  </div>
                  <p className="project-type">{repoMetadata[project.name]?.project.type || project.language || "Repository"} · Updated {new Date(project.updated_at).toLocaleDateString("en", { month: "short", year: "numeric" })}{repoMetadata[project.name]?.project.featured ? " · Featured" : ""}</p>
                  <h3>{repoMetadata[project.name]?.project.name || project.name}</h3><p className="project-desc">{repoMetadata[project.name]?.project.tagline || project.description || "Explore the source, architecture, and latest work in this repository."}</p>
                  <div className="tags">{[project.language, ...project.topics].filter(Boolean).slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div>
                  <div className="project-links"><a className="open-detail card-surface-link" href={`/projects/${encodeURIComponent(project.name)}`} onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); openProject(project); }}>Open project details <ArrowUpRight size={14} /></a><button className={compareRepos.some(item => item.id === project.id) ? "compare-chip active" : "compare-chip"} onClick={() => toggleCompareRepo(project)} aria-pressed={compareRepos.some(item => item.id === project.id)}><Code2 size={13} /> {compareRepos.some(item => item.id === project.id) ? "Selected" : "Compare"}</button>{npmUrl(project.name) && <a className="npm-chip" href={npmUrl(project.name)} target="_blank" rel="noreferrer" aria-label={'View ' + npmPackages[project.name] + ' on npm'}><Package size={13} /> npm <ArrowUpRight size={12} /></a>}</div>
                </article>
              ))}</div>
              {!filteredRepos.length && <div className="project-empty" role="status"><Search size={20} /><p>{projectTech !== "all" ? `No project matches ${technologyLabel(projectTech)}${projectQuery ? ` and “${projectQuery}”` : ""}.` : `No project matches “${projectQuery}”.`}</p><button type="button" onClick={clearProjectFilters}>Reset filters</button></div>}
              {visibleRepos < filteredRepos.length && <div className="load-more-wrap"><button className="load-more" onClick={() => setVisibleRepos(count => count + 6)}>Load more projects <span>{Math.min(visibleRepos, filteredRepos.length)} / {filteredRepos.length}</span></button></div>}
            </>
          </section>

          <CaseStudiesSection onOpen={openCaseStudy} />

          <section id="experience" className="experience section-pad">
            <div className="section-heading"><span>04</span><div><p>EXPERIENCE/</p><h2>{t("experienceTitle")}</h2></div></div>
            <div className="experience-layout">
              <div className="role-list">{roles.map((role, index) => <article className="role" key={role.company}>
                <div className="role-marker"><Circle size={10} fill="currentColor" />{index < roles.length - 1 && <i />}</div>
                <p className="years">{role.years}</p><div><h3>{role.role}</h3><h4>@ {role.company}</h4><p>{role.detail}</p></div>
              </article>)}</div>
              <aside className="terminal-card">
                <div className="terminal-head"><span><i /><i /><i /></span><p>osameh — zsh</p></div>
                <div className="terminal-body"><p><b>~</b> whoami</p><span>Software Engineer</span><p><b>~</b> cat focus.txt</p><span>Backend Architecture<br />Performance Optimization<br />System Design<br />AI Integration</span><p><b>~</b> uptime</p><span>Always learning <i className="cursor" /></span></div>
              </aside>
            </div>
          </section>

          <GithubActivity />
          <NowSection />
          <ChangelogSection />
          <EngineeringNotesSection onOpenNote={openNote} />

          <section id="contact" className="contact section-pad">
            <div className="contact-icon"><ServerCog size={27} /></div><p className="eyebrow">{t("contactEyebrow")}</p>
            <h2>{t("contactTitleLead")}<br /><em>{t("contactTitleAccent")}</em></h2>
            <p>{t("contactCopy")}</p>
            <a href="mailto:osirandoust@gmail.com" className="primary-btn">{t("contact")} <Mail size={17} /></a>
            <ContactForm fileName={contactFiles[codeLanguage]} />
            <div className="email-options" aria-label="Email contacts">
              <a href="mailto:osirandoust@gmail.com"><span>Personal</span>osirandoust@gmail.com</a>
              <a href="mailto:support@osameh.dev"><span>Business &amp; formal</span>support@osameh.dev</a>
            </div>
            <div className="social-row">
              <a href="https://github.com/osameh15" target="_blank" rel="noreferrer"><Github size={17} /> GitHub</a>
              <a href="https://gitlab.com/osameh15" target="_blank" rel="noreferrer"><Gitlab size={17} /> GitLab</a>
              <a href="https://www.linkedin.com/in/osameh-irandoust-493359173/" target="_blank" rel="noreferrer"><Linkedin size={17} /> LinkedIn</a>
              <a href="https://t.me/osameh_ir" target="_blank" rel="noreferrer"><Send size={17} /> Telegram</a>
              <a href="https://instagram.com/osameh.ir" target="_blank" rel="noreferrer"><Instagram size={17} /> Instagram</a>
              <a href="https://wa.me/989369642754" target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp</a>
            </div>
          </section>
          <footer><span>© 2026 Osameh Irandoust</span><span className="footer-status"><i /> All systems operational</span><button type="button" className="build-version build-version-button" title={`${BUILD_ID} · built ${BUILD_TIME}`} onClick={() => window.dispatchEvent(new Event("portfolio:build"))}>build {BUILD_DISPLAY}</button><span>Designed & built with intention.</span></footer>
          </>}
        </div>
        {contextMenu && <div className="custom-context-menu" ref={contextMenuRef} role="menu" aria-label="Portfolio context menu">
          <div className="context-menu-head"><span><Command size={13} /> osameh.dev</span><code>{contextRepo ? contextRepo.name : contextNote ? `note/${contextNote.slug}` : contextCaseStudy ? `case/${contextCaseStudy.id}` : contextMenu.imageUrl ? "image" : contextMenu.linkUrl ? "link" : "workspace"}</code></div>
          {contextMenu.selection && <div className="context-menu-group"><button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void copyText(contextMenu.selection || "", "Selection copied"); })}><Copy size={15} /><span>Copy selection</span><kbd>⌘C</kbd></button></div>}
          {contextMenu.imageUrl && <div className="context-menu-group"><p>IMAGE</p>
            {contextRepo && contextMenu.imageIndex !== undefined && contextMenu.imageIndex >= 0 && <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => setGalleryLightbox({ repo: contextRepo.name, index: contextMenu.imageIndex || 0 }))}><ImageIcon size={15} /><span>Open fullscreen</span><small>Gallery</small></button>}
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.open(contextMenu.imageUrl || "", "_blank", "noopener,noreferrer"))}><ExternalLink size={15} /><span>Open original image</span><small>New tab</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void copyText(contextMenu.imageUrl || "", "Image URL copied"); })}><Link2 size={15} /><span>Copy image URL</span></button>
          </div>}
          {contextRepo && <div className="context-menu-group"><p>PROJECT</p>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => openProject(contextRepo))}><FolderOpen size={15} /><span>Open project</span><small>{contextRepo.name}.md</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.open(`https://github.com/${GITHUB_OWNER}/${contextRepo.name}`, "_blank", "noopener,noreferrer"))}><Github size={15} /><span>View on GitHub</span><small>Source</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void shareProject(contextRepo).then(ok => showActionToast(ok ? "Project shared" : "Share cancelled")); })}><Send size={15} /><span>Share project</span><small>Native share</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void copyText(projectShareUrl(contextRepo), "Project link copied"); })}><Link2 size={15} /><span>Copy project link</span></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { openProject(contextRepo); window.setTimeout(() => document.getElementById(`gallery-${contextRepo.name}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120); })}><ImageIcon size={15} /><span>Open gallery</span><small>{repoGalleries[contextRepo.name]?.length || "Auto"}</small></button>
          </div>}
          {contextNote && <div className="context-menu-group"><p>ENGINEERING NOTE</p>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => openNote(contextNote.slug))}><Braces size={15} /><span>Open note</span><small>{contextNote.slug}.md</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void copyText(noteShareUrl(contextNote.slug), "Note link copied"); })}><Link2 size={15} /><span>Copy note link</span></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { if (navigator.share) void navigator.share({ title: contextNote.title, url: noteShareUrl(contextNote.slug) }).catch(() => undefined); else void copyText(noteShareUrl(contextNote.slug), "Note link copied"); })}><Send size={15} /><span>Share note</span><small>{contextNote.readingMinutes} min read</small></button>
          </div>}
          {contextCaseStudy && <div className="context-menu-group"><p>CASE STUDY</p>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => openCaseStudy(contextCaseStudy))}><FileCode2 size={15} /><span>Open case study</span><small>{contextCaseStudy.client}</small></button>
            {contextCaseStudy.siteUrl && <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.open(contextCaseStudy.siteUrl, "_blank", "noopener,noreferrer"))}><ExternalLink size={15} /><span>Visit live site</span><small>Client work</small></button>}
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { if (navigator.share) void navigator.share({ title: contextCaseStudy.title, url: caseStudyShareUrl(contextCaseStudy.id) }).catch(() => undefined); else void copyText(caseStudyShareUrl(contextCaseStudy.id), "Case study link copied"); })}><Send size={15} /><span>Share case study</span><small>Native share</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void copyText(caseStudyShareUrl(contextCaseStudy.id), "Case study link copied"); })}><Link2 size={15} /><span>Copy case study link</span></button>
          </div>}
          {contextMenu.linkUrl && !contextNote && !contextCaseStudy && <div className="context-menu-group"><p>LINK</p>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { window.location.href = contextMenu.linkUrl || "#"; })}><ExternalLink size={15} /><span>Open link</span><small>{contextMenu.linkLabel?.slice(0, 20)}</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.open(contextMenu.linkUrl || "", "_blank", "noopener,noreferrer"))}><ExternalLink size={15} /><span>Open in new tab</span></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void copyText(contextMenu.linkUrl || "", "Link copied"); })}><Copy size={15} /><span>Copy link</span></button>
          </div>}
          {!contextRepo && !contextNote && !contextCaseStudy && !contextMenu.imageUrl && !contextMenu.linkUrl && <div className="context-menu-group"><p>NAVIGATE</p>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sectionByPath("/home")))}><HomeIcon size={15} /><span>Home</span><small>/home</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sectionByPath("/about")))}><Braces size={15} /><span>About</span><small>/about</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sectionByPath("/projects")))}><Code2 size={15} /><span>Projects</span><small>/projects</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sectionByPath("/case-studies")))}><FileCode2 size={15} /><span>Case Studies</span><small>/case-studies</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sectionByPath("/experience")))}><FileCode2 size={15} /><span>Experience</span><small>/experience</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sectionByPath("/activity")))}><Github size={15} /><span>GitHub Activity</span><small>/activity</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sectionByPath("/now")))}><Zap size={15} /><span>Now</span><small>/now</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sectionByPath("/changelog")))}><RefreshCw size={15} /><span>Changelog</span><small>/changelog</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sectionByPath("/notes")))}><Braces size={15} /><span>Engineering Notes</span><small>/notes</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => goTo(sectionByPath("/contact")))}><Mail size={15} /><span>Contact</span><small>/contact</small></button>
          </div>}
          <div className="context-menu-group"><p>WORKSPACE</p>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(openUniversalSearch)}><Command size={15} /><span>Command Palette</span><kbd>⇧⌘P</kbd></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => openTerminal())}><Terminal size={15} /><span>Open Terminal</span><kbd>`</kbd></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.dispatchEvent(new Event("portfolio:resume")))}><FileCode2 size={15} /><span>Open Resume</span><small>PDF</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => setRecruiterModeOpen(true))}><Command size={15} /><span>Recruiter mode</span><small>tour</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.dispatchEvent(new Event("portfolio:diagnostics")))}><Monitor size={15} /><span>System Health Center</span><small>live</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.dispatchEvent(new Event("portfolio:shortcuts")))}><Command size={15} /><span>Keyboard shortcuts</span><kbd>?</kbd></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.dispatchEvent(new Event("portfolio:install")))}><Download size={15} /><span>Install app</span><small>PWA</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(toggleThemeMode)}>{document.documentElement.dataset.theme === "light" ? <Moon size={15} /> : <Sun size={15} />}<span>Switch theme</span><small>{document.documentElement.dataset.theme === "light" ? "Dark" : "Light"}</small></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => { void copyText(window.location.href, "Page URL copied"); })}><Copy size={15} /><span>Copy page URL</span></button>
            <button className="context-menu-item" role="menuitem" onClick={() => runContextAction(() => window.location.reload())}><RefreshCw size={15} /><span>Refresh</span><kbd>⌘R</kbd></button>
          </div>
          <div className="context-menu-group context-menu-easter"><button className="context-menu-item" role="menuitem" onClick={() => runContextAction(runHireEasterEgg)}><Terminal size={15} /><span>sudo hire osameh</span><small>run</small></button></div>
          <div className="context-menu-foot"><span>{BUILD_DISPLAY}</span><span><kbd>↑↓</kbd> navigate · <kbd>Esc</kbd> close</span></div>
        </div>}
        {commandPaletteOpen && <div className="command-palette-backdrop" role="presentation" onMouseDown={() => setCommandPaletteOpen(false)}>
          <section ref={commandPaletteDialogRef} tabIndex={-1} className="command-palette" role="dialog" aria-modal="true" aria-label={t("universalSearch")} onMouseDown={event => event.stopPropagation()}>
            <div className="command-palette-search"><Search size={17} /><input ref={commandPaletteInputRef} value={commandQuery} onChange={event => { setCommandQuery(event.target.value); setCommandIndex(0); }} onKeyDown={event => {
              if (event.key === "Escape") { event.preventDefault(); setCommandPaletteOpen(false); return; }
              if (event.key === "ArrowDown") { event.preventDefault(); if (filteredPaletteCommands.length) setCommandIndex(index => (Math.min(index, filteredPaletteCommands.length - 1) + 1) % filteredPaletteCommands.length); return; }
              if (event.key === "ArrowUp") { event.preventDefault(); if (filteredPaletteCommands.length) setCommandIndex(index => (Math.min(index, filteredPaletteCommands.length - 1) - 1 + filteredPaletteCommands.length) % filteredPaletteCommands.length); return; }
              if (event.key === "Enter" && filteredPaletteCommands[safeCommandIndex]) { event.preventDefault(); runPaletteCommand(filteredPaletteCommands[safeCommandIndex]); }
            }} placeholder={t("universalSearchPlaceholder")} aria-label={t("universalSearch")} autoComplete="off" /><kbd>ESC</kbd></div>
            <div ref={commandPaletteListRef} className="command-palette-list modal-scroll-viewport" role="listbox" aria-label="Available commands">
              {filteredPaletteCommands.length ? filteredPaletteCommands.map((item, index) => <button key={item.id} className={index === safeCommandIndex ? "active" : ""} role="option" aria-selected={index === safeCommandIndex} onMouseEnter={() => setCommandIndex(index)} onClick={() => runPaletteCommand(item)}><span className="command-palette-icon">{paletteIcon(item.icon)}</span><span><b>{item.label}</b><small>{item.hint}</small></span><CornerDownLeft size={13} /></button>) : <div className="command-palette-empty"><Search size={18} /><span>{t("noResults")} {commandQuery && <>“{commandQuery}”</>}</span></div>}
            </div>
            <div className="command-palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> run</span><span><kbd>esc</kbd> close</span><code>{formatReleaseLabel(BUILD_VERSION)}</code></div>
          </section>
        </div>}
        {actionToast && <div className={`action-toast ${actionToast.kind}`} role={actionToast.kind === "error" ? "alert" : "status"} aria-live={actionToast.kind === "error" ? "assertive" : "polite"}>
          <span className="action-toast-icon">{actionToast.kind === "success" ? <Check size={18} /> : actionToast.kind === "warning" || actionToast.kind === "error" ? <AlertTriangle size={18} /> : <Info size={18} />}</span>
          <span>{actionToast.message}</span>
        </div>}
        {compareRepos.length > 0 && <div className="compare-bar"><span><Code2 size={14} /> Compare queue</span><div>{compareRepos.map(repo => <button key={repo.id} onClick={() => toggleCompareRepo(repo)}>{repo.name} <X size={12} /></button>)}</div><button className="compare-run" disabled={compareRepos.length !== 2} onClick={() => { if (compareRepos.length === 2) { setCompareModalOpen(true); trackEvent("project_compare", compareRepos.map(repo => repo.name).join(" vs ")); } }}>{compareRepos.length === 2 ? "Compare 2 projects" : "Select one more"}</button></div>}
        <CaseStudyModal
          study={activeCaseStudy}
          onClose={() => closeCaseStudy()}
          restorePosition={caseStudyOriginRef.current ? { x: caseStudyOriginRef.current.scrollX, y: caseStudyOriginRef.current.scrollY } : undefined}
          related={activeCaseStudy ? <ContinueExploring items={relatedToCaseStudy(activeCaseStudy.id, relatedSource)} onOpen={openRelated} /> : null}
        />
        <PortfolioFeatureModals />
        <RecruiterMode open={recruiterModeOpen} repos={repos} metadata={repoMetadata} onClose={() => setRecruiterModeOpen(false)} onOpenProject={repo => { const full = repos.find(item => item.id === repo.id); if (full) openProject(full); }} />
        <ResumeViewer onOpenChange={setResumeOpen} />
        <BuildInfoModal />
        <SystemDiagnostics />
        <ShortcutGuide />
        {compareModalOpen && compareRepos.length === 2 && <ProjectCompare repos={compareRepos} onClose={() => setCompareModalOpen(false)} />}
        {galleryLightbox && (() => {
          const gallery = repoGalleries[galleryLightbox.repo] || [];
          const image = gallery[galleryLightbox.index];
          if (!image) return null;
          const move = (direction: number) => setGalleryLightbox(current => current ? { ...current, index: (current.index + direction + gallery.length) % gallery.length } : current);
          return <div ref={galleryDialogRef} tabIndex={-1} className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`${galleryLightbox.repo} image gallery`} onClick={() => setGalleryLightbox(null)}>
            <button type="button" className="gallery-lightbox-close" onClick={() => setGalleryLightbox(null)} aria-label="Close gallery"><X size={20} /></button>
            {gallery.length > 1 && <button type="button" className="gallery-lightbox-nav previous" onClick={event => { event.stopPropagation(); move(-1); }} aria-label="Previous image"><ChevronLeft size={24} /></button>}
            <figure onClick={event => event.stopPropagation()}>
              <img src={image.url} alt={image.name || image.path} data-project-name={galleryLightbox.repo} data-image-url={image.url} data-image-index={galleryLightbox.index} referrerPolicy="no-referrer" />
              <figcaption><span>{galleryLightbox.index + 1} / {gallery.length}</span><code>{image.path}</code></figcaption>
            </figure>
            {gallery.length > 1 && <button type="button" className="gallery-lightbox-nav next" onClick={event => { event.stopPropagation(); move(1); }} aria-label="Next image"><ChevronRight size={24} /></button>}
          </div>;
        })()}
        {panelOpen && <section className={panelMaximized ? "bottom-panel panel-maximized" : "bottom-panel"} style={{ height: panelMaximized ? "calc(100vh - 72px)" : `${panelHeight}px` }} aria-label="IDE bottom panel">
          <div className="panel-resize-handle" role="separator" aria-label="Resize terminal panel" aria-orientation="horizontal" onDoubleClick={togglePanelMaximized} onPointerDown={beginPanelResize} onPointerMove={resizePanel} onPointerUp={endPanelResize} onPointerCancel={endPanelResize}><span /></div>
          <div className="panel-head">
            <div className="panel-tabs">
              <button className={panelTab === "outline" ? "active" : ""} onClick={() => setPanelTab("outline")}><ListTree size={13} /> OUTLINE</button>
              <button className={panelTab === "terminal" ? "active" : ""} onClick={() => setPanelTab("terminal")}><Terminal size={13} /> TERMINAL</button>
            </div>
            <div className="panel-window-actions">
              <button className="panel-close" onClick={togglePanelMaximized} aria-label={panelMaximized ? "Restore panel size" : "Maximize panel"} title={panelMaximized ? "Restore panel size" : "Maximize panel"}>{panelMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
              <button className="panel-close" onClick={() => setPanelOpen(false)} aria-label="Close panel"><X size={15} /></button>
            </div>
          </div>
          {panelTab === "outline" ? <div className="outline-panel">
            <div className="outline-tree">
              <p><ChevronDown size={13} /> OSAMEH-PORTFOLIO</p>
              {sections.map(item => <button key={item.path} onClick={() => goTo(item)}><span>{item.path}</span><small>{item.label}</small></button>)}
            </div>
            <div className="outline-projects">
              <p>PROJECT ROUTES</p>
              {repos.map(repo => <button key={repo.id} onClick={() => openProject(repo)}><Code2 size={12} /><span>/{repo.name}</span></button>)}
            </div>
          </div> : <div className="terminal-panel">
            <div className="terminal-output" ref={terminalOutputRef}>
              {terminalLines.map((line, index) => <p key={index} className={line.startsWith("›") ? "command-line" : ""}>{line}</p>)}
              {searchResults.map(result => <button key={result.path} onClick={() => goTo(result)}><Search size={12} /><span>{result.path}</span><small>{result.label}</small></button>)}
            </div>
            <form className="terminal-input-row" onSubmit={runTerminal}>
              <span>osameh@portfolio:~$</span>
              <div className="terminal-input-shell">
                {terminalGhostSuffix && <div className="terminal-input-ghost" aria-hidden="true"><span>{terminalInput}</span><em>{terminalGhostSuffix}</em></div>}
                <input ref={terminalInputRef} value={terminalInput} onChange={event => { setTerminalInput(event.target.value); terminalCompletionRef.current = { seed: "", matches: [], index: -1, applied: "" }; }} onKeyDown={event => { if (event.key === "Tab") { event.preventDefault(); autocompleteTerminal(event.shiftKey); } }} placeholder="Type help… · Tab autocomplete" aria-label="Terminal command" autoComplete="off" spellCheck={false} />
              </div>
              <small className="terminal-tab-hint"><kbd>Tab</kbd> autocomplete</small>
              <button type="submit" aria-label="Run command"><CornerDownLeft size={15} /></button>
            </form>
          </div>}
        </section>}
        <div className="status-bar">
          <span><Github size={12} /> main*</span><button type="button" className="status-build status-build-button" title={`${BUILD_ID} · built ${BUILD_TIME}`} onClick={() => window.dispatchEvent(new Event("portfolio:build"))}>v{BUILD_VERSION}{BUILD_CODENAME && <> · <b>{BUILD_CODENAME.toUpperCase()}</b></>}</button><span className="status-online"><i /> {code.label} mode</span>
          <button onClick={() => { if (panelOpen) setPanelOpen(false); else openTerminal(); }}><PanelBottom size={13} /> {panelOpen ? "Close panel" : "Open panel"}</button>
        </div>
      </div>
    </main>
  );
}
