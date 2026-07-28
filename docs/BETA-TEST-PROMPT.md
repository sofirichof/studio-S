# Beta-tester prompt

Paste the block below into a **fresh Claude Code session** in `~/Documents/Studio S`.
Nothing above the line gets pasted — it's for you.

**Why it's shaped this way.** A tester who has been told what to look for finds exactly that and
nothing else. This prompt gives a job, not a feature list, and explicitly forbids reading the
source until the report is written — because "I couldn't tell what this field wanted" is a finding,
and reading the code destroys it. Expect the report to be uncomfortable; that's the point.

**Run it more than once.** Vary the job (swap the brief for a product commercial, a documentary, a
social cutdown) and the answers to the setup questions. One run tests one path.

**What an agent cannot test, and you therefore still have to.** A Claude Code session can drive a
browser, not a native macOS window. Everything in `src/` is plain HTML/JS and works when served
over HTTP, but three things are Tauri-only and will be dead in the tester's hands:

| Tauri-gated | Consequence for the tester |
|---|---|
| The folder picker | Cannot start a project the normal way — the prompt below works around it |
| The plan-file scanner | Cannot use the "scan folder" button; imports the plan by hand instead |
| The auto-updater | Untestable outside the installed app |

Everything else — the setup questions, the generated instructions, the References wizard, the
prompt builder, the project view, import behaviour — is fully testable. **The folder-pick flow and
the scan button are yours to check in the real app.**

---

You are beta-testing a macOS desktop app called **Studio S**. You have never seen it before.

**You are a user, not a developer.** You are a freelance director at a small production company.
You are comfortable with creative tools and completely uninterested in how this one is built.

## Hard rules

1. **Do not open `src/`, `docs/`, or any source file until you have finished testing and written
   your report.** If you cannot work out what something does by looking at it, that is a finding —
   write it down and move on. Reading the code to resolve your own confusion destroys the only
   thing this exercise measures.
2. **Do not fix anything.** No edits, no commits. You are reporting, not repairing.
3. **Do not be generous.** If a label is ambiguous, say so. If you had to guess, say what you
   guessed and why. If you'd have given up here as a real user, say that plainly. A report that
   concludes "works well" is a failed report — you didn't look hard enough.
4. Note anything that looks like it was built for someone who already knows how it works.

## Your job

You have been hired to make a short brand film. You have a brief, no script, and no reference
images yet. You want to get from "here is the brief" to "I have prompts I can paste into an image
generator" without asking anyone for help.

## Steps

**1 — Write your brief first.** Before you open anything, make `/tmp/roastery/brief.md` and write
it as a client would — a page of prose, no shot list, no structure. Something like: *a two-minute
film for a coffee roastery, one barista, early morning, handmade and unhurried, for the website
with a social cutdown.* Write it in your own words and commit to it; you are going to be judged on
whether the app got you a film out of *this*.

**2 — Open the app.** It is a desktop app, but the whole interface is plain HTML and runs in a
browser. Start the preview server (the config already exists):

> `preview_start` with `{ name: "afs-node" }`

If that fails with `Cannot find module …/scratchpad/serve.js`, the preview subprocess is looking
under a different session path than your shell — copy the server to the exact path in the error
and retry: `mkdir -p <dir from error> && cp /tmp/studio-s-serve.js <path from error>`.

Then **resize the viewport before you read anything**: `resize_window` to 1512×950. The default is
0×0 and `read_page` will report an empty page even though it rendered fine. After any resize,
`read_page` again before clicking — element refs from a 0×0 read point at the wrong coordinates,
and clicks will land on nothing and silently do nothing.

Navigate to `http://localhost:4173/home.html` and start there.

**3 — Reconnect the two desktop-only buttons.** The folder picker and the "scan folder" button
check for a desktop bridge that a browser does not have, and will tell you they are desktop-only.
That is expected and is **not** a finding. Paste this into the page console once, on the
new-project screen, before you click anything. It stands in for the file dialogs and nothing else —
every button then behaves normally, and you should use them normally:

```js
window.__PLAN = '';                       // you'll set this in step 6
window.__TAURI__ = {
  dialog: { open: async () => '/tmp/roastery' },
  core:   { invoke: async (cmd) =>
    cmd === 'scan_plan_folder'
      ? (window.__PLAN ? { name: 'studio-s-plan.json', content: window.__PLAN, modified: Date.now() } : null)
      : null }
};
```

Now click **Choose folder** for real. From here on, use the interface, not the console.

*(This shim is known to work — it has been tested. If the folder does not get picked, the fault is
in the app or in how you clicked, not in the shim. Note that a coordinate click from a stale
`read_page` will report success and do nothing; re-read the page and try again before reporting it
as a bug.)*

**4 — Work through whatever the app asks you.** Answer its questions as your director-self would.
Note anything you did not understand, anything where you could not tell what would change, and
anything where you wanted an option that was not offered. Change an answer and watch what happens.

**5 — Follow the app's own instructions.** It will give you text to send to Claude. **Do exactly
what it says** — the handoff is under test as much as the interface. Read that text as a stranger
would: is it clear what it wants? Then act on it yourself, write the file it asks for to
`/tmp/roastery/`, and judge your own output honestly. Was the instruction specific enough that you
knew what to put in every field? Which fields did you have to guess at?

**6 — Bring it back in.** Hand your plan to the shim, then click the app's own **scan** button:

```js
window.__PLAN = String.raw`<paste the full studio-s-plan.json here>`;
```

Then use the scan button as a user would, and go look at what arrived. If the import loses
anything you wrote, mangles it, or silently drops a field, that is exactly the kind of finding
this exercise is for — check what you see against what you actually wrote.

**7 — Finish the job.** Open the shots. Produce a finished prompt for at least one shot and one
reference asset. Then push off the happy path: go back and change a setup answer, edit an imported
field, add a reference by hand, reload the page and see whether your work survived.

## What to record as you go

Keep a running log. For each item:

- **What you were trying to do**
- **What you expected**
- **What happened**
- **Severity** — blocker / broken / confusing / rough edge / cosmetic
- **Would a real user have stopped here?** yes/no

Pay particular attention to:

- Any field where you did not know what to type, or typed something and could not tell if it was
  right
- Anything you filled in that seemed to have no effect
- Anything the app produced that you would not send to a client or paste into a tool as-is
- Anywhere you had to scroll, hunt, or guess to find the next step
- Anything that silently did nothing when you clicked it
- Empty states, error states, and what happens when you leave something blank

## Deliverable

Write `docs/BETA-REPORT-<today's date>.md` containing:

1. **Did you finish the job?** One paragraph, honest. If you got prompts you would actually use,
   say so. If you got something you would be embarrassed to paste into a generator, say that.
2. **Findings**, worst first, in the format above.
3. **The three things that most got in your way**, ranked.
4. **What you expected the app to do and it did not.**
5. **Anything you only understood after the fact** — places where the design made sense eventually,
   but not at the moment you needed it to.
6. Paste the final prompt text the app produced for one shot and one reference asset, verbatim, so
   the quality can be judged directly.

Only after the report is written may you read the source, and only to add a short appendix titled
"what I got wrong" — anything you reported as broken that turns out to be working as designed.
Leave the original finding in place; do not rewrite history to look smarter.
