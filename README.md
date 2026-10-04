# Computing Studio

[Open the site](https://3esign.github.io/computing-studio/) · [Srpski](README.sr.md)

Computing made visible for first-year architecture and civil engineering. A teaching resource by **Semir Poturak**, Union — Nikola Tesla University, Belgrade. English and Serbian interfaces.

## Three kinds of material

- **Course record:** the teacher's published topics, actual classes and tasks. It intentionally starts empty. No class dates, exam dates or assessment rules have been invented.
- **Instruments:** seven working browser laboratories covering code traces, spatial transforms, quantities, construction scheduling, an invented stepped pyramid, geometry, trusses, routes and slicing. Models state their assumptions and limits.
- **Idea cloud:** 54 open explorations and 51 source cards, including a new twelve-source research wave on large classes and Giza. A repertoire, not an approved syllabus.

## Phones in class

Q1–Q6 have shareable URLs, local QR images, projector view, a timer, printable questions, private choices and revealable explanations. A changed case follows each explanation. Answers remain on the student's device: this is **not a live polling or assignment submission system**. [TEACHING.md](TEACHING.md) explains the proposed large-room routine.

The access page explicitly saves an offline snapshot. External references are not downloaded. Browser storage may be evicted; test reopening before class.

## Edit content without redesigning

The teacher's desk provides a form and preview. Download the validated JSON and replace data/course.json in this repository. Downloading does not publish; publication requires repository write access.

| File | Purpose |
|---|---|
| data/course.json | Topics, questions and conceptual routes |
| data/ideas.json | Open prompts, sources and boundaries |
| data/sources.json | Provenance, reading scope and limits |
| data/labs.json | Laboratory index |
| assets/site.css | Shared identity and responsive layout |
| lab/ | Self-contained instruments |

Topic status: draft, published or held. Only published/held appear in the student course record; held requires its real date. **All files in this public repository, including drafts in JSON, remain publicly readable.** Never add confidential drafts, names, marks or student submissions. Use both en/sr text and stable IDs.

## Preview and release

Requires Node.js, with no added packages:

    node tools/serve.cjs
    node tools/check.cjs
    node tests/kod.test.cjs
    node tests/giza.test.cjs

After edits:

    node tools/build-offline.cjs

Review the files, commit and push to main. GitHub Pages serves the repository root; preview mirrors its /computing-studio/ subdirectory. The offline list must be rebuilt after content changes.

No login, analytics, CDN scripts, remote fonts or submission backend. Browser state stays local. The host still receives ordinary web requests. No API keys are required. Each source card records what was actually read; linking a tool does not mean it was installed or tested.

## Verification limits

Numerical tests, responsive browser checks and offline reopening accompany this release. Desktop emulation is not a physical phone test. Educational impact, screen-reader usability, Safari and the room's Wi-Fi with 400 simultaneous students need a local pilot. The fictional pyramid is not a historical reconstruction or engineering design.
