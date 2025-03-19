export type Branch = {
  date: number;
  branchName: string;
  prefix: string;
  commitId: string;
  openPrs: boolean;
  author: {
    username: string | null;
    email: string | null;
    belongsToOrganization: boolean;
  } | null;
  isProtected: boolean;
};

export type Repo = {
  repo: string;
  owner: string;
};

export type Params = {
  githubToken?: string;
  isDryRun: boolean;
  daysBeforeBranchStale: number;
  daysBeforeBranchDelete: number;
  staleCommentMessage: string;
  protectedBranchesRegex?: string;
  protectedAuthorsRegex?: string;
  protectedOrganizationName?: string;
  exemptProtectedBranches: boolean;
  operationsPerRun: number;
  repo: Repo;
  ignoreUnknownAuthors: boolean;
  defaultRecipient: string | null;
  remapAuthors: { [key: string]: string } | null;
  ignoreBranchesWithOpenPRs: boolean;
};
