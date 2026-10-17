import { DEFAULT_CONFIG as C } from '../model/types'
import { RARE_SHARE } from '../model/scramblerRank'
import type { Manual } from './types'

const rare = Math.round(RARE_SHARE * 100)

export const en: Manual = {
  title: 'CubeStaff manual',
  subtitle: 'How groups and staff are built',
  intro:
    'This manual explains **every criterion** CubeStaff uses to build the groups and choose judges, scramblers, runners and reserves. Everything the program decides can be adjusted by hand afterwards — and whatever you adjust stays locked.',
  toc: 'On this page',
  feedbackTitle: 'Suggestions and feedback',
  feedbackText:
    'Found an odd criterion, a case the program does not handle or a rule that should be different? Send your suggestion — this manual and the rules evolve with real competitions.',
  feedbackEmail: 'Send an e-mail',
  feedbackGithub: 'Open a suggestion on GitHub',
  back: 'Back to CubeStaff',
  sections: [
    {
      id: 'fluxo',
      title: '1. Step by step',
      blocks: [
        {
          list: [
            '**Staff**: import the staff form CSV (or build the list by hand) with the **approved** volunteers.',
            '**Settings**: enter the number of stations and the number of groups for each round. The "≈ N per group" estimate shows next to it.',
            '**Generate groups**: the program distributes competitors and assigns staff following the rules below.',
            '**Review**: in the Groups tab, move people, swap in reserves, add or remove. Checks point out problems.',
            '**Save draft** (plan only, nothing published) or **Publish to WCA** (groups show up on Competition Groups and ScoreComps).',
            'On the day: after syncing WCA Live, **Update later rounds** generates only the rounds whose qualifiers are known.',
          ],
        },
      ],
    },
    {
      id: 'quem',
      title: '2. Who is included',
      blocks: [
        'Only **approved registrations** on the WCA count. Pending, waitlisted, cancelled or rejected registrations are left out of everything: groups, staff, reserves, manual picks and CSV import.',
        'People approved as **non-competing staff** can be assigned staff but do not compete.',
        'Mark **absent** people in the People tab before generating: they are left out of groups and staff.',
        '**Newcomer** = someone without a WCA ID (first competition).',
      ],
    },
    {
      id: 'competidores',
      title: '3. Competitor groups',
      blocks: [
        'You set the **number of groups** for each round. Groups have nearly equal sizes (at most 1 apart). Each group gets an equal slice of the round time in the WCA schedule; rounds on more than one stage split the groups between stages.',
        '**Ranking used**: the personal record **average** in the event (in blindfolded events, the **single**). Someone without a result counts as the slowest.',
        'Experienced competitors are ordered **slowest to fastest**: the first groups get the slowest and **the fastest end up in the last groups** (good for streaming, and it frees the best scramblers early on). Inside a group, the order (and station, if numbered) goes fastest to slowest.',
        'There are two ways to handle **newcomers**:',
        {
          table: [
            ['Option', 'Result'],
            [
              'Newcomers in the first groups · 100%',
              'The first groups are newcomers only (all Delegates can watch over them). Leftover seats are filled with the slowest experienced competitors.',
            ],
            [
              'Newcomers in the first groups · 50%',
              'The first groups are half newcomers, half (slower) experienced competitors, to balance incidents.',
            ],
            ['Mix across all groups', 'Newcomers are spread evenly across all groups.'],
          ],
        },
        '**Schedule conflict**: if someone competes in something else at the same time (e.g. another stage), the program swaps them with someone from a nearby group (similar level). If no swap is possible, a warning shows.',
        'FMC and Multi-BLD with scheduled attempts (-a1, -a2…) have no groups: everyone is assigned to the attempts.',
      ],
    },
    {
      id: 'staff',
      title: '4. General staff rules',
      blocks: [
        {
          list: [
            'Only people on the **approved volunteer list** (Staff tab) are assigned automatically. People who volunteer on the day go in as **extra helpers** and are assigned by hand.',
            '**One role at a time**: whoever competes in a group only competes; nobody does two things at the same time, including on different stages.',
            '**Newcomers never** judge or scramble.',
            'Form **availability** (Morning = before noon, Afternoon = after, in the competition time zone) is respected.',
            "**Event days**: people registered only for events on one day are not assigned or suggested as reserves on the other days (e.g. at Cuber Brasil Sumaré 2026, someone doing only 3BLD — Saturday — is out on Sunday, the 3x3 day). The days of any round of the person's events count. Non-competing staff always count as present. It can be turned off in Settings.",
            `**Tasks in a row**: at most ${C.maxConsecutive} consecutive staff groups before a break (adjustable; 0 = no limit).`,
            '**Maximum per person** for the whole competition: optional (0 = no limit).',
            'The **roles ticked** in the form limit what the person does; the **preferred role** gives them priority in that role.',
            'Staff is assigned in **chronological order**, and people with fewer tasks come first — so the load is shared.',
          ],
        },
      ],
    },
    {
      id: 'embaralhadores',
      title: '5. Scramblers',
      blocks: [
        `**How many**: 1 scrambler per ${C.competitorsPerScrambler} competitors in the group (1–${C.competitorsPerScrambler} → 1, ${C.competitorsPerScrambler + 1}–${C.competitorsPerScrambler * 2} → 2, …). Adjustable under Advanced.`,
        '**Who**: the best placed in the scrambler ranking, which works like this:',
        {
          list: [
            '**Percentile**: to compare different events, each ranking becomes a position from 0% (best in the competition) to 100% (worst), among the approved people of the competition only.',
            '**In the event itself**: the percentile in the event counts (average; blindfolded, single).',
            '**NxN variants**: the percentile in the **main event** also counts, and the better of the two is used. Someone very good at 3x3 is a great 3BLD scrambler even if they never did 3BLD.',
            '**Sum of Ranks**: sum of world ranking positions (single) across all events; an event without a result counts as the worst ranking seen in the competition + 1. It highlights people who are good at all or almost all events.',
            `**New event** (less than ${rare}% of its registrants have a result — e.g. FTO early on): Sum of Ranks counts **the same** as the event ranking.`,
            '**Regular event** (half or more with a result): Sum of Ranks is **not used** — only the event and, for variants, the main event count.',
          ],
        },
        {
          table: [
            ['Event', 'Also considers'],
            ['3x3 Blindfolded, 3x3 One-Handed, Multi-BLD, FMC', '3x3'],
            ['4x4 Blindfolded', '4x4'],
            ['5x5 Blindfolded', '5x5'],
            [`New event (< ${rare}% with a result)`, 'Sum of Ranks on equal footing'],
            ['Other events', 'Only the event itself (Sum of Ranks not used)'],
          ],
        },
        '**Form**: whoever answered they do **not** want to scramble is never assigned. Whoever ticked the puzzles they can scramble only scrambles those — but ticking the **main event** (e.g. 3x3) also allows its variants (3BLD, OH…), and a new event excludes no one (it is usually not even in the form).',
        '**Rotation**: among the best placed (a "window" of 3× the slots, at least 6), whoever has scrambled more loses priority to the next one. This way the best people are not stuck scrambling the whole competition.',
      ],
    },
    {
      id: 'juizes',
      title: '6. Judges and runners',
      blocks: [
        '**Judges per group** = number of stations (or the group size, if smaller). With more than one stage, each stage can have its own number of stations.',
        'Priority: **whoever competed in the previous group** judges the next one (already there and free); then whoever has **fewer tasks**; then whoever prefers judging.',
        '**Runners** are only assigned if the option is on: 1 per 8 stations.',
      ],
    },
    {
      id: 'delegados',
      title: '7. Delegates',
      blocks: [
        'Delegates (and trainees) are **spared** from judging and scrambling, so they can handle incidents and other tasks. Organizers follow the normal rules.',
        '**When competing, Delegates go to different groups**: if two or more Delegates compete in a round with two or more groups, they are split up (e.g. 3 Delegates and 2 groups → Delegate 1 in Group 1, Delegate 2 in Group 2, Delegate 3 in Group 1). This way there is always a free Delegate to handle incidents. The program moves as little as possible, swapping with an experienced competitor of similar level.',
        `**Plenty of staff**: if the free staff at that time (not counting Delegates) is at least ${C.delegateThreshold}× the group slots, Delegates are left out entirely.`,
        'Without plenty of staff: a **well-ranked** Delegate may scramble, and as a judge they are only a **last resort** when nobody else is left. Checks show when that happens.',
      ],
    },
    {
      id: 'suplentes',
      title: '8. Reserves',
      blocks: [
        `Each group gets up to ${C.reservesPerGroup} reserves (adjustable): people from the list who are **free at that time**, with fewer tasks, without Delegates when possible.`,
        'They are computed after all staff, so nobody already assigned to a simultaneous group is suggested.',
        'If someone is missing, click their name and use **Replace with reserve** — or **Replace with someone else…**, which lists anyone able to do staff at that time (free, not competing in the group and, for judge/scrambler, not a newcomer). Reserves are not sent to the WCA (there is no code for that): they stay in CubeStaff and in the sheets.',
      ],
    },
    {
      id: 'manual',
      title: '9. Manual changes and locks',
      blocks: [
        'Names in each group are shown in **alphabetical order**. Click any name to move groups, swap in a reserve or someone else, lock or remove. The **+** of each section adds someone, showing who is busy, unavailable, off the list or already in another role.',
        'Everything you change by hand is **locked** (padlock): when you generate again, locked items are kept and the rest is rebuilt around them. If the number of groups of a round changes, its locks are dropped.',
        'Undo and Redo keep up to 50 steps.',
      ],
    },
    {
      id: 'rodadas',
      title: '10. Later rounds',
      blocks: [
        'Rounds 2 and up can only be generated once the **qualifiers are known**. Enter results in WCA Live, open the next round and click **Synchronize** there.',
        'In CubeStaff, **Update later rounds** fetches the data from the WCA and generates only the new rounds, without touching what was already planned. If WCA Live has not opened the round yet, qualifiers are computed from the previous round results and the advancement condition (at most 75%).',
      ],
    },
    {
      id: 'salvar',
      title: '11. Where it is saved',
      blocks: [
        {
          list: [
            '**Save draft**: saves the plan in the competition itself on the WCA, without publishing groups. It opens on any device, for any Delegate or Organizer.',
            '**Publish to WCA**: saves the official groups and assignments.',
            '**In this browser**: automatic draft and private form data (e-mail, WhatsApp, scrambling quiz answers). The plan on the WCA is public, so this data never goes there.',
            'If two people save at the same time, CubeStaff warns you and you choose which version stays.',
            '**Clear all** deletes the plan and, if ticked, also the groups and assignments published on the WCA.',
          ],
        },
      ],
    },
    {
      id: 'conferencia',
      title: '12. Checks (warnings)',
      blocks: [
        {
          table: [
            ['Warning', 'Meaning'],
            ['Two roles at the same time', 'The person is in two simultaneous things (error).'],
            [
              'Registration not approved',
              'The registration was cancelled or became pending after generating (error). Generate again.',
            ],
            ['Newcomer on staff', 'Someone without a WCA ID was made judge/scrambler by hand (error).'],
            ['Will not be present', 'Assigned in a period they marked as unavailable.'],
            ['Only competes on another day', 'Assigned on a day with none of their registered events.'],
            ['X of Y judges / scramblers', 'Not enough free people to complete the group.'],
            ['Delegate on staff', 'Informational: a Delegate was assigned.'],
            ['Not on the staff list', 'Informational: assigned by hand without being on the list.'],
            ['Round not scheduled', 'The round is not in the WCA schedule and cannot be published.'],
          ],
        },
      ],
    },
  ],
}
