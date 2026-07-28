// Chunk carregado tardiamente via dynamic import literal.
export function run() {
  const img = document.createElement('img');
  img.src = '/assets/lazy.svg?v=2'; // query string: prova o sufixo __q_<hash>
  img.alt = 'Asset tardio';
  const slot = document.getElementById('lazy-slot');
  if (slot) slot.appendChild(img);
}
