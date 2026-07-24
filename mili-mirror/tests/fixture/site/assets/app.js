// Fixture behavior: lazy-loads an asset only after the user scrolls near the bottom.
// This proves the capture discovers late assets (MVP-005).
(function () {
  console.log('[fixture] app iniciado');

  var loaded = false;
  function maybeLoad() {
    var nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 200;
    if (nearBottom && !loaded) {
      loaded = true;
      var img = document.createElement('img');
      img.src = '/assets/lazy.svg?v=2'; // query string: prova o sufixo __q_<hash>
      img.alt = 'Asset tardio';
      document.getElementById('lazy-slot').appendChild(img);
      console.log('[fixture] lazy asset carregado');
    }
  }

  window.addEventListener('scroll', maybeLoad, { passive: true });
})();
