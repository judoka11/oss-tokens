# A comment from oss-tokens: what is this?

Someone donated their own AI coding agent's time to your project through **oss-tokens**. Their agent picked up an issue your project marked as open to AI help, worked on it on their machine, and they reviewed the result before it was posted under their GitHub account.

## Why it showed up on your issue

oss-tokens only works on repos that opted in, and only on issues a maintainer labelled:

- your repo has a `.github/ai-tasks.yml` file with `ai_help: true`, and
- the issue carries the `ai-help-wanted` label (only people with triage rights can add labels).

If neither is true, the comment didn't come from oss-tokens working as intended. Please [open an issue](https://github.com/judoka11/oss-tokens/issues) and tell us.

## What the comments mean

| Comment | Meaning |
|---|---|
| "🤖 @someone is working on this…" | They claimed the task so others don't duplicate it. Expires after `claim_hours` (24h by default). |
| "🤖 AI-assisted contribution…" | The finished result: the model used, a rough token count, the machine it ran on, and the donor's confirmation that they reviewed it. |
| "@someone released this task" | They gave up; it's open again. |

The person named in the comment is responsible for it, not the tool.

## Tell donors what helps

React to result comments: 👍 if it helped, 👎 if it didn't. Donors see your reactions in their history, and it's the main way the system learns what is worth posting. If you delete a result comment, the donor's history shows it as deleted.

## How to stop it

- **One issue:** remove the `ai-help-wanted` label.
- **Whole repo:** delete `.github/ai-tasks.yml`, or set `ai_help: false`. It takes effect immediately.
- **One person:** block them from the repo or organization in GitHub's settings, like any other account.

## How to tune it

In `.github/ai-tasks.yml` you choose which task types are allowed, how results are written (`result_format: quoted` if your policy doesn't accept AI-written comments as someone's own words), how long claims last, and how many tasks one person may hold. See the [full spec](../SPEC.md).
