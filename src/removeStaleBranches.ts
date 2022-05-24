import { Octokit } from "@octokit/core";
import formatISO from "date-fns/formatISO";
import subDays from "date-fns/subDays";
import { TaggedCommitComments } from "./commitComments";
import { Branch, Params } from "./types";
import { readBranches } from "./readBranches";
import * as core from "@actions/core";
import { addDays } from "date-fns";

type BranchFilters = {
  staleCutoff: number;
  authorsRegex: RegExp | null;
  branchRegex: RegExp | null;
  removeCutoff: number;
  exemptProtectedBranches: boolean;
};

async function processBranch(
  plan: Plan,
  branch: Branch,
  commitComments: TaggedCommitComments,
  params: Params
) {
  console.log(
    "-> branch was last updated by " +
      branch.username +
      " on " +
      formatISO(branch.date)
  );

  if (plan.action === "skip") {
    console.log(plan.reason);
    return;
  }

  if (plan.action === "mark stale") {
    console.log("-> branch will be removed on " + formatISO(plan.cutoffTime));
    console.log("-> marking branch as stale");

    if (params.isDryRun) {
      console.log("-> (doing nothing because of dry run flag)");
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

  console.log(
    "-> branch was marked stale on " + formatISO(plan.lastCommentTime)
  );

  if (plan.action === "keep stale") {
    console.log("-> branch will be removed on " + formatISO(plan.cutoffTime));
    return;
  }

  if (plan.action === "remove") {
    console.log(
      "-> branch was slated for deletion on " + formatISO(plan.cutoffTime)
    );
    console.log("-> removing branch");
    if (params.isDryRun) {
      console.log("-> (doing nothing because of dry run flag)");
      return;
    }

    commitComments.deleteBranch(branch);

    plan.comments.forEach((c) => {
      commitComments.deleteCommitComments({ commentId: c.id });
    });
  }
}

type Plan =
  | { action: "skip"; reason: string }
  | { action: "mark stale"; cutoffTime: number }
  | { action: "keep stale"; lastCommentTime: number; cutoffTime: number }
  | {
      action: "remove";
      lastCommentTime: number;
      cutoffTime: number;
      comments: Comment[];
    };

function skip(reason: string): Plan {
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
  now: number,
  branch: Branch,
  filters: BranchFilters,
  commitComments: TaggedCommitComments,
  params: Params
): Promise<Plan> {
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
      cutoffTime: addDays(now, params.daysBeforeBranchDelete).getTime(),
    };
  }

  const latestStaleComment = comments.reduce((latestDate, comment) => {
    const commentDate = Date.parse(comment.created_at);
    return Math.max(commentDate, latestDate);
  }, 0);

  const cutoffTime = addDays(
    latestStaleComment,
    params.daysBeforeBranchDelete
  ).getTime();
  if (latestStaleComment <= filters.removeCutoff) {
    return {
      action: "keep stale",
      cutoffTime,
      lastCommentTime: latestStaleComment,
    };
  }

  return {
    action: "remove",
    comments,
    cutoffTime,
    lastCommentTime: latestStaleComment,
  };
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
  const repo = params.repo;

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
    `Branches marked stale before ${formatISO(removeCutoff)} will be removed`
  );

  const icons: Record<Plan["action"], string> = {
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
      now.getTime(),
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
