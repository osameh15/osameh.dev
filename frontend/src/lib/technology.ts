// Canonical technology identities (typed facade).
//
// The registry itself lives in technologyCore.js as plain JavaScript so that
// node-based quality gates can import the same table the application uses,
// rather than re-deriving it from source text. This file adds the types.


export type { TechnologyDefinition } from "./technologyCore.js";

import type { TechnologyDefinition } from "./technologyCore.js";
import {
  TECHNOLOGIES as CORE_TECHNOLOGIES,
  canonicalKeys as coreCanonicalKeys,
  canonicalKeysFor as coreCanonicalKeysFor,
  technologyLabel as coreTechnologyLabel,
  tokenMatchesTechnology as coreTokenMatchesTechnology,
  allTechnologyKeys as coreAllTechnologyKeys,
} from "./technologyCore.js";

/** key -> definition */
export const TECHNOLOGIES: Record<string, TechnologyDefinition> = CORE_TECHNOLOGIES;

/**
 * Canonical keys for one source token. Returns an empty array when the token is
 * not a technology, which is the common case for descriptive concepts.
 */
export const canonicalKeys = (token: string): string[] => coreCanonicalKeys(token);

/** Canonical keys for many tokens, de-duplicated and order-stable. */
export const canonicalKeysFor = (tokens: (string | null | undefined)[]): string[] => coreCanonicalKeysFor(tokens);

/** Human-readable label for a canonical key. */
export const technologyLabel = (key: string): string => coreTechnologyLabel(key);

/** True when a source token names this canonical technology. */
export const tokenMatchesTechnology = (token: string, key: string): boolean => coreTokenMatchesTechnology(token, key);

/** Every canonical key, sorted by display label. */
export const allTechnologyKeys = (): string[] => coreAllTechnologyKeys();
