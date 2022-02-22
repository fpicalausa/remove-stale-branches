import { Octokit } from "@octokit/core";
import { Repo, Branch } from "./types";
declare type Commit = {
    commitSHA: string;
};
declare type CommentTag = {
    commentTag: string;
};
declare type CommentBody = {
    commentBody: string;
};
declare type CommentId = {
    commentId: number;
};
export declare class TaggedCommitComments {
    private readonly repo;
    private readonly octokit;
    private readonly headers;
    constructor(repo: Repo, octokit: Octokit, headers: any);
    getCommitCommentsWithTag({ commentTag, commitSHA }: Commit & CommentTag): Promise<{
        html_url: string;
        url: string;
        id: number;
        node_id: string;
        body: string;
        path: string | null;
        position: number | null;
        line: number | null;
        commit_id: string;
        user: {
            name?: string | null | undefined;
            email?: string | null | undefined;
            login: string;
            id: number;
            node_id: string;
            avatar_url: string;
            gravatar_id: string | null;
            url: string;
            html_url: string;
            followers_url: string;
            following_url: string;
            gists_url: string;
            starred_url: string;
            subscriptions_url: string;
            organizations_url: string;
            repos_url: string;
            events_url: string;
            received_events_url: string;
            type: string;
            site_admin: boolean;
            starred_at?: string | undefined;
        } | null;
        created_at: string;
        updated_at: string;
        author_association: "COLLABORATOR" | "CONTRIBUTOR" | "FIRST_TIMER" | "FIRST_TIME_CONTRIBUTOR" | "MANNEQUIN" | "MEMBER" | "NONE" | "OWNER";
        reactions?: {
            url: string;
            total_count: number;
            "+1": number;
            "-1": number;
            laugh: number;
            confused: number;
            heart: number;
            hooray: number;
            eyes: number;
            rocket: number;
        } | undefined;
    }[]>;
    addCommitComments({ commentTag, commentBody, commitSHA }: Commit & CommentTag & CommentBody): Promise<void>;
    deleteCommitComments({ commentId }: CommentId): Promise<import("@octokit/types").OctokitResponse<never, 204>>;
    deleteBranch(branch: Branch): Promise<import("@octokit/types").OctokitResponse<never, 204>>;
    getProtectedBranches(): Promise<any>;
}
export {};
