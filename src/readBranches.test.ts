import { readBranches } from "./readBranches";
import { Octokit } from "@octokit/core";

jest.mock("@octokit/core");

describe("readBranches", () => {
  let octokit: Octokit;

  beforeEach(() => {
    octokit = new Octokit();
  });

  test("should be an async iterable", async () => {
    const branches = readBranches(octokit, {}, { owner: "github", repo: "octocat" }, undefined);
    expect(branches[Symbol.asyncIterator]).toBeDefined();
  });

  test("should yield branches from GitHub API", async () => {
    // Mock the octokit request method to simulate GitHub API response
    const mockRequest = jest.fn()
      .mockResolvedValueOnce({
        data: [
          { name: "branch1", commit: { sha: "sha1" }, protected: false },
          { name: "branch2", commit: { sha: "sha2" }, protected: true },
        ],
        headers: { link: '<https://api.github.com/repos/github/octocat/branches?page=2>; rel="next"' },
      })
      .mockResolvedValueOnce({
        data: [
          { name: "branch3", commit: { sha: "sha3" }, protected: false },
        ],
        headers: {},
      });

    // @ts-ignore
    octokit.request = mockRequest;

    const branches = [];
    for await (const branch of readBranches(octokit, {}, { owner: "github", repo: "octocat" }, undefined)) {
      branches.push(branch);
    }

    expect(branches).toHaveLength(3);
    expect(branches[0].branchName).toBe("branch1");
    expect(branches[1].isProtected).toBe(true);
  });

  // Additional tests for error handling and edge cases can be added here
});
