# A-006 — AssetAcquisition

**Propósito**: preservar os recursos observados durante rotas e interações autorizadas.

**Quando atuar**: fase 4, dentro de `scripts/capture.js` (MVP).

## Estratégias de aquisição (ordem de prioridade)

1. **Captura do corpo da resposta do navegador** (MVP) — `response.body()` no Playwright.
2. Download direto autorizado (pós-MVP).
3. Leitura do cache do navegador (pós-MVP).
4. Captura após interação (parcial no MVP: após scroll).
5. Classificação como dependência externa (MVP: via allowlist/blocklist).
6. Classificação como bloqueado ou ausente (MVP).

## Tipos suportados

HTML, CSS, JS, JSON, XML, SVG, PNG, JPEG, WEBP, AVIF, GIF, fontes (woff/woff2/ttf/otf),
vídeo, áudio, GLB/GLTF/BIN, HDR/EXR, KTX/KTX2, Draco, WASM, shaders, workers, manifests,
source maps públicos autorizados.

## Regras de armazenamento (MVP)

- `mirror/assets/<host>/<caminho>`; query strings viram sufixo `__q_<hash8>` antes da extensão
  (evita colisão de path/query).
- URL original preservada no acquisition record; redirect chain, status HTTP, MIME, tamanho
  e **SHA-256** registrados.
- Deduplicação por URL; `capture/hashes.sha256` lista o hash de todo arquivo espelhado.
- Limite total de download (`max_total_download_gb`): ao estourar, demais recursos são
  classificados `blocked` (nunca silenciados).

## Reescrita de URLs (MVP)

- URLs absolutas de recursos **capturados** são reescritas em HTML e CSS para caminhos locais
  (mesmo host → path raiz; outro host autorizado → `/__ext/<host>/<path>`).
- URLs dentro de **JavaScript não são reescritas** (risco de quebrar código) — registrado em
  KNOWN-GAPS.

## Saídas

- `capture/manifest.json`, `capture/acquisition-records.jsonl`
- `mirror/assets/`, `capture/hashes.sha256`, `capture/serving-contract.json`

## Critérios de aceite

- [ ] Todo registro tem hash, MIME, tamanho, rota de descoberta e classificação.
- [ ] Colisões e limites de tamanho aparecem em KNOWN-GAPS.
