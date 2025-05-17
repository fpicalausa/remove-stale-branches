import { Octokit } from "@octokit/core";
import { formatISO } from "date-fns/formatISO";
import { subDays } from "date-fns/subDays";
import { TaggedCommitComments } from "./commitComments";
import { Branch, Params } from "./types";
import { readBranches } from "./readBranches";
import * as core from "@actions/core";
import { addDays } from "date-fns";

type BranchFilters = {
  staleCutoff: number;
  authorsRegex: RegExp | null;
  allowedBranchesRegex: RegExp | null;
  deniedBranchesRegex: RegExp | null;
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
      (branch.author?.username || branch.author?.email || "(unknown user)") +
      " on " +
      formatISO(branch.date)
  );

  if (plan.action === "skip") {
    console.log(plan.reason);
    return;
  }

  if (plan.action === "mark stale") {
    let author = "";
    console.log("-> branch will be removed on " + formatISO(plan.cutoffTime));
    if (!branch.author?.username) {
      author=params.defaultRecipient || "";
    } else if (params.remapAuthors[branch.author.username]) {
      author=params.remapAuthors[branch.author.username];
    } else {
      author=branch.author.username;
    }
    console.log(
      "-> marking branch as stale (notifying: " + author + ")"
    );

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
        params.repo,
        author
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
  if (
    branch.author &&
    params.protectedOrganizationName &&
    branch.author.belongsToOrganization
  ) {
    return skip(
      `author ${branch.author.username} belongs to protected organization ${params.protectedOrganizationName}`
    );
  }
  if (!branch.author?.username && !params.ignoreUnknownAuthors) {
    return skip(
      `unable to determine username of author for branch ${branch.branchName}`
    );
  }

  if (branch.openPrs && params.ignoreBranchesWithOpenPRs) {
    return skip(`branch ${branch.branchName} has open PRs`);
  }

  if (
    filters.authorsRegex &&
    branch.author?.username &&
    filters.authorsRegex.test(branch.author.username)
  ) {
    return skip(`author ${branch.author.username} is exempted`);
  }

  if (filters.allowedBranchesRegex && !filters.allowedBranchesRegex.test(branch.branchName)) {
    return skip(`branch ${branch.branchName} is outside of branch selection`);
  }
  if (filters.deniedBranchesRegex && filters.deniedBranchesRegex.test(branch.branchName)) {
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
  if (comments.length == 0 && params.daysBeforeBranchDelete !== 0) {
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
  if (latestStaleComment >= filters.removeCutoff) {
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

function logActionRunConfiguration(
  params: Params,
  staleCutoff: number,
  removeCutoff: number
) {
  if (params.isDryRun) {
    console.log("Running in dry-run mode. No branch will be removed.");
  }

  console.log(
    `Branches updated before ${formatISO(staleCutoff)} will be marked as stale`
  );

  if (params.daysBeforeBranchDelete == 0) {
    console.log(
      "Branches will be instantly removed due to days-before-branch-delete being set to 0."
    );
  } else {
    console.log(
      `Branches marked stale before ${formatISO(removeCutoff)} will be removed`
    );
  }
}

import pLimit from "p-limit";

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
  const allowedBranchesRegex = params.selectedBranchesRegex
    ? new RegExp(params.selectedBranchesRegex)
    : null;
  const deniedBranchesRegex = params.protectedBranchesRegex
    ? new RegExp(params.protectedBranchesRegex)
    : null;
  const repo = params.repo;

  const filters: BranchFilters = {
    staleCutoff,
    authorsRegex,
    allowedBranchesRegex,
    deniedBranchesRegex,
    removeCutoff,
    exemptProtectedBranches: params.exemptProtectedBranches,
  };
  const commitComments = new TaggedCommitComments(repo, octokit, headers);
  let operations = 0;
  let summary: Record<Plan["action"], number> & { scanned: number } = {
    remove: 0,
    "mark stale": 0,
    "keep stale": 0,
    skip: 0,
    scanned: 0,
  };

  if (params.ignoreUnknownAuthors && !params.defaultRecipient) {
    console.error(
      "When ignoring unknown authors, you must specify a default recipient"
    );
    return;
  }

  logActionRunConfiguration(params, staleCutoff, removeCutoff);

  const icons: Record<Plan["action"], string> = {
    remove: "❌",
    "mark stale": "⚰️",
    "keep stale": "😐",
    skip: "✅",
  } as const;

  const limit = pLimit(5); // Limit concurrency to 5

  try {
    const branchPromises = [];
    for await (const branch of readBranches(
      octokit,
      headers,
      repo,
      params.protectedOrganizationName
    )) {
      summary.scanned++;
      branchPromises.push(
        limit(async () => {
          let plan: Plan;
          try {
            plan = await planBranchAction(
              now.getTime(),
              branch,
              filters,
              commitComments,
              params
            );
          } catch (e) {
            console.error(`Error planning action for branch ${branch.branchName}:`, e);
            summary.skip++;
            return;
          }
          summary[plan.action]++;
          core.startGroup(`${icons[plan.action]} branch ${branch.branchName}`);
          try {
            await processBranch(plan, branch, commitComments, params);
            if (plan.action !== "skip" && plan.action != "keep stale") {
              operations++;
            }
          } catch (e) {
            console.error(`Error processing branch ${branch.branchName}:`, e);
          } finally {
            core.endGroup();
          }
        })
      );

      if (operations >= params.operationsPerRun) {
        console.log("Stopping after " + operations + " operations");
        break;
      }
    }
    await Promise.all(branchPromises);
  } catch (e) {
    console.error("Error reading branches:", e);
  }

  const actionSummary = [
    `${summary.scanned} scanned`,
    `${icons.skip} ${summary.skip} skipped`,
    `${icons["mark stale"]} ${summary["mark stale"]} marked stale`,
    `${icons["keep stale"]} ${summary["keep stale"]} kept stale`,
    `${icons.remove} ${summary.remove} removed`,
  ].join(", ");
  console.log(`Summary:  ${actionSummary}`);
}
