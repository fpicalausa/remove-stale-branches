import { TaggedCommitComments } from "./commitComments";
import { Octokit } from "@octokit/core";

jest.mock("@octokit/core");

describe("TaggedCommitComments", () => {
  let octokit: Octokit;
  let taggedCommitComments: TaggedCommitComments;

  beforeEach(() => {
    octokit = new Octokit();
    taggedCommitComments = new TaggedCommitComments(
      { owner: "github", repo: "octocat" },
      octokit,
      {}
    );
  });

  test("formatCommentMessage replaces tokens correctly", () => {
    const message = TaggedCommitComments.formatCommentMessage(
      "Hello {author}, branch {branchName} in repo {repoName}",
      {
        branchName: "feature-branch",
        prefix: "refs/heads/",
        commitId: "abc123",
        author: { username: "user1", email: "user1@example.com", belongsToOrganization: false },
        date: Date.now(),
        isProtected: false,
        openPrs: false,
      },
      { daysBeforeBranchStale: 10, daysBeforeBranchDelete: 5 },
      { owner: "github", repo: "octocat" },
      "user1"
    );
    expect(message).toContain("Hello user1");
    expect(message).toContain("branch feature-branch");
    expect(message).toContain("repo octocat");
  });

  test("addCommitComments calls octokit request with correct parameters", async () => {
    const mockRequest = jest.fn().mockResolvedValue({});
    (octokit.request as jest.Mock) = mockRequest;

    await taggedCommitComments.addCommitComments({
      commentTag: "stale:feature-branch",
      commentBody: "Test comment",
      commitSHA: "abc123",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/commits/{commit_sha}/comments",
      expect.objectContaining({
        body: "[stale:feature-branch]\r\n\r\nTest comment",
        commit_sha: "abc123",
      })
    );
  });

  test("getCommitCommentsWithTag filters comments correctly", async () => {
    const mockComments = [
      { body: "[stale:feature-branch] Comment 1", id: 1 },
      { body: "Other comment", id: 2 },
    ];
    const mockRequest = jest.fn().mockResolvedValue({ data: mockComments });
    (octokit.request as jest.Mock) = mockRequest;

    const comments = await taggedCommitComments.getCommitCommentsWithTag({
      commentTag: "stale:feature-branch",
      commitSHA: "abc123",
    });

    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe(1);
  });

  test("deleteCommitComments calls octokit request with correct parameters", async () => {
    const mockRequest = jest.fn().mockResolvedValue({});
    (octokit.request as jest.Mock) = mockRequest;

    await taggedCommitComments.deleteCommitComments({ commentId: 1 });

    expect(mockRequest).toHaveBeenCalledWith(
      "DELETE /repos/{owner}/{repo}/comments/{comment_id}",
      expect.objectContaining({ comment_id: 1 })
    );
  });

  test("deleteBranch calls octokit request with correct parameters", async () => {
    const mockRequest = jest.fn().mockResolvedValue({});
    (octokit.request as jest.Mock) = mockRequest;

    await taggedCommitComments.deleteBranch({
      branchName: "feature-branch",
      prefix: "refs/heads/",
    } as any);

    expect(mockRequest).toHaveBeenCalledWith(
      "DELETE /repos/{owner}/{repo}/git/refs/{ref}",
      expect.objectContaining({ ref: "heads/feature-branch" })
    );
  });

  // Additional tests for error handling can be added here
});
