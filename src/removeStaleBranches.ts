import {Octokit} from "@octokit/core";
import formatISO from 'date-fns/formatISO'
import subDays from 'date-fns/subDays'
import {TaggedCommitComments} from "./commitComments";
import { Repo, Branch, Params } from "./types";

const GRAPHQL_QUERY = `query ($repo: String!, $owner: String!, $after: String) {
  repository(name: $repo, owner: $owner) {
    id
    refs(
      refPrefix: "refs/heads/",
      first: 10, 
      orderBy: { field: TAG_COMMIT_DATE, direction: ASC }, 
      after: $after,
    ) {
      edges {
        node {
          branchName: name
          prefix
          target {
          ... on Commit {
              oid
              author {
                date
                user {
                  login
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;

const GRAPHQL_QUERY_WITH_ORG = `query ($repo: String!, $owner: String!, $organization: String!, $after: String) {
  repository(name: $repo, owner: $owner) {
    id
    refs(
      refPrefix: "refs/heads/",
      first: 10, 
      orderBy: { field: TAG_COMMIT_DATE, direction: ASC }, 
      after: $after,
    ) {
      edges {
        node {
          branchName: name
          prefix
          target {
          ... on Commit {
              oid
              author {
                date
                user {
                  login
        
                  organization(login: $organization) {
                    id
                  }
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;

async function* readBranches(octokit: Octokit, headers: {[key: string]: string}, repo: Repo, organization?: string): AsyncGenerator<Branch> {
    let pagination = {hasNextPage: true, endCursor: null};

    while (pagination.hasNextPage) {
        const params = {
            ...repo,
            after: pagination.endCursor,
            headers,
            organization
        }

        const {repository: {refs: {edges, pageInfo}}} = await octokit.graphql(organization ? GRAPHQL_QUERY_WITH_ORG : GRAPHQL_QUERY, params);

        for (let i = 0; i < edges.length; ++i) {
            const ref = edges[i];
            const {node: {branchName, prefix, target: {oid, author: {date, user: {login, organization}}}}} = ref;

            yield {
                date: Date.parse(date),
                branchName,
                prefix,
                commitId: oid,
                username: login,
                belongsToOrganization: Boolean(organization)
            }
        }
        pagination = pageInfo
    }
}



async function removeOrNotifyStaleBranch(removeCutoff: number, commitComments: TaggedCommitComments, branch: Branch, params: Params) {
    const commentTag = "stale:" + branch.branchName;
    const comments = await commitComments.getCommitCommentsWithTag({
        commentTag,
        commitSHA: branch.commitId
    })

    if (comments.length == 0) {
        if (params.isDryRun) {
            console.log("-> marking as stale")
            return;
        }

        return await commitComments.addCommitComments({
            commentTag,
            commitSHA: branch.commitId,
            commentBody: TaggedCommitComments.formatCommentMessage(params.staleCommentMessage, branch, params.repo),
        })
    }

    const latestStaleComment = comments.reduce((latestDate, comment) => {
        const commentDate = Date.parse(comment.created_at);
        return Math.max(commentDate, latestDate);
    }, 0)

    if (latestStaleComment < removeCutoff) {
        console.log("-> removing stale branch (stale comment date is " + formatISO(latestStaleComment) + ")")
        if (params.isDryRun) {
            return;
        }

        commitComments.deleteBranch(branch);

        comments.forEach(c => {
            commitComments.deleteCommitComments({commentId: c.id })
        })
    }
}

async function processBranch(branch: Branch, filters: {staleCutoff: number, authorsRegex: RegExp | null, branchRegex: RegExp | null, removeCutoff: number}, commitComments: TaggedCommitComments, params: Params) {
    console.log("Looking at branch " + branch.branchName)

    if (params.protectedOrganizationName && branch.belongsToOrganization) {
        console.log("-> author " + branch.username + " belongs to protected organization " + params.protectedOrganizationName);
    }

    if (filters.authorsRegex && filters.authorsRegex.test(branch.username)) {
        console.log("-> author " + branch.username + " is protected")
        return false;
    }

    if (filters.branchRegex && filters.branchRegex.test(branch.branchName)) {
        console.log("-> branch " + branch.branchName + " is protected")
        return false;
    }

    if (branch.date >= filters.staleCutoff) {
        console.log("-> updated recently")
        return false;
    } else {
        console.log("-> last update was on " + formatISO(branch.date))
    }

    await removeOrNotifyStaleBranch(filters.removeCutoff, commitComments, branch, params)
    return true;
}

export async function removeStaleBranches(octokit: Octokit, params: Params): Promise<void> {
    const headers: {[key: string]: string} = params.githubToken ? {
        'Content-Type': 'application/json',
        'Authorization': 'bearer ' + params.githubToken
    } : {};

    const now = new Date();
    const staleCutoff = subDays(now, params.daysBeforeBranchStale).getTime();
    const removeCutoff = subDays(now, params.daysBeforeBranchDelete).getTime();
    const authorsRegex = params.protectedAuthorsRegex ? new RegExp(params.protectedAuthorsRegex) : null;
    const branchRegex = params.protectedBranchesRegex ? new RegExp(params.protectedBranchesRegex) : null;
    const repo = {
        repo: params.repo.repo,
        owner: params.repo.owner,
    };

    const filters = { staleCutoff, authorsRegex, branchRegex, removeCutoff};
    const commitComments = new TaggedCommitComments(repo, octokit, headers);
    let operations = 0;

    for await (const branch of readBranches(octokit, headers, repo, params.protectedOrganizationName)) {
        if (await processBranch(branch, filters, commitComments, params)) {
            operations++;
        }

        if (operations >= params.operationsPerRun) {
            console.log("Exiting after " + operations + " operations")
            return
        }
    }
}
