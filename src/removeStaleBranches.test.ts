import { removeStaleBranches } from "./removeStaleBranches";
import { Params } from "./types";

type RequestCall = { route: string; options: any };

function makeOctokit(branchNode: any) {
  const requests: RequestCall[] = [];
  const octokit: any = {
    graphql: jest.fn(async () => ({
      repository: {
        refs: {
          edges: [{ cursor: "a", node: branchNode }],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
            hasPreviousPage: false,
            startCursor: null,
          },
        },
      },
    })),
    request: jest.fn(async (route: string, options: any) => {
      requests.push({ route, options });
      return { data: route.startsWith("GET") ? [] : {} };
    }),
  };
  return { octokit, requests };
}

function branchNode({ openPr }: { openPr: boolean }) {
  return {
    name: "feature/foo",
    prefix: "refs/heads/",
    refUpdateRule: null,
    associatedPullRequests: {
      nodes: openPr ? [{ number: 42, state: "OPEN" }] : [],
    },
    target: {
      oid: "abc123",
      authoredDate: "2000-01-01T00:00:00Z",
      author: { email: "a@b.com", user: { login: "octocat" } },
    },
  };
}

function makeParams(overrides: Partial<Params>): Params {
  return {
    isDryRun: false,
    daysBeforeBranchStale: 90,
    daysBeforeBranchDelete: 7,
    staleCommentMessage: "stale {branchName}",
    exemptProtectedBranches: true,
    operationsPerRun: 10,
    repo: { owner: "github", repo: "octocat" },
    ignoreUnknownAuthors: false,
    defaultRecipient: null,
    remapAuthors: {},
    ignoreBranchesWithOpenPRs: false,
    commentOnOpenPrs: false,
    ...overrides,
  };
}

describe("comment-on-open-prs", () => {
  test("marks stale via a pull request comment when enabled and a PR is open", async () => {
    const { octokit, requests } = makeOctokit(branchNode({ openPr: true }));

    await removeStaleBranches(octokit, makeParams({ commentOnOpenPrs: true }));

    const get = requests.find((r) => r.route.startsWith("GET"))!;
    expect(get.route).toBe(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
    );
    expect(get.options.issue_number).toBe(42);

    const post = requests.find((r) => r.route.startsWith("POST"))!;
    expect(post.route).toBe(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
    );
    expect(post.options.issue_number).toBe(42);
  });

  test("marks stale via a commit comment when disabled even if a PR is open", async () => {
    const { octokit, requests } = makeOctokit(branchNode({ openPr: true }));

    await removeStaleBranches(octokit, makeParams({ commentOnOpenPrs: false }));

    const post = requests.find((r) => r.route.startsWith("POST"))!;
    expect(post.route).toBe(
      "POST /repos/{owner}/{repo}/commits/{commit_sha}/comments",
    );
    expect(post.options.commit_sha).toBe("abc123");
  });

  test("falls back to a commit comment when enabled but no PR is open", async () => {
    const { octokit, requests } = makeOctokit(branchNode({ openPr: false }));

    await removeStaleBranches(octokit, makeParams({ commentOnOpenPrs: true }));

    const post = requests.find((r) => r.route.startsWith("POST"))!;
    expect(post.route).toBe(
      "POST /repos/{owner}/{repo}/commits/{commit_sha}/comments",
    );
    expect(post.options.commit_sha).toBe("abc123");
  });
});
