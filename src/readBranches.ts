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
          name
          prefix
          ... on Ref {
            refUpdateRule {
              allowsDeletions
            }
          }
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
          name
          prefix
          ... on Ref {
            refUpdateRule {
              allowsDeletions
            }
          }
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

type PageInfo = { endCursor: string | null, hasNextPage: boolean, hasPreviousPage: boolean, startCursor: string | null };

type Page<N, E> = {
  edges: E[],
  nodes: N[],
  pageInfo: PageInfo,
  totalCount: number
}

type GitObjectID = string;

type Blob = {}
type Tag = {}
type Tree = {}

type GitTimeStamp = string;

type Organization = {
  id: unknown
}

type User = {
  email: string
  login: string
  organization: Organization | null
}

type GitActor = {
  email: string | null,
  name: string | null
  user: User | null,
  date: GitTimeStamp
}

type Commit = {
  author: GitActor
}

type GitOject = {
  id: unknown
  oid: GitObjectID
} & (Commit | Blob | Tag | Tree)


type Ref = {
  id: unknown,
  name: string,
  prefix: string
  refUpdateRule: unknown | null
  target: GitOject
}

type RefEdge = {
  cursor: string,
  node: Ref
}


type RefConnection = Page<Ref, RefEdge>


type Repository = {
  refs: RefConnection
}

export async function* readBranches(
  octokit: Octokit,
  headers: { [key: string]: string },
  repo: Repo,
  organization?: string
): AsyncGenerator<Branch> {
  let pagination: PageInfo = { hasNextPage: true, endCursor: null, hasPreviousPage: false, startCursor: null };

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
    } = await octokit.graphql<{repository: Repository}>(
      organization ? GRAPHQL_QUERY_WITH_ORG : GRAPHQL_QUERY,
      params
    );

    for (let i = 0; i < edges.length; ++i) {
      const ref = edges[i];
      const {
          name,
          prefix,
          refUpdateRule,
      } = ref.node;

      const { oid, author: { date, user } } = ref.node.target as (GitOject & Commit)

      const login = user ? user.login : null;
      const organization = user?.organization?.id;
      yield {
        date: Date.parse(date),
        branchName: name,
        prefix,
        commitId: oid,
        username: login,
        belongsToOrganization: Boolean(organization),
        isProtected: refUpdateRule !== null,
      };
    }
    pagination = pageInfo;
  }
}
