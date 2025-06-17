import { removeStaleBranches } from "./removeStaleBranches";
import { Octokit } from "@octokit/core";

jest.mock("./readBranches", () => ({
  readBranches: jest.fn(),
}));

jest.mock("./commitComments", () => {
  return {
    TaggedCommitComments: jest.fn().mockImplementation(() => {
      return {
        addCommitComments: jest.fn().mockResolvedValue(undefined),
        deleteBranch: jest.fn().mockResolvedValue(undefined),
        deleteCommitComments: jest.fn().mockResolvedValue(undefined),
        getCommitCommentsWithTag: jest.fn().mockResolvedValue([]),
      };
    }),
  };
});

import { readBranches } from "./readBranches";

describe("Performance and concurrency tests", () => {
  let octokit: Octokit;
  let params: any;

  beforeEach(() => {
    octokit = new Octokit();
    params = {
      isDryRun: true,
      daysBeforeBranchStale: 60,
      daysBeforeBranchDelete: 7,
      staleCommentMessage:
        "{author} Your branch [{branchName}]({branchUrl}) hasn't been updated in the last {daysBeforeBranchStale} days and is marked as stale. It will be removed in a week.\r\nIf you want to keep this branch around, delete this comment or add new commits to this branch.",
      protectedBranchesRegex: "^(main|master)$",
      operationsPerRun: 100,
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
  });

  test("should handle large number of branches efficiently", async () => {
    const largeNumber = 1000;
    (readBranches as jest.Mock).mockImplementation(async function* () {
      for (let i = 0; i < largeNumber; i++) {
        yield {
          branchName: `feature-${i}`,
          commitId: `sha${i}`,
          author: { username: `user${i}`, email: `user${i}@example.com`, belongsToOrganization: false },
          date: Date.now() - 1000 * 60 * 60 * 24 * 100,
          isProtected: false,
          openPrs: false,
          prefix: "refs/heads/",
        };
      }
    });

    const start = Date.now();
    await removeStaleBranches(octokit, params);
    const duration = Date.now() - start;

    // Expect the operation to complete within a reasonable time (e.g., 5 seconds)
    expect(duration).toBeLessThan(5000);
  });
});
