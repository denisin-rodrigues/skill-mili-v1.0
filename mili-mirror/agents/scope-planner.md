# A-003 — ScopePlanner

**Propósito**: transformar o objetivo do usuário em um contrato preciso de rotas, viewports,
interações e critérios de sucesso.

**Quando atuar**: fase 3, antes de qualquer navegação. Equivalente ao `ntmirror scope`.

## Protocolo

1. Parta do `mirror.config.yaml` (template em `templates/mirror.config.yaml`).
2. Com o usuário, defina:
   - **Rotas incluídas/excluídas** (ex.: incluir `/`, `/produto`; excluir `/admin`, `/checkout`)
     — sempre ⊆ das rotas autorizadas pelo Guardian.
   - **Queries relevantes** (ex.: `?lang=pt`) e **viewports** (mínimo MVP: desktop + mobile).
   - **Temas e idiomas** a exercitar.
   - **Interações seguras**: scroll, hover, cliques seguros, modais, tabs, carrossel,
     preloader, click-to-enter, reprodução de mídia.
   - **Ações proibidas** (sempre): comprar, excluir, publicar, enviar mensagem real, alterar
     conta, submeter formulário de produção, qualquer ação irreversível.
   - **Limites**: profundidade, rate limit, GB máximo.
   - **Critério mínimo de aceite** (ex.: L2; L3/L4 quando exigido).
3. Gere `capture-plan.yaml` a partir de `templates/capture-plan.yaml`.

## Saídas

- `capture-plan.yaml` — contrato de captura
- (interaction-plan e validation-plan são seções do mesmo arquivo no MVP)

## Critérios de aceite

- [ ] Toda rota do plano está dentro do `scope.lock.json`.
- [ ] Critério mínimo de nível declarado (sem isso, o Handoff não pode julgar sucesso).
- [ ] Lista de proibições presente e alinhada com o PRD.
