# Object 001 — editorial dossier for the film

**How an object becomes visible** / **Kako objekat postaje vidljiv**

Pilot: **Old Sava Bridge, Belgrade (Stari savski most)**. The film is not a biography of the bridge and not a technical assessment. It shows how scattered public traces become a digital passport, and why the unknown has to stay visible.

## Limit of the claim

The record was extended on 7 October 2026 with a public 2021 ENVICO scoping document hosted by the city Directorate (S8), and the designer's description of the replacement bridge (S9). A missing value in this bounded reading is not proof that no record exists. Original as-built drawings and a 2024/25 condition inspection were not obtained. The downloadable MP4 preserves the 6 October render; the live player, storyboard and captions use the updated record.

**Working thesis:** the bridge is not invisible because nothing is known about it. It is invisible as a connected system: date, material, origin, condition, people, movement and future use sit in different records of different weight.

## What the passport holds

- Object: Old Sava Bridge, Belgrade, 1942–2025.
- Position: coordinates from the encyclopaedia entry, not surveyed. The axis on the map is 430 m long (the length in S1 and S2), centred on those coordinates and drawn at right angles to the Sava.
- Timeline: 10 events, from erection in 1942 to dismantling in 2025, each with its source.
- Sources: 9 public sources.
- Claims: 18 questions: 6 confirmed, 3 single-source, 2 conflicting, 1 unconfirmed and 6 unknown.
- Evidence class: three claims now cite the original scoping document S8 directly. Their overall recorded classes and states remain separate from the classes of individual sources; a new link is not a survey or independent verification of every statement. The gate refuses `D`/`M` without a source that is itself a document or a measurement.
- Places: Dortmund, Žabalj, the Sava, Batajnica, Veliko Selo and an undetermined next location. Each place has a role in the story; none of them is by itself proof of technical origin or future use.

All figures in this list are recomputed from the passport by `node dokazi/film.test.js` on every change.

## What the source check of 6 October 2026 changed

| finding | before | after |
|---|---|---|
| The 500 t arch figure in S6 is the outlet's own narration, not the chief designer's words, and the same sentence calls it the arch of the "old Railway Bridge" (Novosti published the same text the same day) | "500 t per the chief designer" | 500 t, K1 info text, with a **source flag** |
| "About 400 t in reports" has no source among S1–S7 | shown in the film | removed |
| The lifting contractor HSP publishes about 420 t for the arch it lifted | not in the passport | **S7**, ≈420 t |
| The 1,400 t total is the waste management plan's figure as Insajder quotes it; the plan itself is not public | evidence class D | evidence class S |
| The quoted reassembly sentence reads "na **nekoj** lokaciji koju će odrediti republički organi i institucije" | quoted without "nekoj" | exact quote |
| S6 attributes 106 m and 11 m to the "Old Railway Bridge" as well | not recorded | source flag on the outline claim |
| The State Institute's support for protection (December 2019, without jurisdiction) was on screen without a passport entry | film text only | timeline event, S2 |
| The 1.1 km map axis did not match the 430 m length, and the drawn Sava missed the bridge by about 1 km | drawn by eye | axis from the length; rivers through encyclopaedia bridge coordinates |
| "No file was ever made" / "NO RECORD" contradicted the passport's own limit | on screen | "Its public record is scattered" / "NO PASSPORT YET" |

## States seen in the film

| state | meaning | how it is drawn |
|---|---|---|
| confirmed | the claim has adequate support in the passport | solid cell |
| single-source | one cited trace, no independent confirmation | one blue bar |
| conflicting | sources give different values | two red bars; both values are shown, neither is chosen |
| unconfirmed | a claim exists, the proof is insufficient | hatched bar, dashed outline |
| unknown | the question is open | dashed, empty, "?" |

## Dramaturgy in 9 scenes

1. **An object stood here** — the title, then an empty frame where the object stood.
2. **Empty fields** — 18 questions as a form, 0 answered; the protection initiative and "no protection on record".
3. **Time and the city** — a map drawn only from verified points; the years count up, each with its source; the axis falls away.
4. **Sources** — sources enter from the current record; the fields fill in record order, each in its state.
5. **Sources in conflict** — two spans drawn over each other; span, width and arch mass side by side; the source flag.
6. **The path** — Dortmund, the Tisa, the Sava; then Batajnica and the abandoned Veliko Selo plan; the next location stays a question.
7. **Mass and condition** — one square per tonne; zero tonnes with a public finding; a statement is not a report.
8. **What the passport makes possible** — seven conditions for reuse, one met by a public record; an argument, labelled as an argument.
9. **Unknown is a record** — the assembled passport, then the call: make a passport for your object.

