// Fixture module script: cobre import estático, Worker, new URL + import.meta,
// fetch literal e dynamic import literal (acionado por scroll).
import { utilMessage } from './util.js';

console.log('[fixture] main iniciado:', utilMessage);

// Worker com string literal (resolve contra a base do documento, não do script)
const worker = new Worker('/assets/js/worker.js');
worker.onmessage = (event) => console.log('[fixture] worker disse:', event.data);

// new URL('...', import.meta.url) → /assets/img/img-icon.svg
const iconUrl = new URL('../img/img-icon.svg', import.meta.url);
const icon = document.createElement('img');
icon.src = iconUrl.href;
icon.width = 32;
document.getElementById('icon-slot').appendChild(icon);

// fetch com string literal
fetch('/api-data.json')
  .then((res) => res.json())
  .then((data) => {
    document.getElementById('api-out').textContent = `api: ${JSON.stringify(data)}`;
  })
  .catch(() => {
    document.getElementById('api-out').textContent = 'api: falhou';
  });

// Dynamic import com string literal, disparado por scroll (lazy)
let loaded = false;
function maybeLoad() {
  const nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 200;
  if (!nearBottom || loaded) return;
  loaded = true;
  import('./lazy-chunk.js').then((mod) => {
    mod.run();
    console.log('[fixture] lazy chunk carregado');
  });
}

window.addEventListener('scroll', maybeLoad, { passive: true });
