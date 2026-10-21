(function () {
  'use strict';
  var tabs = document.getElementById('tabs');
  var record = document.getElementById('record');
  var passports = [];

  function el(tag, text, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = String(text);
    return n;
  }

  function show(id) {
    var p = passports.find(function (x) { return x.id === id; }) || passports[0];
    if (!p) return;
    history.replaceState(null, '', '#' + p.id);
    record.innerHTML = '';

    var buttons = tabs.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-current', String(buttons[i].dataset.id === p.id));
    }

    record.appendChild(el('p', p.id + ' / DIGITALNI PASOŠ', 'eyebrow'));
    record.appendChild(el('h2', p.object));

    var total = 0;
    for (var s = 0; s < p.sections.length; s++) {
      var section = p.sections[s];
      var sTitle = (section.title && (section.title.sr || section.title.en)) ? (section.title.sr || section.title.en) : (section.title || section.id);
      record.appendChild(el('h3', sTitle));
      var dl = el('dl');

      for (var c = 0; c < section.claims.length; c++) {
        total++;
        var claim = section.claims[c];
        var row = el('div', undefined, 'claim');
        row.appendChild(el('dt', claim.t || 'Podatak'));

        var value = el('dd', (claim.v !== undefined) ? claim.v : (claim.text || 'Nepoznato'));
        if (Array.isArray(claim.s) && claim.s.length) {
          value.appendChild(el('small', 'Izvori: ' + claim.s.join(', ')));
        } else if (claim.source) {
          value.appendChild(el('small', 'Izvor: ' + claim.source));
        }
        row.appendChild(value);
        dl.appendChild(row);
      }
      record.appendChild(dl);
    }

    var info = el('p', total + ' kuriranih tvrdnji · ' + p.sections.length + ' oblasti', 'status');
    record.insertBefore(info, record.children[2] || null);

    if (Array.isArray(p.sources) && p.sources.length) {
      record.appendChild(el('h3', 'Izvori navedeni u podnesku'));
      var ul = el('ol', undefined, 'sources');
      for (var si = 0; si < p.sources.length; si++) {
        var src = p.sources[si];
        var li = el('li');
        li.appendChild(el('b', (src.id ? (src.id + ' · ') : '')));
        li.appendChild(document.createTextNode(src.label || src.kind || 'Izvor'));
        if (src.url && /^https?:\/\//.test(src.url)) {
          li.appendChild(document.createTextNode(' · '));
          var a = el('a', 'Otvori izvor ↗');
          a.href = src.url;
          a.rel = 'noopener noreferrer';
          a.target = '_blank';
          li.appendChild(a);
        }
        ul.appendChild(li);
      }
      record.appendChild(ul);
    }
  }

  fetch('data/pasosi.json')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      passports = data.passports || [];
      tabs.innerHTML = '';
      passports.forEach(function (p) {
        var b = el('button');
        b.type = 'button';
        b.dataset.id = p.id;
        b.appendChild(el('b', p.id));
        b.appendChild(document.createTextNode(p.object));
        b.addEventListener('click', function () {
          show(p.id);
        });
        tabs.appendChild(b);
      });
      show(location.hash.slice(1));
    })
    .catch(function () {
      record.innerHTML = '';
      record.appendChild(el('p', 'Pasoši trenutno nisu dostupni. Proveri registar timova.', 'status'));
    });

  window.addEventListener('hashchange', function () {
    show(location.hash.slice(1));
  });
})();
