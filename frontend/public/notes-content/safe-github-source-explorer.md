# Designing a safe source explorer for public repositories

Showing real source code inside a portfolio is useful, but a repository browser should not become an unrestricted GitHub proxy.

The Source Explorer on this site is built around explicit limits.

## Keep the token on the server

The frontend never receives the GitHub token. It requests a repository tree and individual files from same-origin PHP endpoints.

Only repositories already exposed by the portfolio are accepted by the backend.

## Do not preview everything

Generated, dependency, cache, and build directories are excluded. Examples include:

```text
node_modules/
vendor/
dist/
build/
bin/
obj/
coverage/
.cache/
.git/
```

Potential secret files such as `.env` variants and credential files are also rejected.

## File-size and binary limits

A text preview has a practical size ceiling. Each repository can define `sourceExplorer.maxFileSizeKb`, and the backend enforces it before returning content.

Binary files are not rendered as text. This protects the browser from expensive previews and keeps the feature focused on code that is actually useful to inspect.

## Separate tree loading from file loading

The repository tree is lazy-loaded when the Source Explorer becomes relevant. Individual file content is fetched only after a user selects a file.

The UI shows explicit loading states for both operations so network latency is visible rather than looking like a broken panel.

## Cache what is stable

Repository trees change much less often than users navigate them. Caching tree and metadata responses at the server reduces GitHub API pressure while keeping the browser implementation simple.

The result is a feature that feels local to the portfolio while preserving GitHub as the upstream source of truth.
