# oss-tokens repo spec (v1)

This is everything a repository needs to accept donated agent time. There is no server and no account: GitHub is the task board.

## 1. Opt in: `.github/ai-tasks.yml`

A repo takes part only if this file exists on its default branch and says `ai_help: true`. Without it, oss-tokens ignores the repo's issues even if they carry the label.

```yaml
version: 1
ai_help: true

# Where your AI contribution rules live. Agents read this before working.
policy: CONTRIBUTING.md

# Which kinds of tasks donated agents may do here.
#   repro         reproduce a reported bug, or report that it can't be reproduced
#   triage        find duplicates, say what information is missing, suggest labels
#   failing-test  write a test that fails because of the bug (no fix)
#   docs          fix outdated docs, broken examples, broken links
allowed_tasks: [repro, triage]

# How results may be delivered.
#   none        comments only (patches go inside the comment, collapsed)
#   draft-only  draft pull requests allowed (planned, not in v1)
#   allowed     ready pull requests allowed (planned, not in v1)
pull_requests: none

# How results are written.
#   standard  the AI-written result is the comment (labelled as AI-assisted)
#   quoted    the donor writes a short summary in their own words; the AI
#             output follows as a clearly marked quote. For policies that
#             ban AI-written comments from personal accounts (e.g. Rust's).
result_format: standard

# Optional: how a donor's agent checks its work. Runs inside a Docker
# container on the donor's machine, with only the repo mounted.
verify:
  image: node:22
  command: npm ci && npm test

limits:
  per_donor_open: 1   # active claims one person may hold in this repo
  claim_hours: 24     # an unfinished claim expires after this long

# Optional: anything else agents should know. Keep it short.
notes: Tests live in test/. Please don't touch the generated files in dist/.
```

Every field except `ai_help` has a default: `allowed_tasks: [repro, triage]`, `pull_requests: none`, `result_format: standard`, no verify step, `per_donor_open: 1`, `claim_hours: 24`.

`policy` may be a path in the repo (optionally with `#section`) or a URL. If it's a path, donors' agents are shown its text before they start.

## 2. Post a task: an issue with labels

| Label | Meaning |
|---|---|
| `ai-help-wanted` | required: this issue is open to donated agent time |
| `ai:repro`, `ai:triage`, `ai:failing-test`, `ai:docs` | the task type (one of them) |

Optional hardware labels, for bugs that only show up on some machines. A task with them only goes to donors whose machine matches. OS labels are alternatives (`windows` + `macos` = either); `gpu` and `cuda` must both hold.

| Label | Meaning |
|---|---|
| `ai-needs:windows`, `ai-needs:macos`, `ai-needs:linux` | must run on this OS |
| `ai-needs:gpu` | needs a GPU |
| `ai-needs:cuda` | needs an NVIDIA GPU |

Results always state the OS, version, CPU architecture and GPU they ran on.

If no `ai:` label is present, oss-tokens reads a `### Task type` section from the issue body, which is what the issue form in `templates/ISSUE_TEMPLATE/ai-task.yml` produces. A task whose type isn't in `allowed_tasks` is skipped.

Write tasks like you would for a new contributor: what's wrong, what "done" looks like, and how to check it.

## 3. The comment protocol

Donors' agents coordinate through issue comments carrying a hidden HTML marker. Humans see a normal comment; the marker is what the tool reads.

| Marker | Posted when |
|---|---|
| `<!-- oss-tokens:claim v1 -->` | a donor starts working on the task |
| `<!-- oss-tokens:release v1 -->` | a donor gives the task up |
| `<!-- oss-tokens:result v1 -->` | a donor posts finished work (this also ends their claim) |

Rules:
- A claim is active from its comment's creation time for `claim_hours`, unless the same GitHub user later posts a release or result.
- If two claims are active, the earlier one wins. The later claimant releases automatically.
- The author of a marker is the GitHub account that posted the comment, so claims can't be forged for someone else.
- Every result comment states that it is AI-assisted, which model made it, a rough token count, and that the donor reviewed it before posting.

## 4. Stopping

Remove `ai_help: true` (or the whole file) and oss-tokens stops showing your issues immediately. Remove the `ai-help-wanted` label to close a single task.
