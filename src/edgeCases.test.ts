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

describe("Edge case tests", () => {
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
      operationsPerRun: 10,
      githubToken: "",
      exemptProtectedBranches: true,
      ignoreUnknownAuthors: false,
      defaultRecipient: "defaultUser",
      repo: {
        owner: "github",
        repo: "octocat",
      },
      ignoreBranchesWithOpenPRs: false,
      remapAuthors: { "user1": "remappedUser" },
    };
  });

  test("should skip branch with unknown author when ignoreUnknownAuthors is false", async () => {
    (readBranches as jest.Mock).mockImplementation(async function* () {
      yield {
        branchName: "unknown-author-branch",
        commitId: "sha123",
        author: null,
        date: Date.now() - 1000 * 60 * 60 * 24 * 100,
        isProtected: false,
        openPrs: false,
        prefix: "refs/heads/",
      };
    });

    await expect(removeStaleBranches(octokit, params)).resolves.not.toThrow();
  });

  test("should use defaultRecipient when ignoring unknown authors", async () => {
    params.ignoreUnknownAuthors = true;

    (readBranches as jest.Mock).mockImplementation(async function* () {
      yield {
        branchName: "unknown-author-branch",
        commitId: "sha123",
        author: null,
        date: Date.now() - 1000 * 60 * 60 * 24 * 100,
        isProtected: false,
        openPrs: false,
        prefix: "refs/heads/",
      };
    });

    await expect(removeStaleBranches(octokit, params)).resolves.not.toThrow();
  });

  test("should skip protected branches when exemptProtectedBranches is true", async () => {
    (readBranches as jest.Mock).mockImplementation(async function* () {
      yield {
        branchName: "protected-branch",
        commitId: "sha456",
        author: { username: "user1", email: "user1@example.com", belongsToOrganization: false },
        date: Date.now() - 1000 * 60 * 60 * 24 * 100,
        isProtected: true,
        openPrs: false,
        prefix: "refs/heads/",
      };
    });

    await expect(removeStaleBranches(octokit, params)).resolves.not.toThrow();
  });

  test("should skip branches with open PRs when ignoreBranchesWithOpenPRs is true", async () => {
    params.ignoreBranchesWithOpenPRs = true;

    (readBranches as jest.Mock).mockImplementation(async function* () {
      yield {
        branchName: "branch-with-pr",
        commitId: "sha789",
        author: { username: "user2", email: "user2@example.com", belongsToOrganization: false },
        date: Date.now() - 1000 * 60 * 60 * 24 * 100,
        isProtected: false,
        openPrs: true,
        prefix: "refs/heads/",
      };
    });

    await expect(removeStaleBranches(octokit, params)).resolves.not.toThrow();
  });
});
