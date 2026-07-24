# A-010 — RecreationEngineer

**Propósito**: reconstruir a experiência em código limpo, editável, organizado e reutilizável.

**Status no MVP**: agente **não executado** (PH-004). Este arquivo define o protocolo para
quando a recriação for acionada — pelas condições abaixo ou por pedido do usuário.

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

Tudo que sai da recriação é `reconstructed` ou `approximated` — **nunca** apresentado como
código original recuperado. Nível alvo: **LR RecreatedAndValidated**.

## Critérios de aceite (quando ativo)

- [ ] Projeto inicia com `npm ci && npm run dev`.
- [ ] Conteúdo editável sem tocar na lógica (content/ e config/).
- [ ] RECONSTRUCTION-MAP.md liga cada componente à sua evidência.
- [ ] Validação desktop/mobile + reduced-motion passa no Playwright.
