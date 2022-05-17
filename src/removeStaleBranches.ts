import { Octokit } from "@octokit/core";
import formatISO from "date-fns/formatISO";
import subDays from "date-fns/subDays";
import { TaggedCommitComments } from "./commitComments";
import { Branch, Params } from "./types";
import { readBranches } from "./readBranches";
import * as core from "@actions/core";

async function removeOrNotifyStaleBranch(
  removeCutoff: number,
  commitComments: TaggedCommitComments,
  branch: Branch,
  params: Params
) {
  const commentTag = "stale:" + branch.branchName;
  const comments = await commitComments.getCommitCommentsWithTag({
    commentTag,
    commitSHA: branch.commitId,
  });

  if (comments.length == 0) {
    console.log("-> ✍️ marking as stale");
    if (params.isDryRun) {
      return;
    }

    return await commitComments.addCommitComments({
      commentTag,
      commitSHA: branch.commitId,
      commentBody: TaggedCommitComments.formatCommentMessage(
        params.staleCommentMessage,
        branch,
        params,
        params.repo
      ),
    });
  }

  const latestStaleComment = comments.reduce((latestDate, comment) => {
    const commentDate = Date.parse(comment.created_at);
    return Math.max(commentDate, latestDate);
  }, 0);

  if (latestStaleComment >= removeCutoff) {
    console.log(
      "-> already marked stale on " +
        formatISO(latestStaleComment) +
        ". Skipping."
    );
    return;
  }

  console.log(
    "-> 🗑️ removing stale branch (stale comment date is " +
      formatISO(latestStaleComment) +
      ")"
  );

  if (params.isDryRun) {
    return;
  }

  commitComments.deleteBranch(branch);

  comments.forEach((c) => {
    commitComments.deleteCommitComments({ commentId: c.id });
  });
}

type BranchFilters = {
  staleCutoff: number;
  authorsRegex: RegExp | null;
  branchRegex: RegExp | null;
  removeCutoff: number;
  exemptProtectedBranches: boolean;
};

async function processBranch(
  branch: Branch,
  filters: BranchFilters,
  commitComments: TaggedCommitComments,
  params: Params
) {
  if (params.protectedOrganizationName && branch.belongsToOrganization) {
    console.log(
      "-> author " +
        branch.username +
        " belongs to protected organization " +
        params.protectedOrganizationName
    );
  }

  if (filters.authorsRegex && filters.authorsRegex.test(branch.username)) {
    console.log("-> author " + branch.username + " is protected");
    return false;
  }

  if (filters.branchRegex && filters.branchRegex.test(branch.branchName)) {
    console.log("-> branch " + branch.branchName + " is exempted");
    return false;
  }

  if (filters.exemptProtectedBranches && branch.isProtected) {
    console.log("-> branch " + branch.username + " is protected");
    return false;
  }

  if (branch.date >= filters.staleCutoff) {
    console.log("-> updated recently");
    return false;
  } else {
    console.log("-> last update was on " + formatISO(branch.date));
  }

  await removeOrNotifyStaleBranch(
    filters.removeCutoff,
    commitComments,
    branch,
    params
  );
  return true;
}

export async function removeStaleBranches(
  octokit: Octokit,
  params: Params
): Promise<void> {
  const headers: { [key: string]: string } = params.githubToken
    ? {
        "Content-Type": "application/json",
        Authorization: "bearer " + params.githubToken,
      }
    : {};

  const now = new Date();
  const staleCutoff = subDays(now, params.daysBeforeBranchStale).getTime();
  const removeCutoff = subDays(now, params.daysBeforeBranchDelete).getTime();
  const authorsRegex = params.protectedAuthorsRegex
    ? new RegExp(params.protectedAuthorsRegex)
    : null;
  const branchRegex = params.protectedBranchesRegex
    ? new RegExp(params.protectedBranchesRegex)
    : null;
  const repo = {
    repo: params.repo.repo,
    owner: params.repo.owner,
  };

  const filters: BranchFilters = {
    staleCutoff,
    authorsRegex,
    branchRegex,
    removeCutoff,
    exemptProtectedBranches: params.exemptProtectedBranches,
  };
  const commitComments = new TaggedCommitComments(repo, octokit, headers);
  let operations = 0;

  if (params.isDryRun) {
    console.log("Running in dry-run mode. No branch will be removed.");
  }

  for await (const branch of readBranches(
    octokit,
    headers,
    repo,
    params.protectedOrganizationName
  )) {
    core.startGroup("Inspecting branch " + branch.branchName);
    try {
      if (await processBranch(branch, filters, commitComments, params)) {
        operations++;
      }
    } finally {
      core.endGroup();
    }

    if (operations >= params.operationsPerRun) {
      console.log("Exiting after " + operations + " operations");
      return;
    }
  }
}
