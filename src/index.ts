import * as github from "@actions/github";
import * as core from "@actions/core";
import { removeStaleBranches } from "./removeStaleBranches";

async function run(): Promise<void> {
  const githubToken = core.getInput("github-token", { required: true });
  const octokit = github.getOctokit(githubToken);
  const isDryRun = core.getBooleanInput("dry-run", { required: false });
  const repositoryInput = core.getInput("repository", { required: false });
  const repo = repositoryInput
  ? {
      owner: repositoryInput.split("/")[0],
      repo: repositoryInput.split("/")[1],
    }
  : github.context.repo;
  const protectedOrganizationName = core.getInput("exempt-organization", {
    required: false,
  });
  const selectedBranchesRegex = core.getInput("restrict-branches-regex", {
    required: false,
  });
  const protectedBranchesRegex = core.getInput("exempt-branches-regex", {
    required: false,
  });
  const protectedAuthorsRegex = core.getInput("exempt-authors-regex", {
    required: false,
  });
  const exemptProtectedBranches = core.getBooleanInput(
    "exempt-protected-branches",
    {
      required: false,
    }
  );
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

  const defaultRecipient =
    core.getInput("default-recipient", { required: false }) ?? "";

  const remapAuthorsInput = core.getInput("remap-authors", { required: false });
  const remapAuthors = remapAuthorsInput ? JSON.parse(remapAuthorsInput) : {};
  if (!remapAuthors || Array.isArray(remapAuthors) || typeof remapAuthors !== 'object') {
     throw new Error("unexpected input: remap-authors is not a json object")
  }

  const ignoreUnknownAuthors = core.getBooleanInput("ignore-unknown-authors", {
    required: false,
  });

  const ignoreBranchesWithOpenPRs = core.getBooleanInput(
    "ignore-branches-with-open-prs",
    { required: false }
  );

  return removeStaleBranches(octokit, {
    isDryRun,
    repo,
    daysBeforeBranchStale,
    daysBeforeBranchDelete,
    staleCommentMessage,
    selectedBranchesRegex,
    protectedBranchesRegex,
    protectedAuthorsRegex,
    protectedOrganizationName,
    exemptProtectedBranches,
    operationsPerRun,
    defaultRecipient,
    remapAuthors,
    ignoreUnknownAuthors,
    ignoreBranchesWithOpenPRs,
  });
}

run();
