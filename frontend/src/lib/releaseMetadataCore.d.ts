export type ReleaseMetadata = {
  historical?: Record<string, { codename?: string }>;
  families?: Record<string, { codename?: string }>;
};

export function resolveReleaseCodename(metadata: ReleaseMetadata, version: string | null | undefined): string | null;
