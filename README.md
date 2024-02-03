# Remove Stale Branches

This Github Action will identify stale branches and mark them for deletion after a set period.

By default, branches are identified as stale if their latest commit is older than 90 days.
This is useful for repositories that have many contributors that work on and off, and may forget to cleanup 🧹

# How it works?

This Action look for branches whose last commit is older than a `days-before-branch-stale` days. It will first add a comment on the latest commit, notifying the contributor that their branch is stale. If no action is taken before `days-before-branch-delete` days, the branch will be removed.

This can be prevented by removing the comment, or adding new commits to the branch.

## ⚠️💣 CAUTION

Without setting `dry_run: true`, this action will remove branches. Consider setting `dry_run: true` until you are happy with how this action works.

## Inputs

| Input                       | Defaults                                                                                                                                                                                                                                            | Description                                                                                                                                                                                                                                                    |
|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `github-token`              | `${{ secrets.GITHUB_TOKEN }}`                                                                                                                                                                                                                       | PAT for GitHub API authentication.                                                                                                                                                                                                                             |
| `dry-run`                   | `false`                                                                                                                                                                                                                                             | Flag that prevents this action from doing any modification to the repository.                                                                                                                                                                                  |
| `exempt-organization`       | (not set)                                                                                                                                                                                                                                           | Name of a Github organization. Branches for which the latest commiter belongs to this organization will be exempt from cleanup.                                                                                                                                |
| `exempt-branches-regex`     | `^(main\|master)$`                                                                                                                                                                                                                                  | Regular expression defining branches name that are exempt from cleanup.                                                                                                                                                                                        |
| `exempt-authors-regex`      | (not set)                                                                                                                                                                                                                                           | Regular expression defining authors who are exempt from cleanup.                                                                                                                                                                                               |
| `exempt-protected-branches` | `true`                                                                                                                                                                                                                                              | Whether protected branches are exempted                                                                                                                                                                                                                        |
| `stale-branch-message`      | `@{author} Your branch [{branchName}]({branchUrl}) hasn't been updated in the last 60 days and is marked as stale. It will be removed in a week.\r\nIf you want to keep this branch around, delete this comment or add new commits to this branch.` | Template for commit comments notifying the author that their branch will be removed.                                                                                                                                                                           |
| `days-before-branch-stale`  | `90`                                                                                                                                                                                                                                                | Number of days since the last commit before a branch is considered stale. Once stale, this action will leave a comment on the last commit, marking the branch as stale.                                                                                        |
| `days-before-branch-delete` | `7`                                                                                                                                                                                                                                                 | Number of days before a stale branch is removed. Set to 0 to remove immediately.                                                                                                                                                                               |
| `operations-per-run`        | `10`                                                                                                                                                                                                                                                | Maximum number of stale branches to look at in any run of this action.                                                                                                                                                                                         |
| `ignore-unknown-authors`    | `false`                                                                                                                                                                                                                                             | Whether to abort early when a commit author cannot be identified. By default, stop early since this may indicate that the token used to run the action doesn't have the right privileges. Set to true and define a default recipient instead if not a concern. |
| `default-recipient`         | (not set)                                                                                                                                                                                                                                           | When `ignore-unknown-authors` is `true`, use this login as the author to notify when the branch becomes stale.                                                                                                                                                 |

### Tokens replaced in `stale-branch-message`

The following tokens are replaced when composing a comment on a stale branch:

| Token                    | Description                                                                                                           | Example                                                                      |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| {branchName}             | The name of the branch slated for removal                                                                             | `fix/my-branch-123`                                                          |
| {branchUrl}              | A url pointing to the branch slated for removal                                                                       | `https://github.com/fpicalausa/remove-stale-branches/tree/fix/my-branch-123` |
| {repoOwner}              | The name of the owner (organization or individual) of the repo                                                        | `fpicalausa`                                                                 |
| {repoName}               | The name of the repo                                                                                                  | `remove-stale-branches`                                                      |
| {author}                 | The author of the last commit on the branch to be removed or the `default-recipient` if the author cannot be resolved | `fpicalausa`                                                                 |
| {daysBeforeBranchStale}  | The number of days before a branch is considered stale                                                                | `60`                                                                         | `fpicalausa`                                                                 |
| {daysBeforeBranchDelete} | The number of days before a branch marked for removal gets deleted                                                    | `7`                                                                          | `7`                                                                                                                                           |

## Example usage

The follow examples show how you can use this action.

### Default configuration

This configuration will mark all branches (except for main/master) as stale after 90 days. After 7 more days, it will remove the branch.

```yml
on:
  schedule:
    - cron: "0 0 * * *" # Everday at midnight

jobs:
  remove-stale-branches:
    name: Remove Stale Branches
    runs-on: ubuntu-latest
    steps:
      - uses: fpicalausa/remove-stale-branches@v1.6.0
        with:
          dry-run: true # Check out the console output before setting this to false
```

### Cleanup branches from people who left an organization

This configuration will remove branches of people who are not longer part of the acme-inc organization after two weeks, except for (dependabot)[https://github.com/dependabot].

```yml
on:
  schedule:
    - cron: "0 0 * * *" # Everday at midnight

jobs:
  remove-stale-branches:
    name: Remove Stale Branches
    runs-on: ubuntu-latest
    steps:
      - uses: fpicalausa/remove-stale-branches@v1.6.0
        with:
          dry-run: true # Check out the console output before setting this to false
          exempt-organization: "acme-inc"
          exempt-authors-regex: "^dependabot"
          days-before-branch-stale: 7
          days-before-branch-delete: 7
```

# Why not using (your favorite action) instead?

There are many other actions to remove stale branches out there. Some just [remove](https://github.com/beatlabs/delete-old-branches-action) [branches](https://github.com/cultureamp/delete-old-branches-action), no question asked. Others close the branche out [through a PR](https://github.com/etiennemartin/stale-branch-action).

This action notifies users through a commit comment. There are pros and cons to each approach, pick the one that suits you best!

# Development & Build

To start, install dependencies with `npm install`. The source files live under `src`.

You can run the tool locally by:
1. Set `GITHUB_TOKEN` in a .env file with a PAT with correct access 
2. Edit `src/cli.ts` as needed to poin to the correct repo
3. Run `src/cli.ts` under `ts-node` as follows:

    ```shell
    source .env && npx ts-node src/cli.ts
    ```

To deploy you changes, start a PR. Don't forget to run `npm run build` and include changes to the `dist` dir in your commit.
