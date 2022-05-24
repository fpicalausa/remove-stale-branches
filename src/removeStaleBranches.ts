import { Octokit } from "@octokit/core";
import formatISO from "date-fns/formatISO";
import subDays from "date-fns/subDays";
import { TaggedCommitComments } from "./commitComments";
import { Branch, Params } from "./types";
import { readBranches } from "./readBranches";
import * as core from "@actions/core";

type BranchFilters = {
  staleCutoff: number;
  authorsRegex: RegExp | null;
  branchRegex: RegExp | null;
  removeCutoff: number;
  exemptProtectedBranches: boolean;
};

async function processBranch(
  plan: Action,
  branch: Branch,
  commitComments: TaggedCommitComments,
  params: Params
) {
  if (plan.action === "skip") {
    console.log(plan.reason);
    return;
  }

  if (plan.action === "keep stale") {
    console.log(
      "Branch was marked stale on " + formatISO(plan.lastCommentTime)
    );
    console.log(
      "It will be removed within " + params.daysBeforeBranchDelete + "days"
    );
    return;
  }

  if (plan.action === "mark stale") {
    console.log("Marking branch as stale");
    console.log(
      "It will be removed within " + params.daysBeforeBranchDelete + "days"
    );

    if (params.isDryRun) {
      return;
    }

    const commentTag = "stale:" + branch.branchName;
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

  if (plan.action === "remove") {
    console.log(
      "-> 🗑️ removing stale branch (stale comment date is " +
        formatISO(plan.lastCommentTime) +
        ")"
    );

    if (params.isDryRun) {
      return;
    }

    commitComments.deleteBranch(branch);

    plan.comments.forEach((c) => {
      commitComments.deleteCommitComments({ commentId: c.id });
    });
  }
}

type Action =
  | { action: "skip"; reason: string }
  | { action: "mark stale" }
  | { action: "keep stale"; lastCommentTime: number }
  | { action: "remove"; lastCommentTime: number; comments: Comment[] };

function skip(reason: string): Action {
  return {
    action: "skip",
    reason: reason,
  };
}

type Comment = { created_at: string; id: number };

async function getCommitCommentsForBranch(
  commitComments: TaggedCommitComments,
  branch: Branch
): Promise<Comment[]> {
  const commentTag = "stale:" + branch.branchName;
  return await commitComments.getCommitCommentsWithTag({
    commentTag,
    commitSHA: branch.commitId,
  });
}

async function planBranchAction(
  branch: Branch,
  filters: BranchFilters,
  commitComments: TaggedCommitComments,
  params: Params
): Promise<Action> {
  if (params.protectedOrganizationName && branch.belongsToOrganization) {
    return skip(
      `author ${branch.username} belongs to protected organization ${params.protectedOrganizationName}`
    );
  }

  if (filters.authorsRegex && filters.authorsRegex.test(branch.username)) {
    return skip(`author ${branch.username} is exempted`);
  }

  if (filters.branchRegex && filters.branchRegex.test(branch.branchName)) {
    return skip(`branch ${branch.branchName} is exempted`);
  }

  if (filters.exemptProtectedBranches && branch.isProtected) {
    return skip(`branch ${branch.branchName} is protected`);
  }

  if (branch.date >= filters.staleCutoff) {
    return skip(
      `branch ${branch.branchName} was updated recently (${formatISO(
        branch.date
      )})`
    );
  }

  const comments = await getCommitCommentsForBranch(commitComments, branch);
  if (comments.length == 0) {
    return {
      action: "mark stale",
    };
  }

  const latestStaleComment = comments.reduce((latestDate, comment) => {
    const commentDate = Date.parse(comment.created_at);
    return Math.max(commentDate, latestDate);
  }, 0);

  if (latestStaleComment >= filters.removeCutoff) {
    return { action: "keep stale", lastCommentTime: latestStaleComment };
  }

  return { action: "remove", comments, lastCommentTime: latestStaleComment };
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

  console.log(
    `Branches updated before ${formatISO(staleCutoff)} will be marked as stale`
  );
  console.log(
    `Branches updated before ${formatISO(
      removeCutoff
    )} will be candidate for deletion`
  );

  const icons: Record<Action["action"], string> = {
    remove: "❌",
    "mark stale": "✏",
    "keep stale": "😐",
    skip: "✅",
  };

  for await (const branch of readBranches(
    octokit,
    headers,
    repo,
    params.protectedOrganizationName
  )) {
    const plan = await planBranchAction(
      branch,
      filters,
      commitComments,
      params
    );
    core.startGroup(`${icons[plan.action]} branch ${branch.branchName}`);
    try {
      await processBranch(plan, branch, commitComments, params);

      if (plan.action !== "skip") {
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
