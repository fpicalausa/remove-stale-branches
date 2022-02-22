export type Branch = {
    date: number;
    belongsToOrganization: boolean;
    branchName: string;
    prefix: string;
    commitId: string;
    username: string
};

export type Repo = {
    repo: string;
    owner: string
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
    operationsPerRun: number;
    repo: Repo
};

