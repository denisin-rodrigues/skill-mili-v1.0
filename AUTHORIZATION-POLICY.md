# Política de autorização — leia antes de usar

Esta ferramenta existe para capturar, preservar e reconstruir experiências
frontend **próprias ou explicitamente autorizadas**. Ela não existe para
copiar sites de terceiros sem permissão.

## O que a ferramenta verifica hoje

O agente Guardian (`scripts/guardian.js`) exige um `authorization.yaml`
preenchido antes de qualquer captura, com um `authorization_type`:

- `owner` — você é o titular do site.
- `client-approved` — você tem autorização documentada de um cliente.
- `employee` — você trabalha na empresa responsável pelo site.
- `license` — você tem uma licença por escrito.
- `local-self-declared` — apenas para `localhost` e domínios que você
  comprovadamente controla.

## O que a ferramenta NÃO verifica automaticamente

**Isto é importante: nada no código impede alguém de preencher
`authorization_type: employee` (ou qualquer outro) sem que isso seja
verdade.** O Guardian confia no que você escreve no arquivo. Métodos de
verificação real existem (arquivo `.well-known`, registro DNS TXT,
documento assinado) mas são **manuais** — quem opera a ferramenta (você,
ou um agente de IA como Claude) precisa efetivamente checar essas provas
antes de prosseguir com capturas profundas ou qualquer ação que modifique,
redistribua ou reaproveite código/ativos de um site de terceiro.

Se você está integrando esta ferramenta a um agente de IA: instrua-o
explicitamente a **pedir prova verificável** (arquivo `.well-known`, DNS
TXT, ou e-mail do domínio da empresa) antes de aceitar uma autorização
declarada verbalmente, especialmente antes de qualquer captura completa,
edição de bundle de produção real, ou publicação de resultado.

## Regras que continuam valendo sempre, mesmo com autorização

- Não contornar autenticação, CAPTCHA, WAF, anti-bot, paywall, DRM ou URLs assinadas.
- Não capturar credenciais; login é sempre manual do usuário autorizado.
- Não publicar automaticamente um clone em produção.
- Não redistribuir publicamente ativos capturados (vídeos, fontes, imagens) de um
  site de terceiro — `output/` fica fora do controle de versão por padrão
  (ver `.gitignore`) exatamente por isso.
- Projetos de estudo/prática pessoal são um uso legítimo, mas **não** justificam
  reaproveitar o código/bundle de produção real de outra empresa para fins
  comerciais próprios.
