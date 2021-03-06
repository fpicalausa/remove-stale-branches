import { Octokit } from "@octokit/core";
import { removeStaleBranches } from "./removeStaleBranches";
import process from "process";

let octokit = new Octokit({
  options: {
    auth: process.env.GITHUB_TOKEN,
  },
});

const timer = setTimeout(() => {}, 120000);
removeStaleBranches(octokit, {
  isDryRun: false,
  daysBeforeBranchStale: 60,
  daysBeforeBranchDelete: 7,
  staleCommentMessage:
    "{author} Your branch [{branchName}]({branchUrl}) hasn't been updated in the last 60 days and is marked as stale. It will be removed in a week.\r\nIf you want to keep this branch around, delete this comment or add new commits to this branch.",
  protectedBranchesRegex: "^(main|master)$",
  operationsPerRun: 10,
  githubToken: process.env.GITHUB_TOKEN || "",
  exemptProtectedBranches: true,
  repo: {
    owner: "github",
    repo: "octocat",
  },
})
  .then(() => clearTimeout(timer))
  .catch((e) => console.log(e));
