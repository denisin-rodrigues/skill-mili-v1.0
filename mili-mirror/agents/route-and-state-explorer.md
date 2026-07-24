# A-005 — RouteAndStateExplorer

**Propósito**: navegar pelas rotas autorizadas e exercitar os estados necessários para revelar
recursos e comportamentos tardios.

**Quando atuar**: fase 4, dentro de `scripts/capture.js` (MVP). 

## Interações suportadas no MVP

- **Scroll incremental** (0,8 × viewport por passo, até o fim, com espera por `networkidle`)
  — revela lazy assets, imagens por IntersectionObserver, chunks tardios.
- Navegação multipágina entre as rotas declaradas.
- Preloader: a espera por `load` + `networkidle` cobre preloaders simples.

## Interações pós-MVP (declarar como não exercitadas)

Hover, clique seguro, menus, modais, acordeões, tabs, carrossel, drag, touch, reprodução
explícita de mídia, navegação SPA interna, click-to-enter.

## Ações PROIBIDAS (sempre, sem exceção)

Comprar, excluir, publicar, enviar mensagem real, alterar conta, submeter formulário de
produção, executar qualquer ação irreversível.

## Estratégias para assets tardios (roadmap)

Scroll progressivo (MVP), espera por estabilidade de rede (MVP), MutationObserver, monitoramento
de dynamic imports/workers, hover/clique seguros, carrossel, mudança de viewport, reprodução de
mídia, entrada em cena WebGL, espera de preloader, cache limpo vs aquecido.

## Saídas no MVP

- `capture/snapshots/<rota>-<viewport>.html` — DOM pós-hidratação por viewport.
- `capture/screenshots/<rota>-<viewport>.png` — evidência visual full-page.
- Atribuição de rota em cada acquisition record (`routeDiscovered`).

## Critérios de aceite

- [ ] Todas as rotas declaradas foram exercitadas em todos os viewports.
- [ ] Interações declaradas mas não exercitadas constam em `manifest.interactionsNotExercised`.
- [ ] Nenhuma ação proibida executada.
