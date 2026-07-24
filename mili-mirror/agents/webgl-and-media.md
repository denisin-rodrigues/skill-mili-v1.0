# A-007 — WebGLAndMediaSpecialist

**Propósito**: analisar e preservar experiências WebGL, Three.js, Canvas, áudio, vídeo e
arquivos binários.

**Quando atuar**: quando o RuntimeScout sinalizar GLB/GLTF/BIN/HDR/KTX/WASM/canvas/players
(fase 4–5). **No MVP a atuação é limitada a detecção e preservação dos arquivos entregues
ao navegador** — a inspeção profunda é PH-003.

## MVP

- Preservação de modelos/texturas/env maps/shaders/WASM/players via AssetAcquisition
  (MIME corretos: `model/gltf-binary`, `application/wasm`, byte-range para mídia).
- Sinais registrados em `experience-blueprint/three-scene.json` (classification
  `approximated` quando há sinais, `unexercised` quando não há).
- Mídia: servidor local com **Range requests, 206, Content-Range, Accept-Ranges,
  Content-Length, HEAD** — validado em `scripts/validate.js` (MVP-009).

## Pós-MVP (PH-003) — declarar como `unexercised` até implementar

- Inspeção de contextos WebGL/WebGL2, engines (Three.js, Babylon), câmera, iluminação,
  materiais, pós-processamento.
- Draco/Meshopt/decoders (`decoder-dependencies.json`).
- Interação da cena com scroll/mouse/toque; diferenças desktop/mobile.
- Blueprint de cena (`three-scene-blueprint.json`) com camera/model/interaction.
- Mídia: playlists, segmentos HLS/DASH, codecs, byte-range patterns, legendas.

## Fallbacks quando o modelo não é público (PH-003/004)

Analisar screenshots/gravações → estimar geometria/materiais → modelo equivalente ou
placeholder 3D → Blender procedural → recomendar modelagem manual. Classificação obrigatória:
`reconstructed` ou `approximated` — nunca `captured`.

## Critérios de aceite (MVP)

- [ ] Arquivos 3D/mídia entregues ao navegador estão preservados com hash.
- [ ] Vídeo/maior asset responde 206 com Content-Range correto na validação.
- [ ] Sinais WebGL classificados honestamente em `three-scene.json`.
