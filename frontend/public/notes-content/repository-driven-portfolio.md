# Turning a portfolio into a repository-driven system

A portfolio becomes much more useful when project pages are not maintained as a second, separate source of truth. The approach used on **osameh.dev** is intentionally repository-driven: each public repository can describe how it should appear through a small `portfolio.json` file.

## The problem with duplicated project content

A conventional portfolio usually contains manually written project cards while the real repository contains its own README, screenshots, source tree, release history, and technical decisions. Over time those two representations drift apart.

The goal was to make the repository authoritative without forcing the browser to talk to GitHub directly.

## Repository-owned metadata

Each repository can expose a `portfolio.json` containing:

- project identity and lifecycle
- role and responsibilities
- languages, frameworks, databases, and tooling
- case-study information
- architecture nodes and edges
- source-explorer policy
- recruiter-oriented talking points
- SEO metadata

A shared `portfolio.schema.json` keeps the format predictable.

## Same-origin GitHub proxy

The browser only calls endpoints under `osameh.dev`. A small PHP layer talks to GitHub using a server-side token when available.

```text
Browser
  ↓
/api/github/*
  ↓
PHP proxy + cache
  ↓
GitHub API
```

That keeps credentials out of the frontend, gives the application one stable API surface, and allows caching rules to be controlled at the origin.

## Graceful fallback matters

Live repository data is valuable, but a portfolio should not disappear because GitHub is temporarily unavailable. Project cards therefore have an embedded fallback set, while metadata and README requests can fall back to cached or generated values.

The principle is simple: **dynamic when healthy, understandable when degraded**.

## Why this architecture is useful

A repository can now act like a plugin for the portfolio. Adding or updating project metadata changes several surfaces at once: project detail, architecture view, recruiter mode, search, filters, and SEO.

That turns the portfolio from a collection of cards into a small software system with a clear ownership boundary.
