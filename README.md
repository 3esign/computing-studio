# Computing Studio

[Open the site](https://3esign.github.io/computing-studio/) · [Start with one record](lab/dizajn/start.html#context) · [Srpski](README.sr.md)

Computing through architecture and civil engineering: a small object that students can describe, change and check. A teaching resource by **Semir Poturak**, Union — Nikola Tesla University, Belgrade. English and Serbian interfaces.

## A connected beginning

Follow **record/context → representation → relations → rule → code → system**. Start with a number and its meaning, connect drawing and table, distinguish a neighbour from the next row, count internal gaps, follow an execution and inspect a change to the whole. Predict before running and try a new case. This is an exploration path, not an approved syllabus or a claim of MIT equivalence or endorsement.

The guided entrance belongs to the existing Design laboratory. The studio has **8 laboratories, 12 questions, 71 open ideas and 64 source cards**. The course record remains empty until the teacher publishes actual topics or classes. No dates, marks or assessment rules are invented.

[Four design approaches](lab/dizajn/index.html) remain available. Later branches include [Code](lab/kod/index.html), [Truss](lab/resetka/index.html) and [Shape → instructions](lab/rezac/index.html). Models state their limits: a geometric result is not engineering approval, and a teaching toolpath is not a manufacturing file.

## Phone, paper and local work

Begin at [Q7](cas.html#Q7); Q1–Q6 retain their URLs. Predict on paper or a phone, map an element between views, execute a rule and explain a changed case. No projector is required. [TEACHING.md](TEACHING.md) gives the bilingual routine and worked checks.

Keep a local version and test reopening on the actual device. A private answer or saved file is not verified identity, attendance, a mark or submission to the teacher. This site has no live-polling or submission backend. The access page saves an offline snapshot; external sources are not downloaded and browser storage may be evicted. Check reopening before relying on it.

## Sources and original ideas

The [learning library](biblioteka.html?tag=learning) distinguishes theory, frameworks, qualitative cases and experiments. Cards give publication dates, versions, reading scope and limits. Historical papers inform questions; they do not establish current consensus or validate this studio. Our new prompts explore layout versus totals, adjacency, stable interfaces, shared identity and replayable instructions.

## Edit content

The teacher's desk previews and downloads course JSON. Downloading does not publish: repository write access is needed to replace the file and release a change.

| File | Purpose |
|---|---|
| data/course.json | Course record, questions, learning path and foundations |
| data/ideas.json | Optional prompts, sources and boundaries |
| data/sources.json | Provenance, reading scope and limits |
| data/labs.json | Eight laboratories, guided entrance and model limits |
| data/pasos/ | One passport record per object; Object 001 is the Old Sava Bridge |
| film/pasos/ | The passport film: live player, MP4, captions, storyboard and editorial dossier |
| assets/site.css | Shared layout and visual identity |
| lab/ | Browser instruments |

Use stable IDs and both en/sr texts. Topic statuses remain draft, published or held; held needs its real date. Only published/held appear in the student record, but **all repository files, including draft JSON, are public**. Never add names, confidential drafts, marks or student submissions.

## Preview and release

Node.js, with no added packages:

    node tools/serve.cjs
    node tools/check.cjs
    node tests/kod.test.cjs
    node tests/giza.test.cjs
    node tests/dizajn.test.cjs

After content changes:

    node tools/build-offline.cjs

Review and verify before committing and publishing. GitHub Pages serves the repository root; preview mirrors its /computing-studio/ subdirectory. No login, analytics, CDN scripts, remote fonts or API keys are required. Browser state stays local; the host receives ordinary web requests.

## Verification limits

Check numerical behaviour, links, responsive layout and offline/local reopening for each release. Desktop emulation does not replace a physical-phone check. Learning impact, assistive reading, browser differences and classroom connectivity need a local pilot. Linking a tool does not mean its software was installed or tested.
