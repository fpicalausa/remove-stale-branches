import { TaggedCommitComments } from "./commitComments";

describe("Commit comments", () => {
  test("message placeholders are replaced", () => {
    const message = TaggedCommitComments.formatCommentMessage(
      "@{author} Your branch [{branchName}]({branchUrl}) hasn't been updated in the last 60 days and is marked as stale. It will be removed in a week.\r\nIf you want to keep this branch around, delete this comment or add new commits to this branch.",
      {
        date: Date.now(),
        username: "theusername",
        belongsToOrganization: false,
        branchName: "the-branch",
        prefix: "origin",
        commitId: "123456",
        isProtected: false,
      },
      {
        daysBeforeBranchStale: 5,
        daysBeforeBranchDelete: 10,
      },
      {
        repo: "octocat",
        owner: "github",
      }
    );

    const expected =
      "@theusername Your branch [the-branch](https://github.com/github/octocat/tree/the-branch) hasn't been updated in the last 60 days and is marked as stale. It will be removed in a week.\r\nIf you want to keep this branch around, delete this comment or add new commits to this branch.";
    expect(message).toEqual(expected);
  });
});
