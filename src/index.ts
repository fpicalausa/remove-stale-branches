import * as github from "@actions/github";
import * as core from "@actions/core";
import { removeStaleBranches } from "./removeStaleBranches";

async function run(): Promise<void> {
  const githubToken = core.getInput("github-token", { required: true });
  const octokit = github.getOctokit(githubToken);
  const isDryRun = core.getBooleanInput("dry-run", { required: false });
  const protectedOrganizationName = core.getInput("exempt-organization", {
    required: false,
  });
  const protectedBranchesRegex = core.getInput("exempt-branches-regex", {
    required: false,
  });
  const protectedAuthorsRegex = core.getInput("exempt-authors-regex", {
    required: false,
  });
  const staleCommentMessage = core.getInput("stale-branch-message", {
    required: false,
  });
  const daysBeforeBranchStale = Number.parseInt(
    core.getInput("days-before-branch-stale", { required: false })
  );
  const daysBeforeBranchDelete = Number.parseInt(
    core.getInput("days-before-branch-delete", { required: false })
  );
  const operationsPerRun = Number.parseInt(
    core.getInput("operations-per-run", { required: false })
  );

  return removeStaleBranches(octokit, {
    isDryRun,
    repo: github.context.repo,
    daysBeforeBranchStale,
    daysBeforeBranchDelete,
    staleCommentMessage,
    protectedBranchesRegex,
    protectedAuthorsRegex,
    protectedOrganizationName,
    operationsPerRun,
  });
}

run();
