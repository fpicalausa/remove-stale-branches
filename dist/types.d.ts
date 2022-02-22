export declare type Branch = {
    date: number;
    belongsToOrganization: boolean;
    branchName: string;
    prefix: string;
    commitId: string;
    username: string;
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
    operationsPerRun: number;
    repo: Repo;
};
