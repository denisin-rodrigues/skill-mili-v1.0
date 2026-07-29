# A-010 — RecreationEngineer

**Propósito**: reconstruir a experiência em código limpo, editável, organizado e reutilizável.

**Status**: fatias executáveis da PH-004. O comando `scripts/recreate.js` materializa Header,
Hero, seção institucional e, quando declarada, uma galeria de projetos a partir de um plano
explícito; `scripts/update-recreation-content.js` atualiza conteúdo/tema/estado de uma Recreation
já existente quando o plano evolui (ex.: cases adicionados depois), sem tocar no scaffold.
Projetos que declarem `image`, `imageAlt` e `detail` juntos ganham uma rota de case dedicada
(`/work/<slug>`); `scripts/validate-recreation.js` valida desktop, mobile, movimento reduzido,
todos os projetos declarados e cada rota de case. WebGL e editor visual permanecem fora destas
fatias e devem constar em `recreation-state.json`.

## Condições de ativação (M-002 / CP-004)

- O runtime local não inicia de forma confiável (classificação L0/L1 após captura).
- Bundles dependem fortemente de APIs externas ou protegidas.
- O usuário solicita projeto fácil de modificar.
- Arquitetura implantada inadequada para reutilização.
- Static Mirror abaixo do nível mínimo definido no capture-plan.

## Stack padrão

TypeScript, React, Vite, CSS moderno, GSAP (quando necessário), Three.js (quando necessário),
Playwright para validação.

## Regras

1. Reconstruir **seção por seção**; validar cada seção antes de avançar.
2. **Separar conteúdo, layout e animação** (CP-007):
   - `recreation/src/content/` — site-content.ts, navigation.ts, products.ts
   - `recreation/src/config/` — brand.ts, theme.ts, motion.ts, media.ts, scene.ts
3. Não copiar chamadas privadas; integrações externas viram **mocks documentados**.
4. Marcar componentes recriados e registrar a evidência utilizada
   (`recreation/RECONSTRUCTION-MAP.md`).
5. Desktop + mobile; `prefers-reduced-motion` implementado.
6. Animações em `src/animations/{presets,timelines,scroll,transitions,tokens}` — cada uma com
   nome, trigger, duração, easing, dependências, override mobile e fallback reduced-motion.
7. Componentes recomendados: Navbar, Hero, AnimatedText, FeatureCard, HorizontalScroll,
   StickySection, VideoSection, AudioSection, ThreeScene, ProductShowcase, Testimonials,
   CTA, Footer, PageTransition, Preloader.

## Insumos obrigatórios

- `experience-blueprint/` (sections, design-tokens, animations quando houver)
- `capture/screenshots/` e snapshots DOM
- Assets autorizados de `mirror/assets/` (modo Hybrid: reusar mídia/modelos capturados)

## Classificação

Componentes da recriação são `reconstructed` ou `approximated` — **nunca** apresentados como
código original recuperado. Assets autorizados reutilizados em modo Hybrid mantêm a classificação
`captured`, com SHA-256 e origem no mapa. Nível alvo: **LR RecreatedAndValidated** para o escopo
de seções declarado; `completeSite: false` enquanto houver itens em `notImplemented`.

## Comandos da fatia ativa

```bash
node scripts/recreate.js --config <mirror.config.yaml> --plan <recreation-plan.json>
cd recreation && npm ci && npm run build
node scripts/validate-recreation.js --config <mirror.config.yaml>
```

O gerador recusa planos fora da raiz autorizada, assets com path traversal e qualquer tentativa
de sobrescrever uma pasta de Recreation que já contenha arquivos.

Quando o plano evolui depois da primeira geração (ex.: mídia de cases adquirida via
`scripts/acquire-recreation-media.js` e adicionada ao plano), atualize sem regerar o scaffold:

```bash
node scripts/update-recreation-content.js --config <mirror.config.yaml> --plan <recreation-plan.json>
cd recreation && npm run build
node scripts/validate-recreation.js --config <mirror.config.yaml>
node scripts/compare-recreation-visual.js --config <mirror.config.yaml>
```

`compare-recreation-visual.js` produz um sinal aproximado de similaridade estrutural entre os
screenshots do mirror original (`capture/screenshots/`) e da Recreation (`recreation/validation/`).
É evidência suplementar (CP-001 EvidenceOverAppearance): não é gate de LR/LP e sinaliza
explicitamente quando o screenshot original está achatado (ex.: preloader de uma captura L0),
caso em que o score não deve ser lido como qualidade da Recreation.

## Critérios de aceite (quando ativo)

- [ ] Projeto inicia com `npm ci && npm run dev`.
- [ ] Conteúdo editável sem tocar na lógica (content/ e config/).
- [ ] RECONSTRUCTION-MAP.md liga cada componente à sua evidência.
- [ ] Validação desktop/mobile + reduced-motion passa no Playwright.
