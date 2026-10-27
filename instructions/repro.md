# Task: reproduce a bug

Goal: tell the maintainer, with evidence, whether the reported bug happens, and give the smallest way to trigger it.

1. Read the report and note the claimed version, platform and steps.
2. In the workspace, find the code paths involved. Prefer reproducing through a small script or a test over a long manual procedure.
3. To execute anything, write the repro as a test file in the workspace and call `run_verify`: it runs inside a sandbox. Never run the project's code in your own terminal. If the repo has no verify command, reason from the code and say clearly that you did not execute it.
4. If the task needs a specific platform (`Needs:` in `get_task`), the sandbox (Linux) can't show the bug. Explain to the user that `run_native_check` runs the repo's checks directly on their machine without a sandbox, and call it only if they agree. Say in the result which OS/hardware you checked on; the result header adds this machine's details automatically.
5. Shrink the repro to the fewest steps that still show the bug.

## Result format

```
**Reproduced:** yes | no | partly
**Version / commit:** <commit from the workspace, e.g. git rev-parse --short HEAD>
**Minimal repro:**
<code block, under 30 lines>
**What happens:** <actual output or behaviour, copied, not paraphrased>
**Likely cause (optional):** <file:line and one sentence, only if you are fairly sure>
```

If it does **not** reproduce, say exactly what you tried and on which commit; that is still useful. Include the repro as a patch only if it is a test file.
