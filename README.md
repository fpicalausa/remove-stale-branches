# Remove Stale Branches

Github Action that will identify stale branches and mark them for deletion after a set period.

By default, branches are identified as stale if their latest commit is older than 3 months.

## Development

You'll need to install included dependencies with `npm install`

Update the src files with your changes.

To deploy these to the action, run `npm build` and commit the update `dist` dir changes.
