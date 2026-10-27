# Task: fix documentation

Goal: make the docs match the code. Small, surgical changes only.

1. Find the docs the task points at, and the code they describe.
2. Fix what is wrong: outdated options, broken examples, wrong signatures, dead links. Check each claim against the code in the workspace; don't guess.
3. Keep the existing voice, format and structure. Don't rewrite sections that are correct, and don't add marketing or filler.
4. If an example is code, make sure it would actually run against the current API. If the repo has a verify command that checks docs, run `run_verify`.

## Result format

```
**Changed:** <file>: <what and why, one line each>
**Checked against:** <file:line of the code each fix relies on>
```

Then `submit_result` with `include_patch: true`.
