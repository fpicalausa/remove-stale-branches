import { removeStaleBranches } from "./removeStaleBranches";
import { Octokit } from "@octokit/core";

describe("Integration tests for removeStaleBranches", () => {
  let octokit: Octokit;

  beforeEach(() => {
    octokit = new Octokit();
  });

  test("should complete stale branch removal workflow without errors", async () => {
    const params = {
      isDryRun: true,
      daysBeforeBranchStale: 1,
      daysBeforeBranchDelete: 1,
      staleCommentMessage:
        "{author} Your branch [{branchName}]({branchUrl}) hasn't been updated in the last {daysBeforeBranchStale} days and is marked as stale. It will be removed in a week.\r\nIf you want to keep this branch around, delete this comment or add new commits to this branch.",
      protectedBranchesRegex: "^(main|master)$",
      operationsPerRun: 5,
      githubToken: "",
      exemptProtectedBranches: true,
      ignoreUnknownAuthors: false,
      defaultRecipient: null,
      repo: {
        owner: "github",
        repo: "octocat",
      },
      ignoreBranchesWithOpenPRs: false,
      remapAuthors: {},
    };

    await expect(removeStaleBranches(octokit, params)).resolves.not.toThrow();
  });

  // Additional integration tests can be added here to simulate edge cases and different configurations
});
