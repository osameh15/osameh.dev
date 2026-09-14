export type TechnologyDefinition = {
  key: string;
  label: string;
  aliases: string[];
};

export const TECHNOLOGIES: Record<string, TechnologyDefinition>;
export function canonicalKeys(token: string): string[];
export function canonicalKeysFor(tokens: (string | null | undefined)[]): string[];
export function technologyLabel(key: string): string;
export function tokenMatchesTechnology(token: string, key: string): boolean;
export function allTechnologyKeys(): string[];
