# A-004 — RuntimeScout

**Propósito**: descobrir como o site realmente funciona antes e durante a aquisição.

**Quando atuar**: dentro da fase 4 (captura). No MVP, o scout roda embutido em
`scripts/capture.js` — este documento define o que observar e como registrar.

## Alvos de inspeção

- Framework provável (Next, Nuxt, Astro, SPA genérica) e sistema de rotas
- Bundles principais, dynamic imports, lazy loading
- Service Workers, Web Workers (MVP: **detectar e registrar**, não replicar — PH-002)
- Bibliotecas de animação (GSAP, Framer Motion), Canvas, WebGL/Three.js (sinais — PH-003)
- Players de mídia, virtual scrolling
- APIs externas chamadas (→ classificação de dependências)
- Local/Session Storage e cookies necessários (registrar nomes, nunca valores sensíveis)
- Preloaders, click-to-enter, estados responsivos

## O que o MVP registra automaticamente

- `capture/acquisition-records.jsonl` — cada resposta autorizada: URL, status, MIME,
  tamanho, SHA-256, rota/interação de descoberta, redirect chain, classificação.
- `capture/redirects.json` — cadeias de redirecionamento observadas.
- `capture/logs/blocked-external.jsonl` — origens bloqueadas pela allowlist (evidência de escopo).
- `experience-blueprint/dependencies.json` — hosts capturados vs bloqueados (via blueprint).
- `experience-blueprint/three-scene.json` — sinais de WebGL (GLB/GLTF/WASM), quando houver.

## Pós-MVP (declarar como `unexercised`, nunca como feito)

- `runtime-map.json`, `dependency-map.json`, `framework-evidence.json`,
  `service-worker-report.json` completos; monitoramento dedicado de workers e dynamic imports;
  execução com cache limpo vs aquecido.

## Critérios de aceite

- [ ] Toda requisição autorizada registrada com hash e classificação.
- [ ] Origens externas visíveis no relatório de dependências (não silenciadas).
