/* Legacy labs: English first; preserve live numeric nodes. */
(function (global) {
  'use strict';
  var language = 'en';
  var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-sr]'));
  nodes.forEach(function (node) { node._legacyEnglish = node.innerHTML; });
  var labels = Array.prototype.slice.call(document.querySelectorAll('[data-sr-label]'));
  labels.forEach(function (node) { node._legacyEnglishLabel = node.getAttribute('aria-label'); });
  var button = document.getElementById('legacy-language');
  global.LegacyLanguage = {
    text: function (english, serbian) { return language === 'sr' ? serbian : english; },
    current: function () { return language; }
  };
  if (button) button.addEventListener('click', function () {
    language = language === 'en' ? 'sr' : 'en';
    document.documentElement.lang = language === 'sr' ? 'sr-Latn' : 'en';
    nodes.forEach(function (node) { node.innerHTML = language === 'sr' ? node.getAttribute('data-sr') : node._legacyEnglish; });
    labels.forEach(function (node) { node.setAttribute('aria-label', language === 'sr' ? node.getAttribute('data-sr-label') : node._legacyEnglishLabel); });
    button.textContent = language === 'sr' ? 'English' : 'Srpski';
    button.setAttribute('aria-label', language === 'sr' ? 'Switch to English' : 'Prebaci na srpski');
    global.dispatchEvent(new Event('legacy-language-change'));
  });
  var style = document.createElement('style');
  style.textContent = '.stage{min-width:0}.top-nav{flex-wrap:wrap;align-items:center}' +
    '.legacy-controls{display:flex;flex-wrap:wrap;gap:.65rem;align-items:end;margin:1rem 0}' +
    '.legacy-controls label{display:flex;flex-direction:column;gap:.2rem}' +
    '.legacy-controls input,.legacy-controls select{font:inherit;max-width:9rem;min-height:44px;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:.35rem}' +
    '.btn{min-height:44px}input[type=range]{min-height:36px}' +
    'button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,canvas:focus-visible{outline:3px solid var(--acc);outline-offset:3px}' +
    '.legacy-note{font-size:.86rem;color:var(--ink-2)}.legacy-status{min-height:1.6em}' +
    '@media(max-width:600px){main{padding:.8rem .65rem 3rem}.app{display:flex;flex-direction:column}.app>.stage{order:-1;width:100%}.app>.panel{width:100%}.top-in{padding:.6rem}.top-nav{margin-left:0}}' +
    '@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}';
  document.head.appendChild(style);
})(window);
