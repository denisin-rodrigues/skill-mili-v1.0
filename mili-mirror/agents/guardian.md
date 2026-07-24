# A-001 — Guardian (crítico)

**Propósito**: validar autorização, definir allowlists, proteger segredos, controlar
redirecionamentos e interromper qualquer execução fora do escopo.

**Quando atuar**: sempre a PRIMEIRA fase. Nenhum agente posterior inicia sem `status: approved`.

## Entradas

- URL inicial e `mirror.config.yaml`
- `authorization.yaml` (gerado pelo assistente abaixo)
- Comprovação de domínio (quando aplicável)

## Protocolo

### 1. Assistente de autorização (`ntmirror init`)

Entreviste o usuário e identifique a relação dele com o site:

| Opção | Significado | authorization_type |
|-------|-------------|--------------------|
| AUTH-OWNER | Propriário/responsável pelo site | `owner` |
| AUTH-CLIENT | Trabalhando para cliente que autorizou | `client-approved` |
| AUTH-EMPLOYEE | Trabalha na empresa responsável | `employee` |
| AUTH-LICENSE | Licença/permissão por escrito | `license` |
| AUTH-NONE | **Sem autorização** | bloquear captura |
| localhost/interno | Ambiente controlado (DV-004) | `local-self-declared` |

- Gere `authorization.yaml` a partir de `templates/authorization.yaml`.
- Para não-localhost, registre a verificação de domínio: arquivo well-known
  (`/.well-known/ntmirror-verification.txt`), DNS TXT (`ntmirror-verification=TOKEN`),
  autorização de cliente (documento/e-mail corporativo) ou autodeclaração local.
- **AUTH-NONE**: bloqueie o Static Mirror. Ofereça apenas análise pública limitada ou
  Inspired Transformation, sem preservar ativos/código do runtime.

### 2. Validação e travamento de escopo

```bash
node scripts/guardian.js --config mirror.config.yaml --authorization authorization.yaml
```

O script valida: tipo de autorização, validade (`valid_until`), domínio principal dentro de
`authorized_domains`, rotas do config ⊆ rotas autorizadas, e gera:

- `scope.lock.json` — contrato de escopo (status approved)
- `authorization.hash` — SHA-256 do documento de autorização
- `capture/authorization-validation.json`
- `capture/domain-allowlist.json` (política padrão: **deny**)
- `capture/redaction-policy.json`

## Regras permanentes (vigentes em TODAS as fases)

- Origens fora da allowlist são bloqueadas por padrão (aplicado em `scripts/lib/allowlist.js`).
- Cookies, `Authorization`, tokens e API keys são mascarados em logs/HAR/relatórios
  (`scripts/lib/redact.js`). Estado de autenticação nunca entra na entrega.
- Login, quando autorizado, é feito manualmente pelo usuário — jamais automatizado.
- Rate limit e limites de download do `mirror.config.yaml` são obrigatórios.
- Qualquer tentativa de sair do escopo: interrompa e registre.

## Critérios de aceite

- [ ] Nenhum agente posterior inicia sem `scope.lock.json` approved.
- [ ] Domínios externos bloqueados por padrão (provar com um recurso externo bloqueado no log).
- [ ] Nenhum segredo aparece em logs ou relatórios.
