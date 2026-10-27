# Task: triage an issue

Goal: save the maintainer the first ten minutes of reading. This task needs no code changes.

1. Read the issue and its comments (from `get_task`).
2. Look for duplicates with `search_repo_issues`: try the key error message, then the main symptom in other words (searches are literal, so one phrasing often misses). Closed issues count: a closed "not planned" issue with an explanation is often the answer. Open the promising ones with `get_task` before calling them duplicates.
3. Check the code if the issue might be a usage question: an existing option or documented behaviour is a valid answer. You can read the code in a workspace (`prepare_workspace`) without running it.
4. Check whether the report has what's needed to act: version, platform, steps, expected vs actual, logs.

## Result format

```
**Summary:** <one sentence in plain words>
**Possible duplicates:** #123 (why), #456 (why) | none found (searched: "<terms>")
**Missing information:** <list> | none
**Suggested labels:** bug | question | docs | enhancement ... (suggestion only)
**Notes:** <optional, max 3 lines>
```

Don't speculate about fixes unless the cause is obvious from the report.