## Rules of narration

- Every figure and every sentence on screen is built from `objekat-001-savski-most.json`; the scenes only draw it.
- Every historical or technical claim carries its references from the current source register.
- A conflict is never resolved in the edit; it is shown as a conflict.
- The word "proven" is not used for any value in the passport.
- Coordinates, the bridge axis and the rivers are orientation, never a survey base, and the legend says so.
- "Future location" and "reuse" stay open until the passport has a new public source.
- Serbian and English are semantic pairs; a broken character or an unclear translation blocks the render.

## Sources

- **S1** — Wikipedia (sr), "Stari savski most".
- **S2** — Wikipedia (en), "Old Sava Bridge".
- **S3** — Gradnja.rs, "Na Savi zelena lučna ćuprija: saga o demontaži Starog savskog mosta".
- **S4** — N1, "Luk Starog savskog mosta na obali, sledi rasklapanje i transport do Batajnice" (5 September 2025).
- **S5** — Insajder, "Stari savski most ide u Batajnicu: šta dalje sa simbolom Beograda" (23 May 2025), quoting the waste management plan of 13 November 2024.
- **S6** — K1 info, statement by Danijel Kukaraš, chief designer, on the condition of the structure (4 July 2025).
- **S7** — HSP Hídépítő Speciál, "Removal of the Arch Span of the Old Sava Bridge, Belgrade" (17 May 2026), the contractor that lifted the arch.
- **S8** — ENVICO for ERM, [Focused ESIA Scoping Report for Demolition of Old Sava Bridge](https://www.beoland.com/images/most_na_savi/eng/P-144-21-ESIA-Scoping-Report_Demolition-Sava-Bridge-Final.pdf#page=21), final 2.0, 28 November 2021. Page 21 gives 401.2 m, wooden piles and riveted connections. This is preliminary scoping, not an as-built survey; its length endpoints are not defined. The earlier 430 m map axis remains illustrative and does not resolve the disagreement.
- **S9** — Saobraćajni institut CIP, [Bridge over the Sava River at the location of the Old Sava Bridge](https://sicip.rs/en/projekti/bridge-over-the-sava-river-at-the-location-of-the-old-sava-bridge/). This describes the replacement project, not the old bridge. Its dimensions are excluded from old-bridge geometry.

S2–S7 were read on 6 October 2026. S1 could not be opened from the working environment on that date; claims that rest on S1 alone (1953 aqueduct, the 1964 closure) keep the earlier check. Reading a page confirms what it says, not that what it says is true.

## The river base map

The Sava and the Danube are drawn as straight lines through the coordinates of the Ada, Gazela, Old Sava, Branko's, Pupin and Pančevo bridges and of the mouth of the Sava, as the Wikipedia (en) articles give them on 6 October 2026. It is not a bank line. No coastline, border or road is drawn.

## Next research inputs

1. Obtain the public design documentation, or confirm that it is not available.
2. Find the original source of each conflicting figure, and say what was measured: centre-to-centre span, clear opening or arch length.
3. Find the dispatch notes or weighbridge tickets from the dismantling: they give the mass that was actually measured.
4. Find a record of the condition test of the steel structure, or mark clearly that none is public.
5. Check the status of the parts in Batajnica and the formal conditions for reuse.
6. Add photographs, maps and documents only with date, author and permission to use.

## Production status

- The film is one dependency-free Canvas module, `film.js`. The same module plays in the browser (`index.html` in this folder) and is exported to `objekat-001.mp4` by `node tools/film_render.cjs`.
- Captions (`objekat-001.sr.vtt`, `objekat-001.en.vtt`) and `STORYBOARD.md` are derived from the module by `node tools/film_docs.cjs`.
- `node dokazi/film.test.js` checks the record and the text; `node tools/film_render.cjs --layout` measures every text box with the real font every 0.2 s and reports overlaps and truncations; `--check` renders a frame twice and compares the bytes.
- The film is silent by design. Music or narration needs a licence and a proofread script first.
