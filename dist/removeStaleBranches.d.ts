import { Octokit } from "@octokit/core";
import { Params } from "./types";
export declare function removeStaleBranches(
  octokit: Octokit,
  params: Params
): Promise<void>;
