# Task: write a failing test

Goal: a test, in the project's own style and test framework, that fails on the current code because of the reported bug and would pass once it is fixed. Do **not** fix the bug.

1. Find where similar tests live and copy their conventions: file naming, helpers, assertions.
2. Write the smallest test that pins the bug. One behaviour, a clear name, no unrelated setup.
3. Call `run_verify`. The new test must fail **for the right reason** (the bug), and the existing tests should still behave as before. Read the output to confirm.
4. If you can't get a meaningful failure, release the task and say why.

## Result format

```
**Test:** <path::test name>
**Fails with:** <the key assertion error, copied from the verify output>
**Run with:** <the command>
```

Then `submit_result` with `include_patch: true` so the test file is attached.
