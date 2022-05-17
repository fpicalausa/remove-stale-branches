import { Octokit } from "@octokit/core";
import { Branch, Repo } from "./types";

const GRAPHQL_QUERY = `query ($repo: String!, $owner: String!, $after: String) {
  repository(name: $repo, owner: $owner) {
    id
    refs(
      refPrefix: "refs/heads/",
      first: 10,
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

export async function* readBranches(
  octokit: Octokit,
  headers: { [key: string]: string },
  repo: Repo,
  organization?: string
): AsyncGenerator<Branch> {
  let pagination = { hasNextPage: true, endCursor: null };

  while (pagination.hasNextPage) {
    const params = {
      ...repo,
      after: pagination.endCursor,
      headers,
      organization,
    };

    const {
      repository: {
        refs: { edges, pageInfo },
      },
    } = await octokit.graphql(
      organization ? GRAPHQL_QUERY_WITH_ORG : GRAPHQL_QUERY,
      params
    );

    for (let i = 0; i < edges.length; ++i) {
      const ref = edges[i];
      const {
        node: {
          branchName,
          prefix,
          target: {
            oid,
            author: {
              date,
              user: { login, organization },
            },
          },
        },
      } = ref;

      yield {
        date: Date.parse(date),
        branchName,
        prefix,
        commitId: oid,
        username: login,
        belongsToOrganization: Boolean(organization),
      };
    }
    pagination = pageInfo;
  }
}
