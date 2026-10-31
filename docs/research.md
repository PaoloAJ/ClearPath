# Research

Source material for every requirement in the README. Keep interview notes anonymized (P1–P8).

## Participants

| ID | Group | Travel mode | Notes |
|---|---|---|---|
| P1 | Rider | | |
| P2 | Rider | | |
| P3 | Rider | | |
| P4 | Rider | | |
| P5 | Mobility aid | | |
| P6 | Mobility aid | | |
| P7 | Mobility aid | | |
| P8 | Mobility aid | | |

## Findings

| | Finding | Evidence (participants, quotes) |
|---|---|---|
| **I1** | Elevator status is invisible. | |
| **I2** | The shortest route isn't always usable. | |
| **I3** | Reporting has to be fast and trustworthy. | |

## Requirements

| | Requirement | Comes from |
|---|---|---|
| **R1** | Check elevator and barrier status before leaving | I1 |
| **R2** | Get warned about new barriers mid-route, with a one-tap reroute | I1 |
| **R3** | Routes based on a personal travel profile, including temporary conditions | I2 |
| **R4** | Report a barrier in two taps | I3 |
| **R5** | Every alert shows recency, confirmations, and verification, and stale alerts expire | I3 |
| **R6** | The app itself is fully accessible | Report |

## Usability testing

Scripted tasks run in demo mode, so every participant sees the same alerts and elevator status. The goal is to find out whether people can do the five core tasks without help, and where they get stuck. With 5–8 participants, report counts and medians, not statistics.

### Participants

Recruit from the same two groups as the interviews, 3–4 each: riders (bike, scooter, skateboard) and mobility-aid users (wheelchair, walking aid, crutches). Include at least one screen-reader user if you can (R6). Label participants U1, U2, … and keep names out of this file.

### Setup

- One phone with Expo Go, signed in to the test student account, `EXPO_PUBLIC_DEMO_MODE=true`.
- The [smoke check](smoke-check.md) passed today.
- Before each participant: open the demo panel (long-press the ClearPath logo), tap **Reset demo data**, and set the profile back to the default. Ages and confirmation counts are relative to the reset, so they read the same for everyone.
- One moderator reads the script and runs the demo panel. One note-taker times tasks and logs errors. Screen recording only if the participant agrees.
- 25–30 minutes per session.

### Consent script

Read aloud before starting:

> Thanks for helping. This is a class project for UF's HCI course. We're testing an app, not you, so if something is confusing, that's what we need to know. I'll ask you to do five short tasks and think out loud while you do them. It takes about 25 minutes. You can skip any task or stop at any time, and that's completely fine. We'll take notes, but we won't write down your name. Your notes will be labeled with a number like U3. With your OK, we'd also like to record the phone's screen, not your face. Is that OK? Do you have any questions before we start?

Record verbal consent (yes or no to taking part, yes or no to screen recording) in the session log.

### Tasks

Read each task as written, then stay quiet unless the participant is stuck for 60 seconds or asks for help. Helping turns a success into "with help".

| # | Task (read to participant) | Req. | Success criteria |
|---|---|---|---|
| T1 | "You're about to head to Marston. Find out whether its elevator is working right now, and who said so." | R1, R5 | Says the Marston elevator is **working** and that it's a **verified Facilities** status, within 60 s |
| T2 | "Set up the app for how you get around, then plan a route from Library West to Marston." | R3 | Sets their own travel mode (or wheelchair if they prefer not to say), picks the route tagged **For you**, and starts it within 2 min. Bonus: can say why another route was flagged |
| T3 | "Start walking that route." Moderator taps **Simulate walk**, then **Inject alert ahead** about 20 s in. | R2 | Notices the warning before the simulated walk reaches the alert, and chooses **Reroute** (or deliberately keeps the route and says why) within 30 s |
| T4 | "On the way, you see a blocked path. Report it." | R4 | Report sent with the right type in two taps from the report screen, within 30 s, with no wrong turns |
| T5 | "Look at the flooding alert south of Library West. Would you avoid that spot? Why?" | R5 | Correctly states roughly how old it is and how many people confirmed it, and uses that in their answer |

### What to measure

| Measure | How |
|---|---|
| Task success | Per task: success, with help, or fail |
| Time on task | From the end of the instruction to the success criteria being met |
| Errors | Wrong taps, backtracks, and misreadings (for example, calling a student report verified) |
| Ease per task | Single Ease Question right after each task: "Overall, how easy or hard was that?" 1 (very hard) to 7 (very easy) |
| Overall usability | System Usability Scale (10 items) at the end. Score 0–100. Above 68 is above average |
| Comments | Quotes from thinking aloud, and answers to: "What was most confusing?" and "Would you use this? When?" |

### Session log

| ID | Group | Travel mode | Screen reader | Consent / recording | Date |
|---|---|---|---|---|---|
| U1 | | | | | |

### Results

| Task | Success | With help | Fail | Median time | Median ease (1–7) | Main problems |
|---|---|---|---|---|---|---|
| T1 | | | | | | |
| T2 | | | | | | |
| T3 | | | | | | |
| T4 | | | | | | |
| T5 | | | | | | |

**SUS:** mean ___ (range ___–___), n = ___

### Findings to issues

Each problem seen in two or more sessions becomes a GitHub issue that names the requirement it affects (`R1`–`R6`) and the sessions it came from (for example, "U2, U5"). Threshold and timing problems, such as the reroute warning appearing too late, go to the routing workstream.
