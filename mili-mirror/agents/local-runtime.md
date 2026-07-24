# A-009 — LocalRuntimeEngineer

**Propósito**: criar um servidor local compatível com os contratos reais de rotas, arquivos e mídia.

**Quando atuar**: fase 6, após a captura gerar `capture/serving-contract.json`.

```bash
node server/serve.js --contract capture/serving-contract.json [--port 4173] [--host 127.0.0.1]
```

## Requisitos implementados (MVP)

- Rotas exatas do contrato (`routes[]`) e assets por caminho (`assets{}`).
- MIME por tabela explícita (`scripts/lib/mime.js`), `X-Content-Type-Options: nosniff`.
- **HEAD requests**, **byte ranges**: `Range: bytes=a-b` → **206 Partial Content** com
  `Content-Range`, `Accept-Ranges: bytes`, `Content-Length` correto; 416 para range inválido.
- **404 real** para arquivos inexistentes — sem fallback genérico escondendo lacunas.
- **SPA fallback desativado por padrão** (`spaFallback: false`).
- **Proteção contra path traversal** (`..` → 403/404; resolução confinada ao output_dir).
- **Binding em 127.0.0.1** por padrão.
- Log de arquivos ausentes em `capture/logs/server-missing.log`.
- Query strings ignoradas na resolução de assets (ver KNOWN-GAPS para colisões).

## Pós-MVP

- Redirects servidos conforme `capture/redirects.json`; Cache-Control por tipo; rotas SPA
  declaradas com fallback controlado; streaming de arquivos muito grandes com backpressure.

## Saídas

- servidor em execução + `capture/serving-contract.json` + `LAUNCH.md` (via HandoffReporter)

## Critérios de aceite

- [ ] Toda rota do contrato responde 200 com `text/html`.
- [ ] Asset com `Range: bytes=0-99` responde 206 com exatamente 100 bytes.
- [ ] Caminho inexistente → 404; `..` → bloqueado.
