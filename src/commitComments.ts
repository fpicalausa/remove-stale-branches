import { Octokit } from "@octokit/core";
import { Repo, Branch, Params } from "./types";

type Commit = {
  commitSHA: string;
};

type CommentTag = {
  commentTag: string;
};

type CommentBody = {
  commentBody: string;
};

type CommentId = {
  commentId: number;
};

export class TaggedCommitComments {
  private readonly repo: Repo;
  private readonly octokit: Octokit;
  private readonly headers: any;

  constructor(repo: Repo, octokit: Octokit, headers: any) {
    this.repo = repo;
    this.octokit = octokit;
    this.headers = headers;
  }

  static formatCommentMessage(
    messageTemplate: string,
    branch: Branch,
    config: Pick<
      Params,
      "daysBeforeBranchStale" | "daysBeforeBranchDelete"
    >,
    repo: Repo,
    username: string
  ) {
    const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
    return messageTemplate
      .replace(/[{]branchName[}]/g, branch.branchName)
      .replace(
        /[{]branchUrl[}]/g,
        `${serverUrl}/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
          repo.repo
        )}/tree/${encodeURIComponent(branch.branchName)}`
      )
      .replace(/[{]repoOwner[}]/g, repo.owner)
      .replace(/[{]repoName[}]/g, repo.repo)
      .replace(/[{]author[}]/g, username)
      .replace(
        /[{]daysBeforeBranchStale[}]/g,
        String(config.daysBeforeBranchStale)
      )
      .replace(
        /[{]daysBeforeBranchDelete[}]/g,
        String(config.daysBeforeBranchDelete)
      );
  }

  async getCommitCommentsWithTag({
    commentTag,
    commitSHA,
  }: Commit & CommentTag) {
    const messages = (
      await this.octokit.request(
        "GET /repos/{owner}/{repo}/commits/{commit_sha}/comments",
        {
          headers: this.headers,
          ...this.repo,
          commit_sha: commitSHA,
        }
      )
    ).data;

    return messages.filter((comment) =>
      comment.body.startsWith("[" + commentTag + "]")
    );
  }

  async addCommitComments({
    commentTag,
    commentBody,
    commitSHA,
  }: Commit & CommentTag & CommentBody) {
    const body = `[${commentTag}]\r\n\r\n${commentBody}`;
    await this.octokit.request(
      "POST /repos/{owner}/{repo}/commits/{commit_sha}/comments",
      {
        headers: this.headers,
        ...this.repo,
        commit_sha: commitSHA,
        body,
      }
    );
  }

  async deleteCommitComments({ commentId }: CommentId) {
    return this.octokit.request(
      "DELETE /repos/{owner}/{repo}/comments/{comment_id}",
      {
        headers: this.headers,
        ...this.repo,
        comment_id: commentId,
      }
    );
  }

  async getBranch(branch: Branch) {
    const ref = branch.prefix.replace(/^refs\//, "") + branch.branchName;
    return this.octokit.request("GET /repos/{owner}/{repo}/git/refs/{ref}", {
      headers: this.headers,
      ...this.repo,
      ref,
    });
  }

  async deleteBranch(branch: Branch) {
    const ref = branch.prefix.replace(/^refs\//, "") + branch.branchName;
    return this.octokit.request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", {
      headers: this.headers,
      ...this.repo,
      ref,
    });
  }

  async getProtectedBranches() {
    const { data } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/branches?protected=true",
      {
        headers: this.headers,
        ...this.repo,
      }
    );

    return data;
  }
}
