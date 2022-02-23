import * as github from "@actions/github";
import * as core from "@actions/core";
import { removeStaleBranches } from "./removeStaleBranches";
import {
  DEFAULT_DAYS_BEFORE_DELETE,
  DEFAULT_DAYS_BEFORE_STALE,
  DEFAULT_MESSAGE,
  DEFAULT_OPERATIONS_PER_RUN,
  DEFAULT_PROTECTED_BRANCHES,
} from "./defaults";

async function run(): Promise<void> {
  const githubToken = core.getInput("github-token", { required: true });
  const octokit = github.getOctokit(githubToken);
  const isDryRun = core.getBooleanInput("dry-run", { required: false });
  const protectedOrganizationName = core.getInput("exempt-organization", {
    required: false,
  });
  const protectedBranchesRegex =
    core.getInput("exempt-branches-regex", { required: false }) ||
    DEFAULT_PROTECTED_BRANCHES;
  const protectedAuthorsRegex = core.getInput("exempt-authors-regex", {
    required: false,
  });
  const staleCommentMessage =
    core.getInput("stale-branch-message", { required: false }) ||
    DEFAULT_MESSAGE;
  const daysBeforeBranchStale =
    Number.parseInt(
      core.getInput("days-before-branch-stale", { required: false })
    ) || DEFAULT_DAYS_BEFORE_STALE;
  const daysBeforeBranchDelete =
    Number.parseInt(
      core.getInput("days-before-branch-delete", { required: false })
    ) || DEFAULT_DAYS_BEFORE_DELETE;
  const operationsPerRun =
    Number.parseInt(core.getInput("operations-per-run", { required: false })) ||
    DEFAULT_OPERATIONS_PER_RUN;

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
