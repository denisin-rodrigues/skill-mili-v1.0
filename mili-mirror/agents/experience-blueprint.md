# A-008 — ExperienceBlueprintBuilder

**Propósito**: transformar observações, métricas e evidências em um mapa estruturado da
experiência — o contrato entre descoberta, reconstrução e validação.

**Quando atuar**: fase 5, após a captura.

```bash
node scripts/blueprint.js --config mirror.config.yaml
```

## Módulos gerados no MVP

| Arquivo | Conteúdo | Classificação típica |
|---------|----------|----------------------|
| `pages.json` | rotas, títulos, seções, dependências por página | `captured` |
| `sections.json` | mapa por tags semânticas (header/main/section/footer) | `captured` |
| `design-tokens.json` | CSS custom properties + cores/fontes heurísticas | `approximated` |
| `media.json` | imagens, vídeo, áudio, modelos preservados | `captured` |
| `dependencies.json` | hosts capturados (`approved-local`) vs bloqueados (`blocked`) | `captured` |
| `responsive-map.json` | viewports exercitados + ponteiro p/ screenshots | `captured` |
| `animations.json`, `scroll-map.json`, `components.json` | esqueleto | **`unexercised`** |
| `three-scene.json` | sinais WebGL | `approximated`/`unexercised` |

## Pós-MVP (PH-004) — análise frame a frame

- Checkpoints padrão: 0%…100% (passo 10%) para animações por tempo/scroll.
- Métricas por checkpoint: scroll position, bounding box, transform matrix, translate, scale,
  rotation, opacity, blur, clip-path, mask, computed styles, canvas/WebGL frame, recursos carregados.
- Especificação de animação completa: trigger, initial/final state, duration, easing, stagger,
  scrollStart/End, scrub, pin, mobileOverride, reducedMotionBehavior, classification.
- Component hierarchy com contentBindings — base do Editable Website Kit.

## Regra de honestidade

Módulos sem dados reais devem existir com `classification: "unexercised"` — jamais omitidos
ou preenchidos por inferência sem marcação (CP-005/CP-009).

## Critérios de aceite

- [ ] `experience-blueprint/*.json` gerado e consistente com `capture/manifest.json`.
- [ ] Tudo que não foi observado está classificado como `unexercised`.
