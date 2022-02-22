import {TaggedCommitComments} from "./commitComments";
import {DEFAULT_MESSAGE} from "src/messages";

describe('Commit comments', () => {
    test('message placeholders are replaced', () => {
        const message = TaggedCommitComments.formatCommentMessage(DEFAULT_MESSAGE, {
                date: Date.now(),
                username: 'theusername',
                belongsToOrganization: false,
                branchName: 'the-branch',
                prefix: 'origin',
                commitId: '123456'
            }, {
                repo: 'octocat',
                owner: 'github'
            },
        );

        const expected = "@theusername Your branch [the-branch](https://github.com/github/octocat/tree/the-branch) hasn't been updated in the last 60 days and is marked as stale. It will be removed in a week.\r\nIf you want to keep this branch around, delete this comment or add new commits to this branch."
        expect(message).toEqual(expected);
    })
})
