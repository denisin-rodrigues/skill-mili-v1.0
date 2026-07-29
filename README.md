# Mili: copie e recrie sites do jeito certo

Mili é uma ferramenta que pega um site (o seu, ou um que você tenha
autorização de verdade pra mexer) e cria uma **cópia local funcional** dele
no seu computador, pronta pra você estudar, editar, testar ou usar como
ponto de partida de um projeto novo.

Ela não tira só um "print" do site. Ela realmente **navega** pelo site como
uma pessoa faria: rola a página, espera as animações carregarem, confere o
celular e o computador, e só depois salva o que encontrou. No final, ela te
diz com honestidade o que funcionou e o que não funcionou, sem enfeitar o
resultado.

> ⚠️ **Antes de usar, leia o
> [guia de autorização](https://github.com/denisin-rodrigues/skill-mili-v1.0/blob/master/AUTHORIZATION-POLICY.md).**
> Isso é pra sites seus ou que você realmente tem permissão de usar. Não é
> uma ferramenta pra copiar o site de qualquer concorrente ou empresa sem
> avisar ninguém. Ela também não quebra login, captcha, nem sistemas de
> proteção: se o site tem uma trava, a Mili respeita.

## O que ela sabe fazer

- **Baixa o site de verdade**, incluindo as partes que só aparecem quando
  você rola a página ou espera um pouco (muita ferramenta de "clonar site"
  perde exatamente essas partes).
- **Testa se a cópia realmente funciona** antes de te dizer que deu certo:
  confere no celular, no computador e até com a internet desligada.
- **É honesta sobre o resultado.** Se alguma parte não deu certo, ela te
  fala exatamente o quê, em vez de fingir que está tudo perfeito.
- **Quando a cópia exata não é confiável**, ela monta uma versão alternativa
  editável, onde o texto, as cores e as imagens ficam separados do resto,
  pra você trocar sem precisar mexer em código complicado.
- **Te entrega um relatório no final**, em português simples, explicando o
  que foi salvo, o que não deu, e como rodar tudo na sua máquina.

## Antes de começar

Você vai precisar ter o **Node.js** instalado (versão 18 ou mais nova), um
programa gratuito que dá pra baixar em
[nodejs.org](https://nodejs.org). Funciona no Windows (usando o WSL), Mac
e Linux.

## Como instalar

Abra o terminal e cole isso, uma linha de cada vez:

```bash
git clone https://github.com/denisin-rodrigues/skill-mili-v1.0.git
cd skill-mili-v1.0/mili-mirror
npm install
npx playwright install chromium
```

Isso baixa a ferramenta e instala tudo que ela precisa pra funcionar
(inclusive um navegador próprio, separado do seu Chrome normal).

Pra conferir se deu tudo certo:

```bash
node scripts/doctor.js --browsers
```

E pra ver a ferramenta funcionando de ponta a ponta, num site de teste que
já vem pronto (sem mexer em nenhum site real):

```bash
npm run selftest
```

Se aparecer `PASS` em tudo no final, está pronta pra usar.

## Como começar um projeto do zero

1. **Diga à Mili qual site você quer copiar e por quê.** Copie os dois
   arquivos de exemplo pra pasta do seu projeto:
   ```bash
   cp templates/authorization.yaml meu-projeto/authorization.yaml
   cp templates/mirror.config.yaml meu-projeto/mirror.config.yaml
   ```
   Abra o `authorization.yaml` e preencha: o endereço do site, quais páginas
   você quer copiar, e qual é a sua relação com o site (dono, funcionário,
   cliente autorizado, etc). **Se não for um site seu**, guarde uma prova
   real dessa autorização (um e-mail, um documento). A ferramenta não
   verifica isso sozinha, quem verifica é você.

2. **Peça pra ela confirmar que está tudo certo e começar:**
   ```bash
   node scripts/guardian.js --config meu-projeto/mirror.config.yaml --authorization meu-projeto/authorization.yaml
   node scripts/capture.js --config meu-projeto/mirror.config.yaml
   ```

3. **Peça pra ela testar o resultado:**
   ```bash
   node scripts/blueprint.js --config meu-projeto/mirror.config.yaml
   node scripts/validate.js --config meu-projeto/mirror.config.yaml
   node scripts/validate.js --config meu-projeto/mirror.config.yaml --offline
   ```

4. Se o site copiado não funcionar bem o suficiente, use a versão editável.
   O passo a passo está em
   [mili-mirror/agents/recreation.md](https://github.com/denisin-rodrigues/skill-mili-v1.0/blob/master/mili-mirror/agents/recreation.md).

5. **Peça o relatório final:**
   ```bash
   node scripts/report.js --config meu-projeto/mirror.config.yaml
   ```
   Isso gera um resumo em português explicando o que deu certo, o que não
   deu, e o comando pra abrir o site copiado no seu navegador.

Guia técnico completo (pra quem já programa) está em
[mili-mirror/README.md](https://github.com/denisin-rodrigues/skill-mili-v1.0/blob/master/mili-mirror/README.md).

## O que já funciona bem, e o que ainda não

**Já funciona e foi bastante testado:** copiar um site e servi-lo
localmente; checar se ele funciona no celular, no computador e sem
internet; montar uma versão editável quando a cópia exata não é
confiável, incluindo páginas individuais de "cases"/projetos; comparar
visualmente a cópia com o site original.

**Ainda não existe:** recriar automaticamente efeitos 3D/WebGL complexos
(hoje isso só foi feito manualmente, uma vez, como experimento); um editor
visual (arrastar e soltar pra mudar texto/imagem sem editar arquivo); e uma
verificação automática que prove sozinha que você realmente tem autorização
do site. Hoje isso depende de você ser honesto ao preencher o
`authorization.yaml` (veja o guia de autorização linkado no topo).

## Licença

O código é [MIT](https://github.com/denisin-rodrigues/skill-mili-v1.0/blob/master/LICENSE), livre pra usar, copiar e modificar. Isso **não** é uma
autorização pra usar a ferramenta contra o site de outra pessoa/empresa sem
permissão real. Veja o
[guia de autorização](https://github.com/denisin-rodrigues/skill-mili-v1.0/blob/master/AUTHORIZATION-POLICY.md).
