export declare type Branch = {
    date: number;
    belongsToOrganization: boolean;
    branchName: string;
    prefix: string;
    commitId: string;
    username: string | null;
    isProtected: boolean;
};
export declare type Repo = {
    repo: string;
    owner: string;
};
export declare type Params = {
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
};
