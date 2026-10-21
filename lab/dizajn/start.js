/* A guided notebook: predict, inspect a real consequence, explain a changed case. */
(() => {
  'use strict';
  const M = window.LearningModel, $ = id => document.getElementById(id);
  const LANG_KEY = 'or-studio-v1:lang', WORK_KEY = 'or-studio-v1:learning';
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let lang = 'en', state = M.initial(), execution = null, traceIndex = 0, pendingImport = null, saveTimer, importSequence = 0;
  let storageAvailable = true, recovered = false;
  try { lang = JSON.parse(localStorage.getItem(LANG_KEY)) === 'sr' ? 'sr' : 'en'; const saved = localStorage.getItem(WORK_KEY); if (saved) { state = M.parseRecord(saved).state; recovered = true; } } catch { storageAvailable = false; }
  const hash = location.hash.slice(1); if (M.steps.includes(hash)) state.step = hash;
  const say = (en, sr) => lang === 'sr' ? sr : en;
  const fmt = n => Number(n.toFixed(5)).toLocaleString(lang === 'sr' ? 'sr-Latn' : 'en', { maximumFractionDigits: 5 });
  const stepNames = () => say(['Context', 'Representation', 'Relationships', 'Rule', 'Code', 'System'], ['Kontekst', 'Predstava', 'Odnosi', 'Pravilo', 'Kod', 'Sistem']);
  function announce(message) { $('announcements').textContent = message; }
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(WORK_KEY, JSON.stringify(M.record(state, lang))); storageAvailable = true; } catch { storageAvailable = false; }
      $('storage-status').textContent = storageAvailable ? say('Saved in this browser.', 'Sačuvano u ovom pregledaču.') : say('Browser saving unavailable. Download JSON to keep your work.', 'Čuvanje u pregledaču nije dostupno. Preuzmi JSON da zadržiš rad.');
    }, 250);
  }
  function metric(label, value, extra = '') { return '<div class="' + extra + '"><dt>' + label + '</dt><dd>' + value + '</dd></div>'; }
  function action(id, en, sr, primary = false, disabled = false) { return '<button id="' + id + '" type="button" class="' + (primary ? 'primary' : 'quiet') + '"' + (disabled ? ' disabled' : '') + '>' + say(en, sr) + '</button>'; }
  function prediction(en, sr, disabled = false) {
    return '<div class="prediction"><label class="prompt-label" for="prediction">' + say(en, sr) + '</label><textarea id="prediction" rows="3" maxlength="600">' + esc(state.predictions[state.step]) + '</textarea><p class="minor">' + say('Write a prediction, or make a note on paper. No answer is selected for you.', 'Zapiši predviđanje ili belešku na papiru. Odgovor nije unapred izabran.') + '</p><div class="action-row">' + action('reveal', 'Compare with the model', 'Uporedi sa modelom', true, disabled) + '</div></div>';
  }
  function answer(title, content) { return '<section class="answer" aria-live="polite"><h3>' + title + '</h3>' + content + '</section>'; }
  function paper(en, sr) { return '<p class="paper-note"><strong>' + say('On paper. ', 'Na papiru. ') + '</strong>' + say(en, sr) + '</p>'; }
  function grid(layout, interactive = false) {
    const cells = M.facade(layout).cells;
    const near = interactive && state.selectedId && state.reveals.relations ? M.neighbors(cells, state.selectedId) : [];
    return '<div class="panel-grid"' + (interactive ? ' role="group" aria-label="' + say('Choose a panel', 'Izaberi panel') + '"' : '') + '>' + cells.map(c => {
      const tag = interactive ? 'button' : 'div';
      const classes = ['panel-cell', !interactive && c.glass ? 'glass' : '', interactive && c.id === state.selectedId ? 'selected' : '', near.includes(c.id) ? 'neighbor' : ''].filter(Boolean).join(' ');
      return '<' + tag + ' class="' + classes + '"' + (interactive ? ' type="button" data-panel="' + c.id + '" aria-pressed="' + (c.id === state.selectedId) + '" aria-label="' + say('Panel ', 'Panel ') + c.id + ', ' + say('row ', 'red ') + c.row + ', ' + say('column ', 'kolona ') + c.col + '"' : '') + '><strong>' + c.id + '</strong><small>' + (interactive ? c.row + ' / ' + c.col : c.glass ? say('glass', 'staklo') : say('solid', 'puno')) + '</small></' + tag + '>';
    }).join('') + '</div>';
  }
  function context() {
    const known = state.contextShown, metres = state.contextUnit === 'mm' ? .6 : 600;
    return '<div class="lesson-layout"><div class="visual"><p class="eyebrow">' + say('THE SAME DIGITS', 'ISTE CIFRE') + '</p><div class="big-number"><strong>600</strong>' + (known ? '<span>' + state.contextUnit + '</span>' : '') + '</div>' + (known ? '<dl class="data-strip"><div><dt>' + say('Element', 'Element') + '</dt><dd>P1 · ' + say('panel', 'panel') + '</dd></div><div><dt>' + say('Property', 'Osobina') + '</dt><dd>' + say('Width', 'Širina') + '</dd></div><div><dt>' + say('Unit', 'Jedinica') + '</dt><dd>' + state.contextUnit + '</dd></div><div><dt>' + say('Source', 'Poreklo') + '</dt><dd>' + say('Teaching brief v1', 'Nastavni zadatak v1') + '</dd></div></dl>' : '<p class="caption">' + say('A width? A count? A time? The number alone does not say.', 'Širina? Broj komada? Vreme? Sam broj to ne govori.') + '</p>') + '</div><div class="work"><h3>' + say('Give the number a job.', 'Daj broju značenje.') + '</h3><p>' + say('A useful record names an element and a property. Its unit and source tell us how to interpret it.', 'Koristan zapis imenuje element i njegovu osobinu. Jedinica i poreklo govore kako da ga tumačimo.') + '</p>' + prediction('What could you know—and what is still missing?', 'Šta možeš znati, a šta još nedostaje?') + (known ? '<div class="action-row">' + action('unit-change', state.contextUnit === 'mm' ? 'Change only the unit to m' : 'Restore the unit mm', state.contextUnit === 'mm' ? 'Promeni samo jedinicu u m' : 'Vrati jedinicu mm') + '</div>' : '') + (state.reveals.context ? answer(say('A labelled width, not a complete panel.', 'Poznata širina, ne ceo panel.'), '<p><strong>600 ' + state.contextUnit + ' = ' + fmt(metres) + ' m.</strong> ' + say('The height and material are still missing. Width alone cannot determine area.', 'Visina i materijal još nedostaju. Sama širina ne određuje površinu.') + '</p><p>' + (state.contextUnit === 'm' ? say('The digits stayed the same; the represented width became 1,000 times larger. A unit is part of the meaning.', 'Cifre su ostale iste; predstavljena širina je postala 1.000 puta veća. Jedinica je deo značenja.') : say('Dividing by 1,000 changes the unit from millimetres to metres, while preserving this width.', 'Deljenje sa 1.000 menja jedinicu iz milimetara u metre, uz očuvanje ove širine.')) + '</p>') : '') + paper('Write 600 first. Add one label at a time. Cross out a claim that the record does not justify.', 'Prvo zapiši 600. Dodaj oznake jednu po jednu. Precrtaj tvrdnju koju zapis ne opravdava.') + '</div></div>';
  }
  function representation() {
    const r = M.facade(state.layout);
    return '<div class="lesson-layout"><div class="visual"><div class="view-options"><button type="button" data-layout="a" aria-pressed="' + (state.layout === 'a') + '">' + say('Arrangement A', 'Raspored A') + '</button><button type="button" data-layout="b" aria-pressed="' + (state.layout === 'b') + '">' + say('Arrangement B', 'Raspored B') + '</button></div>' + grid(state.layout) + '<div class="legend"><span class="glass-key">' + say('Glass panel', 'Stakleni panel') + '</span><span>' + say('Solid panel', 'Puni panel') + '</span></div><p class="caption">' + say('Six square panels, each 600 × 600 mm. Two rows, three columns. No gaps or frames.', 'Šest kvadratnih panela, svaki 600 × 600 mm. Dva reda, tri kolone. Bez zazora i okvira.') + '</p>' + (state.reveals.representation ? '<dl class="metrics">' + metric(say('Glass', 'Staklo'), '2 <small>· 0' + say('.', ',') + '72 m²</small>') + metric(say('Solid', 'Puno'), '4 <small>· 1' + say('.', ',') + '44 m²</small>') + '</dl>' : '') + '</div><div class="work"><h3>' + say('A total can lose a location.', 'Zbir može da izgubi položaj.') + '</h3><p>' + say('Switch between A and B. Imagine sending a colleague only the number of panels of each type and their dimensions.', 'Promeni raspored A u B. Zamisli da kolegi šalješ samo broj panela svake vrste i njihove dimenzije.') + '</p>' + prediction('Could your colleague reconstruct this exact facade from those totals?', 'Može li kolega iz tih zbirova vratiti baš ovu fasadu?') + (state.reveals.representation ? answer(say('Same quantities. Different arrangement.', 'Iste količine. Drugačiji raspored.'), '<p>' + say('Both arrangements total 2.16 m². The quantity list cannot tell you where each panel belongs.', 'Oba rasporeda ukupno imaju 2,16 m². Spisak količina ne govori gde koji panel pripada.') + '</p><p>' + (r.glassShareEdge ? say('Here the glass panels share an edge. Switch to B: this relationship disappears, but the totals stay the same.', 'Ovde stakleni paneli dele ivicu. Pređi na B: taj odnos nestaje, ali zbirovi ostaju isti.') : say('Here the glass panels do not share an edge. Switch to A: this relationship changes, but the totals stay the same.', 'Ovde stakleni paneli ne dele ivicu. Pređi na A: taj odnos se menja, ali zbirovi ostaju isti.')) + '</p><p>' + say('A type for each named cell would restore the layout. A correct total answers one question, not every question.', 'Vrsta za svaku imenovanu ćeliju vratila bi raspored. Tačan zbir odgovara na jedno pitanje, ne na svako.') + '</p>') : '') + paper('Draw two facades with equal quantities. Circle one relationship that changed.', 'Nacrtaj dve fasade sa istim količinama. Zaokruži jedan odnos koji se promenio.') + '</div></div>';
  }
  function relations() {
    const cells = M.facade('a').cells;
    const order = state.order === 'natural' ? M.ids : state.order === 'mixed' ? ['F', 'A', 'D', 'C', 'B', 'E'] : [...M.ids].reverse();
    const near = state.selectedId ? M.neighbors(cells, state.selectedId) : [];
    return '<div class="lesson-layout"><div class="visual">' + grid('a', true) + '<p class="caption">' + say('Tap a panel. Labels show row / column, counted from 1 at the top left. Neighbours share an edge; corners do not count.', 'Izaberi panel. Oznake daju red / kolonu, od 1 u gornjem levom uglu. Susedi dele ivicu; uglovi se ne računaju.') + '</p><div class="table-wrap"><table><caption>' + say('The same IDs and positions', 'Isti ID-jevi i položaji') + '</caption><thead><tr><th>ID</th><th>' + say('Row', 'Red') + '</th><th>' + say('Column', 'Kolona') + '</th></tr></thead><tbody>' + order.map(id => { const c = cells.find(v => v.id === id); return '<tr class="' + (id === state.selectedId ? 'selected' : '') + '"><td>' + c.id + '</td><td>' + c.row + '</td><td>' + c.col + '</td></tr>'; }).join('') + '</tbody></table></div><div class="action-row">' + action('shuffle', 'Reorder the table', 'Promeni redosled tabele') + '</div></div><div class="work"><h3>' + say('A neighbour is a relationship.', 'Susedstvo je odnos.') + '</h3><p>' + say('Choose a panel, then predict its neighbours. Now reorder the table without changing any coordinates.', 'Izaberi panel, pa predvidi njegove susede. Zatim promeni redosled tabele bez promene koordinata.') + '</p>' + prediction('Which IDs share an edge with the selected panel?', 'Koji ID-jevi dele ivicu sa izabranim panelom?', !state.selectedId) + (!state.selectedId ? '<p class="minor">' + say('Select a panel before comparing.', 'Izaberi panel pre poređenja.') + '</p>' : '') + (state.reveals.relations && state.selectedId ? answer(state.selectedId + ' → ' + near.join(', '), '<p>' + say('Same row and a column difference of one, or same column and a row difference of one. Use the absolute difference: left and above count too.', 'Isti red i razlika kolona jedan, ili ista kolona i razlika redova jedan. Koristi apsolutnu razliku: levo i gore se takođe računaju.') + '</p><p>' + say('The table order changed; this set of neighbours did not. Reading the next row would answer a different question.', 'Redosled tabele se promenio; skup suseda nije. Čitanje sledećeg reda odgovorilo bi na drugo pitanje.') + '</p>') : '') + paper('Write the six rows on slips. Shuffle them. Find the same neighbour IDs again.', 'Zapiši šest redova na papiriće. Promešaj ih. Ponovo pronađi iste ID-jeve suseda.') + '</div></div>';
  }
  function rowDiagram(p, reveal) {
    const r = M.row(p), scale = 450 / r.span_mm, left = 25, top = 35, height = 125;
    return '<svg class="rule-svg" viewBox="0 0 500 245" role="img" aria-label="' + say('Panel row. Positions and dimensions are listed below.', 'Red panela. Položaji i mere su navedeni ispod.') + '">' + r.positions_mm.map((x, i) => '<rect x="' + (left + x * scale) + '" y="' + top + '" width="' + (p.width_mm * scale) + '" height="' + height + '" fill="#e4eafb" stroke="#2148bc"/><text x="' + (left + (x + p.width_mm / 2) * scale) + '" y="100" text-anchor="middle">P' + (i + 1) + '</text>').join('') + '<path d="M25 185v12H475v-12" fill="none" stroke="#1d292d"/><text x="250" y="225" text-anchor="middle">' + (reveal ? fmt(r.span_mm) + ' mm' : '? mm') + '</text></svg>';
  }
  function rule() {
    const p = state.parameters, r = M.row(p);
    return '<div class="lesson-layout"><div class="visual"><p class="eyebrow">' + say('PARTS + INTERIOR GAPS', 'DELOVI + UNUTRAŠNJI RAZMACI') + '</p>' + rowDiagram(p, state.reveals.rule) + '<p class="caption">' + say('Rectangular panels, each 1,200 mm high. Gaps occur only between panels; no outer gap is added. Schematic, not to vertical scale.', 'Pravougaoni paneli visoki po 1.200 mm. Razmaci su samo između panela; nema spoljnog razmaka. Šema nije u vertikalnoj razmeri.') + '</p><div class="number-fields">' + [['n', 'Panels / n', 'Paneli / n', 1, 6], ['width_mm', 'Width / mm', 'Širina / mm', 200, 1200], ['gap_mm', 'Gap / mm', 'Razmak / mm', 0, 100]].map(([key, en, sr, min, max]) => '<label for="param-' + key + '">' + say(en, sr) + '<input id="param-' + key + '" data-parameter="' + key + '" type="number" min="' + min + '" max="' + max + '" step="1" inputmode="numeric" value="' + p[key] + '"><small>' + min + '–' + max + '</small></label>').join('') + '</div><p id="parameter-error" class="form-error" role="alert"></p><div class="action-row">' + action('one-panel', 'Try one panel', 'Probaj jedan panel') + action('three-panels', 'Restore the three-panel case', 'Vrati primer sa tri panela') + '</div></div><div class="work"><h3>' + say('Count the gaps before writing the rule.', 'Pre pravila prebroj razmake.') + '</h3><p>' + say('The overall width includes the panels and only the gaps between them. Predict the span, then test the smallest non-empty case.', 'Ukupna širina obuhvata panele i samo razmake između njih. Predvidi širinu, pa proveri najmanji neprazan slučaj.') + '</p>' + prediction('How wide is this row? How many gaps did you count?', 'Koliko je širok ovaj red? Koliko razmaka si izbrojao?') + (state.reveals.rule ? answer(say('A boundary is part of a rule.', 'Granica je deo pravila.'), '<p class="formula">n × w + (n − 1) × gap<br>' + p.n + ' × ' + p.width_mm + ' + ' + r.joints + ' × ' + p.gap_mm + ' = ' + fmt(r.span_mm) + ' mm</p><p>' + say('Left-edge positions: ', 'Položaji levih ivica: ') + r.positions_mm.map(fmt).join('; ') + ' mm.</p><p>' + (p.n === 1 ? say('One panel has zero interior gaps. A rule using n gaps adds a gap that is not in the brief.', 'Jedan panel ima nula unutrašnjih razmaka. Pravilo sa n razmaka dodaje razmak koji zadatak nije zadao.') : say('There is one fewer gap than panels. Try n = 1: the edge case makes the difference visible.', 'Razmaka ima za jedan manje nego panela. Probaj n = 1: rubni slučaj čini razliku vidljivom.')) + (p.gap_mm === 0 ? ' ' + say('With a zero gap, both formulas give the same number. This single test cannot distinguish the rules.', 'Sa razmakom nula obe formule daju isti broj. Ova provera ne može razlikovati pravila.') : '') + '</p><div class="action-row">' + action('rule-to-code', 'Use these inputs in the code →', 'Prenesi ove ulaze u kod →', true) + '</div>') : '') + paper('Draw the row and mark every gap. Test n = 1 before testing a large row.', 'Nacrtaj red i označi svaki razmak. Proveri n = 1 pre velikog reda.') + '</div></div>';
  }
  function code() {
    return '<div class="lesson-layout code-layout"><div class="work"><label class="prompt-label" for="program">' + say('Edit the rule, then run it.', 'Izmeni pravilo, pa ga izvrši.') + '</label><textarea id="program" class="program" rows="6" maxlength="700" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="code-help">' + esc(state.code) + '</textarea><p class="code-help" id="code-help">' + say('Five let declarations, in this order: n, w, gap, joints, span. First three values: whole numbers. Then use earlier names, +, −, *, and parentheses. This small interpreter runs this supported subset; it does not run arbitrary JavaScript.', 'Pet let dodela ovim redom: n, w, gap, joints, span. Prve tri vrednosti su celi brojevi. Zatim koristi prethodna imena, +, −, * i zagrade. Mali interpreter izvršava ovaj podržani podskup; ne izvršava proizvoljan JavaScript.') + '</p><p class="minor">n: 1–6 · w: 200–1200 mm · gap: 0–100 mm</p><div class="action-row">' + action('run-code', 'Run the five lines', 'Izvrši pet redova', true) + action('extra-joint', 'Try one extra gap', 'Probaj jedan razmak više') + action('code-one', 'Change n to 1', 'Promeni n na 1') + action('code-restore', 'Restore from the Rule step', 'Vrati ulaze iz koraka Pravilo') + '</div><p id="code-error" class="form-error" role="alert"></p><div class="prediction"><label class="prompt-label" for="prediction">' + say('Before running: what value should span receive?', 'Pre izvršavanja: koju vrednost treba da dobije span?') + '</label><textarea id="prediction" rows="2" maxlength="600">' + esc(state.predictions.code) + '</textarea></div>' + paper('Cover the later lines. Keep a small table of names and current values. Explain what each assignment changes.', 'Prekrij naredne redove. Vodi malu tabelu imena i trenutnih vrednosti. Objasni šta svaka dodela menja.') + '</div><div class="visual"><p class="eyebrow">' + say('EXECUTION LEAVES A TRACE', 'IZVRŠAVANJE OSTAVLJA TRAG') + '</p><div id="execution-output"></div><p class="boundary">' + say('The whole supported program runs when you press Run. The controls inspect its recorded states; they do not pause a live program. n and joints are counts; w, gap and span are lengths in mm.', 'Ceo podržani program radi kada pritisneš Izvrši. Kontrole pregledaju zabeležena stanja; ne zaustavljaju program koji radi. n i joints su brojevi komada; w, gap i span su dužine u mm.') + '</p></div></div>';
  }
  function renderExecution() {
    if (!$('execution-output')) return;
    if (!execution) { $('execution-output').innerHTML = '<p class="caption">' + say('No execution yet. Predict an outcome, then run your five lines. An imported record must be run again.', 'Još nema izvršavanja. Predvidi ishod, pa izvrši svojih pet redova. Uvezen zapis mora ponovo da se izvrši.') + '</p>'; return; }
    const row = execution.trace[traceIndex];
    $('execution-output').innerHTML = '<div class="run-result' + (execution.matches ? '' : ' mismatch') + '"><strong>' + say('The code returned ', 'Kod je vratio ') + fmt(execution.memory.span) + ' mm.</strong><br>' + (execution.matches ? say('It matches the geometric check for these inputs. Try a changed case before generalising.', 'Poklapa se sa geometrijskom proverom ovih ulaza. Probaj izmenjen slučaj pre uopštavanja.') : say('The geometric rule gives ', 'Geometrijsko pravilo daje ') + fmt(execution.expectedSpan_mm) + ' mm. ' + say('Difference: ', 'Razlika: ') + fmt(execution.difference_mm) + ' mm. ' + say('The code executed; its result does not match this brief.', 'Kod se izvršio; rezultat ne odgovara ovom zadatku.')) + '</div><div class="trace-controls"><label for="trace-index">' + say('Inspect recorded line ', 'Pregledaj zabeleženi red ') + (traceIndex + 1) + ' / 5</label><input id="trace-index" type="range" min="0" max="4" step="1" value="' + traceIndex + '">' + action('trace-first', 'First record', 'Prvi zapis') + action('trace-next', 'Next record →', 'Sledeći zapis →', false, traceIndex === 4) + '</div><div class="code-state"><p class="minor">' + say('Values after this line', 'Vrednosti posle ovog reda') + '</p><dl>' + Object.entries(row.after).map(([name, value]) => '<div><dt>' + name + '</dt><dd>' + fmt(value) + '</dd></div>').join('') + '</dl></div><div class="table-wrap"><table class="trace-table"><caption>' + say('Recorded assignments', 'Zabeležene dodele') + '</caption><thead><tr><th>#</th><th>' + say('Executed statement', 'Izvršeni iskaz') + '</th><th>' + say('Value', 'Vrednost') + '</th></tr></thead><tbody>' + execution.trace.map((r, i) => '<tr class="' + (i === traceIndex ? 'current' : '') + '"><td>' + r.line + '</td><td><code>' + esc(r.source) + '</code></td><td>' + fmt(r.value) + '<br><small>' + (r.unit === 'mm' ? 'mm' : say('count', 'broj')) + '</small></td></tr>').join('') + '</tbody></table></div>';
  }
  function system() {
    const r = M.shared(state.sharedHeight_mm);
    return '<div class="lesson-layout"><div class="visual"><div class="group-labels"><span>' + say('Group A: P1, P2, P3', 'Grupa A: P1, P2, P3') + '</span><span>' + say('Group B: P3, P4, P5', 'Grupa B: P3, P4, P5') + '</span></div><div class="shared-map">' + r.uniqueIds.map(id => '<span class="' + (id === 'P3' ? 'shared' : '') + '">' + id + '</span>').join('') + '</div><p class="caption">' + say('P3 is one physical panel shared by two groups. These are membership groups, not a construction sequence.', 'P3 je jedan fizički panel u dve grupe. Ovo su grupe pripadnosti, ne redosled građenja.') + '</p><label class="prompt-label" for="shared-height">' + say('Height of the shared panel P3', 'Visina zajedničkog panela P3') + '</label><select id="shared-height"><option value="1200"' + (state.sharedHeight_mm === 1200 ? ' selected' : '') + '>1,200 mm</option><option value="1500"' + (state.sharedHeight_mm === 1500 ? ' selected' : '') + '>1,500 mm</option></select><p class="minor">' + say('All panels are 600 mm wide. Other heights stay 1,200 mm. Count each material panel once, not finishes on both sides.', 'Svi paneli su široki 600 mm. Ostale visine ostaju 1.200 mm. Brojimo materijalni panel jednom, ne obloge obe strane.') + '</p>' + (state.reveals.system ? '<dl class="metrics">' + metric(say('Group A', 'Grupa A'), fmt(r.groupA_m2) + ' <small>m²</small>') + metric(say('Group B', 'Grupa B'), fmt(r.groupB_m2) + ' <small>m²</small>') + metric(say('Adding both totals', 'Sabiranje oba zbira'), fmt(r.sum_m2) + ' <small>m²</small>') + metric(say('Five unique panels', 'Pet jedinstvenih panela'), fmt(r.unique_m2) + ' <small>m²</small>', 'result') + '</dl>' : '') + '</div><div class="work"><h3>' + say('A correct part can make an incorrect total.', 'Tačan deo može dati pogrešan zbir.') + '</h3><p>' + say('Both teams counted their own panels correctly. Before adding their results, ask what they share.', 'Obe ekipe su tačno prebrojale svoje panele. Pre sabiranja rezultata pitaj šta im je zajedničko.') + '</p>' + prediction('Which totals change when P3 changes? How do you avoid counting it twice?', 'Koji zbirovi se menjaju sa P3? Kako izbegavaš da ga brojiš dvaput?') + (state.reveals.system ? answer(say('Keep the identity through the calculation.', 'Sačuvaj identitet kroz račun.'), '<p>' + say('Both groups include P3. Adding their totals counts its ', 'Obe grupe uključuju P3. Sabiranje njihovih zbirova broji njegovih ') + fmt(r.sharedArea_m2) + say(' m² twice. Count the union of IDs instead: P1–P5.', ' m² dvaput. Prebroj objedinjene ID-jeve: P1–P5.') + '</p><p>' + say('Changing P3 affects both local totals but the unique total once. A single change can follow more than one dependency.', 'Promena P3 utiče na oba lokalna zbira, ali na jedinstven zbir jednom. Jedna promena može pratiti više zavisnosti.') + '</p><p>' + say('This static example checks identity and membership. It does not simulate construction or collective behaviour.', 'Ovaj statički primer proverava identitet i pripadnost. Ne simulira građenje ili kolektivno ponašanje.') + '</p>') : '') + paper('Make five ID cards. Let two groups point to the same P3 card. Change that card and follow both connections.', 'Napravi pet ID kartica. Neka dve grupe pokazuju na istu karticu P3. Promeni tu karticu i prati obe veze.') + '</div></div>';
  }
  const renderers = { context, representation, relations, rule, code, system };
  function render(focus = false) {
    document.documentElement.lang = lang === 'sr' ? 'sr-Latn' : 'en';
    document.title = say('From a number to a system · Computing Studio', 'Od broja do sistema · Computing Studio');
    document.querySelectorAll('[data-en]').forEach(el => { el.textContent = el.dataset[lang]; });
    $('language').textContent = lang === 'en' ? 'SR' : 'EN'; $('language').setAttribute('aria-label', lang === 'en' ? 'Prikaži na srpskom' : 'Show in English');
    $('journey').setAttribute('aria-label', say('Learning steps', 'Koraci učenja'));
    const index = M.steps.indexOf(state.step);
    $('journey').innerHTML = M.steps.map((step, i) => '<a href="#' + step + '"' + (step === state.step ? ' aria-current="step"' : '') + '><small>0' + (i + 1) + '</small><span>' + stepNames()[i] + '</span></a>').join('');
    const titles = say(['What does 600 tell you?', 'Same totals. Another facade.', 'A neighbour is not the next row.', 'Three panels. How many gaps?', 'Read, change, execute.', 'Two groups. One shared panel.'], ['Šta ti govori 600?', 'Isti zbirovi. Druga fasada.', 'Sused nije sledeći red.', 'Tri panela. Koliko razmaka?', 'Pročitaj, promeni, izvrši.', 'Dve grupe. Jedan zajednički panel.']);
    const leads = say(['A number needs a name, a unit and a context before it can answer a useful question.', 'A representation keeps some features and may leave others behind. Find out which.', 'Stable IDs connect a drawing to its data. Table order and spatial order are different things.', 'Turn an explicit geometric brief into a rule you can test by hand.', 'A program makes instructions executable. Running successfully and modelling correctly are separate checks.', 'Before combining local results, check the identities and links that connect them.'], ['Broju trebaju ime, jedinica i kontekst da bi odgovorio na korisno pitanje.', 'Predstava čuva neke osobine, a druge može da izgubi. Otkrij koje.', 'Stabilni ID-jevi povezuju crtež i podatke. Redosled tabele i prostorni redosled nisu isto.', 'Pretvori jasan geometrijski zadatak u pravilo koje možeš proveriti rukom.', 'Program omogućava izvršavanje uputstava. Uspešno izvršavanje i tačan model su odvojene provere.', 'Pre spajanja lokalnih rezultata proveri identitete i veze koje ih povezuju.']);
    $('step-number').textContent = '0' + (index + 1) + ' / 06 · ' + stepNames()[index].toUpperCase();
    $('lesson-title').textContent = titles[index]; $('lesson-lead').textContent = leads[index];
    if (state.step === 'representation') $('lesson-lead').textContent = say('For this example, use six square panels. ', 'Za ovaj primer uzmi šest kvadratnih panela. ') + leads[index];
    if (state.step === 'rule') $('lesson-lead').textContent = say('Now use a new case: rectangular panels in one row, starting with three. ', 'Sada uzmi novi primer: pravougaone panele u jednom redu, za početak tri. ') + leads[index];
    $('lesson-body').innerHTML = renderers[state.step](); renderExecution();
    if ($('shared-height')) [...$('shared-height').options].forEach(option => { option.textContent = fmt(Number(option.value)) + ' mm'; });
    $('reflection').value = state.note;
    $('previous').disabled = index === 0; $('next').disabled = index === 5;
    $('step-position').textContent = say('Step ', 'Korak ') + (index + 1) + ' / 6';
    $('storage-status').textContent = storageAvailable ? say('Local notebook · no submission', 'Lokalna beležnica · bez predaje') : say('Use JSON to keep your work.', 'Koristi JSON da sačuvaš rad.');
    if (pendingImport) showImportReview();
    if (focus) $('lesson-title').focus({ preventScroll: false });
  }
  function go(step) { if (!M.steps.includes(step)) return; state.step = step; history.replaceState(null, '', '#' + step); render(true); persist(); }
  function changed(id) { render(); if (id && $(id)) $(id).focus({ preventScroll: true }); persist(); }
  function clearExecution() { execution = null; state.codeHasRun = false; traceIndex = 0; renderExecution(); }
  function codeError(error) {
    const descriptions = {
      'code-lines': say('Use exactly five lines, one declaration on each.', 'Koristi tačno pet redova, po jednu dodelu u svakom.'),
      'code-order': say('Keep let n, let w, let gap, let joints and let span in this order, with a semicolon after each line.', 'Zadrži redom let n, let w, let gap, let joints i let span, sa tačkom-zarezom na kraju reda.'),
      'code-input': say('The first three inputs must be whole-number literals.', 'Prva tri ulaza moraju biti zapisani celi brojevi.'),
      'code-unit': say('Check the units: add lengths to lengths and counts to counts. span must be a length; joints must be a count.', 'Proveri jedinice: sabiraj dužine sa dužinama, a brojeve sa brojevima. span mora biti dužina, joints broj.'),
      'code-name': say('Use only names that an earlier line has already assigned.', 'Koristi samo imena kojima je prethodni red već dodelio vrednost.'),
      'range': say('An input or result is outside this small model’s supported range.', 'Ulaz ili rezultat je van podržanog opsega ovog malog modela.')
    };
    return descriptions[error.message] || say('Use numbers, earlier names, +, -, *, and balanced parentheses. Calls, loops and other JavaScript are outside this interpreter.', 'Koristi brojeve, prethodna imena, +, -, * i uparene zagrade. Pozivi, petlje i drugi JavaScript su van ovog interpretera.');
  }
  $('lesson-body').addEventListener('input', event => {
    if (event.target.id === 'prediction') { state.predictions[state.step] = event.target.value; persist(); }
    if (event.target.id === 'program') { state.code = event.target.value; clearExecution(); $('code-error').textContent = ''; persist(); }
    if (event.target.id === 'trace-index' && execution) { traceIndex = Number(event.target.value); renderExecution(); $('trace-index').focus({ preventScroll: true }); }
  });
  $('lesson-body').addEventListener('change', event => {
    const el = event.target;
    if (el.dataset.parameter) {
      const next = { ...state.parameters, [el.dataset.parameter]: el.valueAsNumber };
      try { M.parameters(next); state.parameters = next; state.reveals.rule = false; changed(el.id); announce(say('Inputs changed. Recheck your prediction.', 'Ulazi su promenjeni. Proveri predviđanje.')); }
      catch { el.value = state.parameters[el.dataset.parameter]; $('parameter-error').textContent = say('Use whole numbers in the shown ranges. The field and model have been restored to the last valid input.', 'Koristi cele brojeve u prikazanim opsezima. Polje i model su vraćeni na poslednji ispravan ulaz.'); }
    }
    if (el.id === 'shared-height') { state.sharedHeight_mm = Number(el.value); state.reveals.system = false; changed(el.id); }
  });
  $('lesson-body').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.layout) { state.layout = button.dataset.layout; changed(); document.querySelector('[data-layout="' + state.layout + '"]').focus({ preventScroll: true }); return; }
    if (button.dataset.panel) { state.selectedId = button.dataset.panel; state.reveals.relations = false; changed(); document.querySelector('[data-panel="' + state.selectedId + '"]').focus({ preventScroll: true }); return; }
    switch (button.id) {
      case 'reveal': state.reveals[state.step] = true; if (state.step === 'context') state.contextShown = true; changed('reveal'); announce(say('Model explanation is now shown.', 'Objašnjenje modela je sada prikazano.')); break;
      case 'unit-change': state.contextUnit = state.contextUnit === 'mm' ? 'm' : 'mm'; changed('unit-change'); break;
      case 'shuffle': state.order = state.order === 'natural' ? 'mixed' : state.order === 'mixed' ? 'reverse' : 'natural'; changed('shuffle'); announce(say('Rows reordered; positions are unchanged.', 'Redovi su preuređeni; položaji su nepromenjeni.')); break;
      case 'one-panel': state.parameters.n = 1; state.reveals.rule = false; changed('one-panel'); break;
      case 'three-panels': state.parameters = { n: 3, width_mm: 600, gap_mm: 20 }; state.reveals.rule = false; changed('three-panels'); break;
      case 'rule-to-code': state.code = M.program(state.parameters); clearExecution(); go('code'); break;
      case 'run-code':
        clearExecution(); $('code-error').textContent = '';
        try { execution = M.execute(state.code); state.codeHasRun = true; renderExecution(); announce(say('Five lines executed. Read the result and inspect the recorded states.', 'Pet redova je izvršeno. Pročitaj rezultat i pregledaj zabeležena stanja.')); }
        catch (error) { $('code-error').textContent = codeError(error); }
        persist(); break;
      case 'extra-joint': state.code = M.program(state.parameters).replace('let joints = n - 1;', 'let joints = n;'); clearExecution(); changed('program'); break;
      case 'code-one':
        if (/^\s*let\s+n\s*=\s*\d+;/.test(state.code)) { state.code = state.code.replace(/^(\s*let\s+n\s*=\s*)\d+;/, (_, prefix) => prefix + '1;'); clearExecution(); changed('program'); }
        else $('code-error').textContent = say('Restore the first line before changing n.', 'Vrati prvi red pre promene n.');
        break;
      case 'code-restore': state.code = M.program(state.parameters); clearExecution(); changed('program'); break;
      case 'trace-first': traceIndex = 0; renderExecution(); $('trace-first').focus({ preventScroll: true }); break;
      case 'trace-next': if (execution) traceIndex = Math.min(4, traceIndex + 1); renderExecution(); $('trace-next').focus({ preventScroll: true }); break;
    }
  });
  $('previous').addEventListener('click', () => go(M.steps[M.steps.indexOf(state.step) - 1]));
  $('next').addEventListener('click', () => go(M.steps[M.steps.indexOf(state.step) + 1]));
  window.addEventListener('hashchange', () => { const step = location.hash.slice(1); if (M.steps.includes(step)) { state.step = step; render(true); persist(); } });
  $('language').addEventListener('click', () => { lang = lang === 'en' ? 'sr' : 'en'; try { localStorage.setItem(LANG_KEY, JSON.stringify(lang)); } catch {} render(); persist(); });
  window.addEventListener('storage', event => { if (event.key === LANG_KEY) { try { lang = JSON.parse(event.newValue) === 'sr' ? 'sr' : 'en'; render(); } catch {} } });
  $('reflection').addEventListener('input', event => { state.note = event.target.value; persist(); });
  $('print').addEventListener('click', () => window.print());
  $('download').addEventListener('click', () => {
    try { const blob = new Blob([JSON.stringify(M.record(state, lang), null, 2) + '\n'], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'computing-studio-notebook-v1.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); $('file-status').textContent = say('JSON prepared for local download. Open it here to verify that your saved work returns.', 'JSON je pripremljen za lokalno preuzimanje. Otvori ga ovde da proveriš da se rad vraća.'); }
    catch { $('file-status').textContent = say('The file could not be prepared. Your notebook is still here.', 'Fajl nije pripremljen. Beležnica je i dalje ovde.'); }
  });
  function showImportReview() {
    $('import-review').hidden = !pendingImport;
    if (!pendingImport) return;
    $('import-description').textContent = say('Checked local notebook: ', 'Proverena lokalna beležnica: ') + stepNames()[M.steps.indexOf(pendingImport.state.step)] + '. ' + say('The file has not changed your current work. Applying it replaces this notebook; code must be run again.', 'Fajl još nije promenio trenutni rad. Primena zamenjuje ovu beležnicu; kod mora ponovo da se izvrši.');
  }
  $('import-file').addEventListener('change', async event => {
    const request = ++importSequence;
    pendingImport = null; showImportReview();
    const file = event.target.files && event.target.files[0]; if (!file) return;
    try {
      if (file.size > M.maxBytes) throw new Error('size');
      const source = await file.text();
      if (request !== importSequence) return;
      pendingImport = M.parseRecord(source); showImportReview();
      $('file-status').textContent = say('File validated. Review before replacing your work.', 'Fajl je proveren. Pregledaj pre zamene rada.'); $('apply-import').focus();
    } catch { if (request === importSequence) $('file-status').textContent = say('This is not a supported notebook, or it exceeds 32 KiB. Current work was not changed.', 'Ovo nije podržana beležnica ili je veća od 32 KiB. Trenutni rad nije promenjen.'); }
    if (request === importSequence) event.target.value = '';
  });
  $('apply-import').addEventListener('click', () => {
    if (!pendingImport) return;
    state = pendingImport.state; lang = pendingImport.language; pendingImport = null; clearExecution();
    try { localStorage.setItem(LANG_KEY, JSON.stringify(lang)); } catch {}
    $('import-review').hidden = true; go(state.step);
    $('file-status').textContent = say('Notebook opened. Recomputed models use its inputs; imported code has not been executed.', 'Beležnica je otvorena. Modeli su ponovo izračunati iz ulaza; uvezeni kod nije izvršen.');
  });
  $('cancel-import').addEventListener('click', () => { pendingImport = null; showImportReview(); $('import-file').focus(); });
  $('reset').addEventListener('click', () => { $('reset-review').hidden = false; $('confirm-reset').focus(); });
  $('cancel-reset').addEventListener('click', () => { $('reset-review').hidden = true; $('reset').focus(); });
  $('confirm-reset').addEventListener('click', () => { importSequence++; state = M.initial(); pendingImport = null; clearExecution(); $('reset-review').hidden = true; $('import-review').hidden = true; $('file-status').textContent = ''; go('context'); });
  render();
  if (recovered) announce(say('Your local notebook was reopened. Run the code again to inspect execution.', 'Lokalna beležnica je ponovo otvorena. Ponovo izvrši kod da pregledaš izvršavanje.'));
})();
