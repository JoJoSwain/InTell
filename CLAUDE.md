@AGENTS.md

## Claude Code specifics

- Start every non-trivial task in plan mode and wait for approval before editing.
- Run `git status` first. If there's uncommitted work you didn't make, stop and ask.
- Use the brief in `docs/briefs/` for the current milestone when one exists. Its scope beats your own judgment about "while I'm here" improvements.
- When reviewing a branch, check it against AGENTS.md §5 (hard constraints) and the milestone's acceptance criteria in `docs/BUILD_PLAN.md`. Report violations first, then bugs, then style.
- Don't run `expo prebuild` or native builds, or install on a device, unless asked. Those steps happen on the product owner's machine.
