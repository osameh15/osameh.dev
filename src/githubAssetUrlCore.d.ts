export type ReadmeRepoRef = {
  owner: string;
  repoName: string;
  defaultBranch: string;
};

export function encodePathSegments(value: string): string;
export function normalizeReadmeAssetUrl(source: string, repo: ReadmeRepoRef): string;
