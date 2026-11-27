# Meetup planning rules

The rules the server applies to a pod's planning, shared through
`packages/core`: which times an option may have, how many options there may
be, which option wins at the deadline, and what happens when none does. The
planner's own "Leading" mark and the form's checks follow them.

```ail
node MeetupPlanningRules : fn   level: system
  why   One set of rules for the phone and the server, so the planner shows what the
        deadline will decide (DESIGN §3.5, §4.3, §4.6, D7, F22).              <- PlanMeetup
  what
    Every time in this node is passed as epoch milliseconds, as its callers in the app and on the server pass them.
    type Vote = "yes" | "no"
    type OptionVotes = { id: text, startsAt: time, votes: map of text to Vote }
    type PlanningDeadlineOutcome = "schedule" | "extend" | "dissolve" | "archive"

    WINNING_YES_VOTES: integer = 3
    OPTIONS_PER_POD: integer = 3
    OPTIONS_PER_MEMBER: integer = 2
    OPTION_MAX_AHEAD_MS: integer = 1209600000
    OPTION_EARLIEST_LOCAL_MINUTE: integer = 480
    OPTION_LATEST_LOCAL_MINUTE: integer = 1320

    yesVotes(option: OptionVotes, memberUids: list of text) -> integer
      How many of the current members voted yes: a member who left takes their votes with them.
    unanimousYes(option: OptionVotes, memberUids: list of text) -> boolean
      True when there is at least one member and every one of them voted yes.
    winningOption(options: list of OptionVotes, memberUids: list of text, now: time) -> OptionVotes or nothing
      Among the options that start after now and have at least WINNING_YES_VOTES yes votes: the most yes votes,
      then the earlier start, then the lower id. Nothing when no option qualifies.
    optionTimeOk(startsAt: time, now: time) -> boolean
      True when startsAt is after now, at most OPTION_MAX_AHEAD_MS (14 days) after now, and its minute of the day in Copenhagen time
      is from OPTION_EARLIEST_LOCAL_MINUTE (08:00) to OPTION_LATEST_LOCAL_MINUTE (22:00), both included.
    planningDeadlineOutcome(p: { hasWinner: boolean, extensionUsed: boolean, hasMet: boolean }) -> PlanningDeadlineOutcome
      "schedule" with a winner; else "extend" when the extra round is unused; else "archive" for a pod that has met, "dissolve" for one that has not.

    examples
      yesVotes({ id: "sat", startsAt: 2026-11-21 14:00:00, votes: { mette: "yes", jonas: "yes", emil: "yes" } }, ["mette", "jonas", "sofie", "ahmed", "emil"]) => 3
      yesVotes({ id: "sat", startsAt: 2026-11-21 14:00:00, votes: { mette: "yes", jonas: "yes", emil: "yes" } }, ["mette", "jonas", "sofie", "ahmed"]) => 2
      yesVotes({ id: "sun", startsAt: 2026-11-22 11:00:00, votes: { sofie: "yes", ahmed: "no" } }, ["mette", "jonas", "sofie", "ahmed", "emil"]) => 1
      unanimousYes({ id: "sat", startsAt: 2026-11-21 14:00:00, votes: { mette: "yes", jonas: "yes", emil: "yes" } }, ["mette", "jonas", "sofie", "ahmed", "emil"]) => false
      unanimousYes({ id: "sat", startsAt: 2026-11-21 14:00:00, votes: { mette: "yes", jonas: "yes", sofie: "yes", ahmed: "yes", emil: "yes" } }, ["mette", "jonas", "sofie", "ahmed", "emil"]) => true
      unanimousYes({ id: "sat", startsAt: 2026-11-21 14:00:00, votes: {} }, []) => false
      winningOption([{ id: "sat", startsAt: 2026-11-21 14:00:00, votes: { mette: "yes", jonas: "yes", emil: "yes" } }, { id: "sun", startsAt: 2026-11-22 11:00:00, votes: { sofie: "yes", ahmed: "yes" } }], ["mette", "jonas", "sofie", "ahmed", "emil"], 2026-11-17 18:00:00).id => "sat"
      winningOption([{ id: "sat", startsAt: 2026-11-21 14:00:00, votes: { mette: "yes", jonas: "yes", sofie: "no", emil: "no" } }, { id: "sun", startsAt: 2026-11-22 11:00:00, votes: { sofie: "yes", ahmed: "yes" } }], ["mette", "jonas", "sofie", "ahmed", "emil"], 2026-11-17 18:00:00) => nothing
      winningOption([{ id: "sun", startsAt: 2026-11-22 11:00:00, votes: { sofie: "yes", ahmed: "yes", emil: "yes" } }, { id: "sat", startsAt: 2026-11-21 14:00:00, votes: { mette: "yes", jonas: "yes", emil: "yes" } }], ["mette", "jonas", "sofie", "ahmed", "emil"], 2026-11-17 18:00:00).id => "sat"
      winningOption([{ id: "sat", startsAt: 2026-11-21 14:00:00, votes: { mette: "yes", jonas: "yes", emil: "yes" } }, { id: "sun", startsAt: 2026-11-22 11:00:00, votes: { sofie: "yes", ahmed: "yes", emil: "yes", jonas: "yes" } }], ["mette", "jonas", "sofie", "ahmed", "emil"], 2026-11-17 18:00:00).id => "sun"
      winningOption([{ id: "sat", startsAt: 2026-11-21 14:00:00, votes: { mette: "yes", jonas: "yes", emil: "yes" } }, { id: "sun", startsAt: 2026-11-22 11:00:00, votes: { sofie: "yes", ahmed: "yes", emil: "yes" } }], ["mette", "jonas", "sofie", "ahmed", "emil"], 2026-11-21 14:00:00).id => "sun"
      winningOption([{ id: "b", startsAt: 2026-11-21 14:00:00, votes: { mette: "yes", jonas: "yes", emil: "yes" } }, { id: "a", startsAt: 2026-11-21 14:00:00, votes: { mette: "yes", jonas: "yes", emil: "yes" } }], ["mette", "jonas", "sofie", "ahmed", "emil"], 2026-11-17 18:00:00).id => "a"
      winningOption([{ id: "sat", startsAt: 2026-11-21 14:00:00, votes: { mette: "yes", jonas: "yes", emil: "yes" } }], ["mette", "jonas", "sofie", "ahmed"], 2026-11-17 18:00:00) => nothing
      optionTimeOk(2026-11-16 12:00:00, 2026-11-16 12:00:00) => false
      optionTimeOk(2026-11-16 12:30:00, 2026-11-16 12:00:00) => true
      optionTimeOk(2026-11-17 08:00:00, 2026-11-16 12:00:00) => true
      optionTimeOk(2026-11-17 07:30:00, 2026-11-16 12:00:00) => false
      optionTimeOk(2026-11-17 22:00:00, 2026-11-16 12:00:00) => true
      optionTimeOk(2026-11-17 22:01:00, 2026-11-16 12:00:00) => false
      optionTimeOk(2026-11-30 12:00:00, 2026-11-16 12:00:00) => true
      optionTimeOk(2026-11-30 12:30:00, 2026-11-16 12:00:00) => false
      planningDeadlineOutcome({ hasWinner: true, extensionUsed: true, hasMet: true }) => "schedule"
      planningDeadlineOutcome({ hasWinner: false, extensionUsed: false, hasMet: false }) => "extend"
      planningDeadlineOutcome({ hasWinner: false, extensionUsed: true, hasMet: false }) => "dissolve"
      planningDeadlineOutcome({ hasWinner: false, extensionUsed: true, hasMet: true }) => "archive"

  how
    decide every time in these examples is Copenhagen wall-clock time
      because the drop's time zone is Copenhagen, and optionTimeOk reads the hour there (DROP_TIME_ZONE in packages/core)
    decide a single option can win, with at least 3 yes votes
      because a quiet pod is not dissolved for proposing too little (DESIGN §3.5)
    decide ties go to the earlier time, then the lower id
      because DESIGN §3.5 says ties go to the earlier time, and the id makes it deterministic (lifecycle.ts)
    decide options whose time has come cannot win
      because a meetup cannot be scheduled in the past (lifecycle.ts: "Options whose time has already come are out")
    decide one extra round per planning round, then a pod that never met dissolves and one that has met archives
      because fewer pods are lost to one quiet weekend (DESIGN F22, A31, §4.6)
  free [ helper names ]
  sources
    Code: "packages/core/src/pods/lifecycle.ts", "packages/core/src/pods/planning.ts", "functions/src/callables/pods.ts" (where they are applied)
    Examples: run against the existing code with tsx on 27 November 2026 (times built with fromLocal, Copenhagen)
    Design: DESIGN §3.5, §4.3 Options, §4.6, D7, F22, A31
```
