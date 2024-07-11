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
          associatedPullRequests(first: 1, states: OPEN) {
            nodes {
              state
            }
          }
          prefix
          ... on Ref {
            refUpdateRule {
              allowsDeletions
            }
          }
          target {
          ... on Commit {
              oid
              authoredDate
              author {
                email
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
          associatedPullRequests(first: 10, states: OPEN) {
            nodes {
              state
            }
          }
          prefix
          ... on Ref {
            refUpdateRule {
              allowsDeletions
            }
          }
          target {
          ... on Commit {
              oid
              authoredDate
              author {
                email
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

type PageInfo = {
  endCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
};

type Page<N, E> = {
  edges: E[];
  nodes: N[];
  pageInfo: PageInfo;
  totalCount: number;
};

type GitObjectID = string;

type Blob = {};
type Tag = {};
type Tree = {};

type ISOTimeStamp = string;

type Organization = {
  id: unknown;
};

type User = {
  email: string;
  login: string;
  organization: Organization | null;
};

type GitActor = {
  email: string | null;
  name: string | null;
  user: User | null;
};

type Commit = {
  author: GitActor | null;
};

type GitOject = {
  id: unknown;
  authoredDate: ISOTimeStamp;
  oid: GitObjectID;
} & (Commit | Blob | Tag | Tree);

type Ref = {
  id: unknown;
  name: string;
  associatedPullRequests: {
    nodes: [
      {
        state: "OPEN";
      }
    ];
  };
  prefix: string;
  refUpdateRule: unknown | null;
  target: GitOject;
};

type RefEdge = {
  cursor: string;
  node: Ref;
};

type RefConnection = Page<Ref, RefEdge>;

type Repository = {
  refs: RefConnection;
};

export async function* readBranches(
  octokit: Octokit,
  headers: { [key: string]: string },
  repo: Repo,
  organization?: string
): AsyncGenerator<Branch> {
  let pagination: PageInfo = {
    hasNextPage: true,
    endCursor: null,
    hasPreviousPage: false,
    startCursor: null,
  };

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
    } = await octokit.graphql<{ repository: Repository }>(
      organization ? GRAPHQL_QUERY_WITH_ORG : GRAPHQL_QUERY,
      params
    );

    for (let i = 0; i < edges.length; ++i) {
      const ref = edges[i];
      const { name, prefix, refUpdateRule, associatedPullRequests } = ref.node;

      const { oid, authoredDate, author } = ref.node.target as GitOject &
        Commit;

      let branchAuthor: Branch["author"] = null;
      if (author) {
        branchAuthor = {
          username: author.user?.login ?? null,
          email: author.email,
          belongsToOrganization: Boolean(author.user?.organization?.id),
        };
      }

      yield {
        date: Date.parse(authoredDate),
        branchName: name,
        prefix,
        commitId: oid,
        author: branchAuthor,
        isProtected: refUpdateRule !== null,
        openPrs: associatedPullRequests.nodes.length > 0,
      };
    }
    pagination = pageInfo;
  }
}
