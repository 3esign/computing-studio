# Code, made visible

A beginner predicts a rule, changes an input, and follows the same calculation in source, number and diagram.

Open index.html locally or via the course's lab route. No build, packages, CDN, network calls, accounts, telemetry or uploads. English is default; Serbian uses the same model.

## Four instruments

- #loop: inputs [12,18,15] yield totals 12,30,45; intentional subtraction yields -12,-30,-45. Step executes one complete iteration. Play advances one iteration per second. Nothing autoplays; reduced motion disables Play and retains Step. Hidden documents pause.
- #transform: point (1,0), shift (4,0), CCW 90 degrees: translate then rotate gives (0,5); rotate then translate gives (4,1). Abstract coordinates use y upwards, mapped to SVG screen coordinates. Lines join discrete states; they are not measured trajectories.
- #walls: Z1 4000x3000x200 mm and Z2 2500x3000x200 mm. Volumes 2.4+1.5=3.9 m3; one-face areas 12+7.5=19.5 m2. Full rectangular solids only. No openings, overlaps, waste, material or professional quantity rules.
- #schedule: A2; B3 after A; C1 after A. Dependency-only finish 5 fictional days. B and C sharing one crane in listed order finish 6. The deterministic scheduler validates dependencies and reserves the crane in selected topological order. It is not an optimizer, calendar, site safety plan or resource leveling tool.

Blank numeric fields are invalid, not zero. Finite supported ranges: dimensions 0.001 to100000 mm; durations 0.001 to50 days; coordinates/shifts -20 to20; angle -180 to180 degrees; accumulator maximum12 values in API,3 in UI, each -1000 to1000. SVG is supplementary: every result also has DOM text/table. Tiny positive physical quantities retain scientific notation. The large coordinate readout rounds magnitudes below1e-12 tozero; its trace still shows scientific notation for floating-point residue.

## API

CommonJS require('./model.js') or browser window.KodModel:

- loopTrace(values,operator='add') returns {step,before,input,after}[].
- transformTrace({x,y,dx,dy,angle,order:'TR'|'RT'}) returns {start,middle,end,order}.
- wallQuantities([{id,l_mm,h_mm,t_mm}]) returns {walls:[{id,area_m2,volume_m3}],area_m2,volume_m3}.
- schedule([{id,duration,pre:[],crane:boolean}],sharedCrane=false) returns {rows:[{id,start,end,duration,crane}],finish}.
- codeSource('loop'|'transform'|'walls'|'schedule') returns the exact calculation kernel using Function.toString. Input validation runs in the public wrappers. No student code is evaluated.

The models continue original REPERTOAR-3000 section15 examples. This page demonstrates numerical logic; it does not validate engineering assumptions or measure educational effectiveness.

## Checks

From the OR project: node dokazi/kod.test.js. Tests cover known values, SI conversion, rigid-transform invariants, scaling, prefix conservation, dependency feasibility, crane non-overlap, bad input and non-mutation. The pure suite has23 passing checks. Local Edge QA checks320/390/1366px, both languages, keyboard, invalid inputs, displayed source, boundary values, pause/reduced motion and no network requests. Screenshots, detailed results and the design verdict are in the accompanying scratch evidence. Each device computes locally; no400-user backend load test is claimed.
