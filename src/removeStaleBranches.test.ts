import { removeStaleBranches } from "./removeStaleBranches";
import { Octokit } from "@octokit/core";
import { Params, Branch } from "./types";

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
import { TaggedCommitComments } from "./commitComments";

describe("removeStaleBranches", () => {
  let octokit: Octokit;
  let params: Params;

  beforeEach(() => {
    octokit = new Octokit();
    params = {
      isDryRun: true,
      daysBeforeBranchStale: 60,
      daysBeforeBranchDelete: 7,
      staleCommentMessage:
        "{author} Your branch [{branchName}]({branchUrl}) hasn't been updated in the last {daysBeforeBranchStale} days and is marked as stale. It will be removed in a week.\r\nIf you want to keep this branch around, delete this comment or add new commits to this branch.",
      protectedBranchesRegex: "^(main|master)$",
      operationsPerRun: 10,
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

  test("should run without errors in dry run mode", async () => {
    (readBranches as jest.Mock).mockImplementation(async function* () {
      yield {
        branchName: "feature-1",
        commitId: "abc123",
        author: { username: "user1", email: "user1@example.com", belongsToOrganization: false },
        date: Date.now() - 1000 * 60 * 60 * 24 * 100, // 100 days ago as number
        isProtected: false,
        openPrs: false,
        prefix: "refs/heads/",
      } as Branch;
    });

    await expect(removeStaleBranches(octokit, params)).resolves.not.toThrow();
  });

  test("should handle error in planning branch action gracefully", async () => {
    (readBranches as jest.Mock).mockImplementation(async function* () {
      yield {
        branchName: "feature-error",
        commitId: "def456",
        author: { username: "user2", email: "user2@example.com", belongsToOrganization: false },
        date: Date.now() - 1000 * 60 * 60 * 24 * 100,
        isProtected: false,
        openPrs: false,
        prefix: "refs/heads/",
      } as Branch;
    });

    const originalPlanBranchAction = jest.requireActual("./removeStaleBranches").planBranchAction;
    jest.spyOn(require("./removeStaleBranches"), "planBranchAction").mockImplementation(() => {
      throw new Error("Planning error");
    });

    await expect(removeStaleBranches(octokit, params)).resolves.not.toThrow();

    jest.spyOn(require("./removeStaleBranches"), "planBranchAction").mockImplementation(originalPlanBranchAction);
  });

  test("should handle error in processing branch gracefully", async () => {
    (readBranches as jest.Mock).mockImplementation(async function* () {
      yield {
        branchName: "feature-error-process",
        commitId: "ghi789",
        author: { username: "user3", email: "user3@example.com", belongsToOrganization: false },
        date: Date.now() - 1000 * 60 * 60 * 24 * 100,
        isProtected: false,
        openPrs: false,
        prefix: "refs/heads/",
      } as Branch;
    });

    const originalProcessBranch = jest.requireActual("./removeStaleBranches").processBranch;
    jest.spyOn(require("./removeStaleBranches"), "processBranch").mockImplementation(() => {
      throw new Error("Processing error");
    });

    await expect(removeStaleBranches(octokit, params)).resolves.not.toThrow();

    jest.spyOn(require("./removeStaleBranches"), "processBranch").mockImplementation(originalProcessBranch);
  });
});
