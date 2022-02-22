import { Octokit } from "@octokit/core";
import { Branch, Repo } from "./types";
export declare function readBranches(octokit: Octokit, headers: {
    [key: string]: string;
}, repo: Repo, organization?: string): AsyncGenerator<Branch>;
