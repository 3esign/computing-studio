/* Izvoz mora dati iste bajtove za isti ulaz.

   docs/tests/atlas.test.cjs ponovo pokrece tools/atlas-build.cjs da dokaze da
   je izvoz nepromenjiv, i proverava atlas.json — ali isti lanac pise i
   docs/svet/data/poreklo.json, cijи je builtAt bio `new Date()`. Zato je svako
   pokretanje testova prljalo radno stablo i obaralo komitovani
   docs/offline-manifest.json, koji meri bajtove na disku: `npm`-ovski zelen
   paket je ostavljao fajl koji vise ne odgovara manifestu.

   Ovde se meri posledica, ne implementacija: dva uzastopna izvoza daju
   identicne bajtove. Ako neko ubaci novi pecat sa satnicom, ovaj test pada. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');

const IZVOZI = [
  ['tools/poreklo-build.cjs', 'docs/svet/data/poreklo.json'],
  ['tools/atlas-build.cjs', 'docs/svet/data/atlas.json']
];

for (const [alat, fajl] of IZVOZI) {
  test(`${alat} daje iste bajtove na dva uzastopna poziva`, () => {
    const put = path.join(root, fajl);
    cp.execFileSync(process.execPath, [alat], { cwd: root, stdio: 'ignore' });
    const prvi = fs.readFileSync(put);
    cp.execFileSync(process.execPath, [alat], { cwd: root, stdio: 'ignore' });
    const drugi = fs.readFileSync(put);
    if (!prvi.equals(drugi)) {
      /* Reci sta se tacno razlikuje — obicno je to pecat sa satnicom. */
      const a = JSON.parse(prvi.toString()), b = JSON.parse(drugi.toString());
      const razlike = [...new Set([...Object.keys(a), ...Object.keys(b)])]
        .filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
      assert.fail(`${fajl} se menja bez promene ulaza; razlicita polja: ${razlike.join(', ') || '(ugnjezdeno)'}`);
    }
  });
}

test('pokretanje izvoza ne ostavlja neispracene izmene u docs/', () => {
  /* Poenta nije sam git nego to da komitovani offline manifest ostaje tacan:
     manifest meri bajtove na disku, pa izvoz koji se sam menja pravi zelen
     paket uz fajl koji manifestu vise ne odgovara. */
  let status;
  try {
    status = cp.execFileSync('git', ['status', '--porcelain', '--', 'docs'], { cwd: root }).toString();
  } catch {
    return; /* bez gita nema sta da se meri */
  }
  /* Samo izmenjeni praceni fajlovi: nov nekomitovan fajl u docs/ je normalan
     rad u toku i nije predmet ovog merenja. Manifest se izuzima jer se gradi
     posle izvoza. */
  const prljavo = status.split('\n').filter(s => /^[ ]?[MARCD]/.test(s))
    .map(s => s.trim())
    .filter(s => !s.includes('offline-manifest.json'));
  assert.deepEqual(prljavo, [],
    'izvoz je ostavio izmene u docs/:\n' + prljavo.join('\n'));
});
