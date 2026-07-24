<?xml version="1.0" encoding="UTF-8"?>

<prd
product="Mili Site Mirror Agent Team"
version="1.0.0"
specificationVersion="1.0"
language="pt-BR"
status="ready-for-implementation"
updatedAt="2026-07-24">

  <metadata>
    <title>PRD Completo — Mili Site Mirror Agent Team</title>
    <subtitle>Sistema multiagente para captura autorizada, análise, reconstrução editável e validação de experiências frontend</subtitle>
    <documentType>Product Requirements Document</documentType>
    <primaryTargets>
      <target>Claude Code</target>
      <target>OpenAI Codex</target>
      <target>Agentes locais executados em Linux</target>
      <target>Windows com WSL 2</target>
      <target>Ambientes Docker</target>
    </primaryTargets>
    <interfaceLanguage>Português</interfaceLanguage>
    <sourceCodeLanguage>Inglês</sourceCodeLanguage>
    <defaultLicensePolicy>Execução somente em projetos próprios ou autorizados</defaultLicensePolicy>
  </metadata>

  <executiveSummary>
    <description>
      O  Site Mirror Agent Team será um sistema multiagente capaz de receber uma URL autorizada,
      investigar profundamente como a experiência frontend funciona, registrar seus recursos,
      rotas, interações, animações, estados responsivos, mídia, cenas WebGL e dependências,
      e então produzir uma versão local reproduzível.
    </description>

```
<description>
  O produto não será apenas um downloader de arquivos. Ele deverá observar a experiência
  em execução dentro de um navegador real, mapear seu comportamento, capturar os recursos
  publicamente entregues ao navegador, construir um servidor local compatível, validar os
  estados importantes e produzir evidências técnicas.
</description>

<description>
  Quando o runtime implantado não puder ser preservado de maneira confiável, o produto deverá
  gerar um Experience Blueprint e utilizar um conjunto de agentes para reconstruir a experiência
  em código limpo, organizado, editável e reutilizável.
</description>

<primaryPromise>
  Transformar experiências frontend autorizadas em baselines locais reproduzíveis, validadas,
  documentadas e editáveis, permitindo substituir marca, copy, imagens, vídeos, modelos 3D,
  cores, tipografia e conteúdo sem perder a narrativa, as interações e as animações essenciais.
</primaryPromise>
```

  </executiveSummary>

  <productPositioning>
    <incorrectPositioning>
      Copiar qualquer site, roubar código-fonte privado ou recuperar o repositório original.
    </incorrectPositioning>

```
<correctPositioning>
  Analisar experiências frontend próprias ou autorizadas, preservar aquilo que foi publicamente
  entregue ao navegador, reconstruir aquilo que não puder ser espelhado e entregar um projeto
  editável, validado e documentado.
</correctPositioning>

<commercialCategory>
  Ferramenta de engenharia reversa visual autorizada, preservação de frontend, reconstrução
  editável, análise de experiência e geração de baselines para desenvolvimento.
</commercialCategory>
```

  </productPositioning>

  <problemStatement>
    <problem>
      Ferramentas tradicionais como wget, curl, HTTrack e extensões de download normalmente
      capturam apenas o HTML inicial e alguns recursos declarados diretamente no documento.
    </problem>

```
<problem>
  Sites modernos carregam chunks, imagens, modelos, áudio, vídeo, shaders, fontes, workers,
  arquivos WASM e dados somente depois que o usuário rola a página, passa o mouse, clica,
  altera o viewport, entra em uma cena ou espera a conclusão de um preloader.
</problem>

<problem>
  Muitas soluções que prometem recriar websites apenas tiram screenshots da primeira dobra,
  geram HTML visualmente semelhante e ignoram animações, scroll, rotas, responsividade,
  mídia, WebGL, interações e dependências tardias.
</problem>

<problem>
  O usuário termina com uma página aparentemente parecida, mas sem a experiência original,
  sem estrutura editável, sem validação real e sem clareza sobre o que foi preservado ou perdido.
</problem>
```

  </problemStatement>

  <goals>
    <goal id="G-001">
      Receber uma URL autorizada e produzir uma versão local executável da experiência frontend.
    </goal>

```
<goal id="G-002">
  Descobrir rotas, estados, interações, animações, sistemas de scroll, mídia e recursos dinâmicos.
</goal>

<goal id="G-003">
  Preservar arquivos publicamente entregues ao navegador dentro do escopo autorizado.
</goal>

<goal id="G-004">
  Gerar um Experience Blueprint estruturado e legível por máquina.
</goal>

<goal id="G-005">
  Reconstruir a experiência em componentes editáveis quando necessário.
</goal>

<goal id="G-006">
  Separar conteúdo, identidade visual, animações, componentes e cenas 3D.
</goal>

<goal id="G-007">
  Permitir substituição de copy, imagens, vídeos, modelos 3D, fontes, cores e marca.
</goal>

<goal id="G-008">
  Validar a experiência local contra rotas, viewports e interações declaradas.
</goal>

<goal id="G-009">
  Produzir relatórios transparentes, evidências, hashes, manifestos e lacunas conhecidas.
</goal>

<goal id="G-010">
  Executar em Linux, Windows por WSL 2 e opcionalmente em Docker.
</goal>
```

  </goals>

  <nonGoals>
    <nonGoal id="NG-001">Recuperar o repositório Git original.</nonGoal>
    <nonGoal id="NG-002">Recuperar código backend não enviado ao navegador.</nonGoal>
    <nonGoal id="NG-003">Extrair banco de dados, variáveis de ambiente ou segredos.</nonGoal>
    <nonGoal id="NG-004">Recuperar componentes TypeScript ou React originais anteriores ao build.</nonGoal>
    <nonGoal id="NG-005">Desminificar perfeitamente bundles ou recuperar nomes originais de variáveis.</nonGoal>
    <nonGoal id="NG-006">Contornar autenticação, paywalls, DRM, CAPTCHA, WAF ou sistemas anti-bot.</nonGoal>
    <nonGoal id="NG-007">Copiar sites de terceiros sem autorização.</nonGoal>
    <nonGoal id="NG-008">Publicar automaticamente clones em produção.</nonGoal>
    <nonGoal id="NG-009">Executar compras, exclusões, envios ou ações irreversíveis durante testes.</nonGoal>
  </nonGoals>

  <corePrinciples>
    <principle id="CP-001" name="EvidenceOverAppearance">
      Uma screenshot visualmente semelhante não será considerada prova de captura completa.
    </principle>

```
<principle id="CP-002" name="AuthorizationFirst">
  Nenhuma captura profunda poderá começar antes da validação do escopo autorizado.
</principle>

<principle id="CP-003" name="StaticMirrorFirst">
  O Static Mirror será o primeiro método tentado para preservar a experiência implantada.
</principle>

<principle id="CP-004" name="EditableFallback">
  Editable Recreation será usado quando o runtime não puder entregar um baseline confiável.
</principle>

<principle id="CP-005" name="TransparentClassification">
  Cada recurso deverá ser classificado como capturado, reconstruído, aproximado, externo,
  bloqueado, ausente ou não exercitado.
</principle>

<principle id="CP-006" name="Reproducibility">
  Outra pessoa deverá conseguir iniciar o projeto seguindo apenas os arquivos e comandos entregues.
</principle>

<principle id="CP-007" name="ContentSeparation">
  Copy, imagens, vídeos, links, produtos e identidade visual deverão ficar separados do core.
</principle>

<principle id="CP-008" name="LeastPrivilege">
  Os agentes trabalharão com o menor nível possível de acesso e dentro de uma allowlist explícita.
</principle>

<principle id="CP-009" name="NoFalseCompleteness">
  Estados não testados jamais poderão ser apresentados como concluídos.
</principle>
```

  </corePrinciples>

  <personas>
    <persona id="P-001">
      <name>Desenvolvedor frontend</name>
      <need>Estudar e reconstruir uma experiência autorizada como baseline de desenvolvimento.</need>
    </persona>

```
<persona id="P-002">
  <name>Agência digital</name>
  <need>Preservar campanhas, landing pages e experiências temporárias de clientes.</need>
</persona>

<persona id="P-003">
  <name>Empresa em migração</name>
  <need>Reconstruir uma interface implantada quando o projeto original está incompleto.</need>
</persona>

<persona id="P-004">
  <name>Designer e criador digital</name>
  <need>Usar uma experiência como referência e trocar marca, copy, mídia e elementos visuais.</need>
</persona>

<persona id="P-005">
  <name>Profissional de QA</name>
  <need>Executar localmente uma versão previsível para testes de rotas e estados.</need>
</persona>

<persona id="P-006">
  <name>Arquivista digital</name>
  <need>Preservar experiências autorizadas antes que sejam desativadas.</need>
</persona>
```

  </personas>

  <productionModes>
    <mode id="M-001" name="StaticMirror" priority="primary">
      <description>
        Observa o runtime implantado, captura recursos públicos autorizados, preserva rotas,
        constrói um servidor local e valida a experiência.
      </description>

```
  <bestFor>
    <case>Preservação de uma experiência implantada.</case>
    <case>Migração autorizada.</case>
    <case>Ambiente local de QA.</case>
    <case>Campanhas e portfólios.</case>
    <case>Projetos cujo código original está incompleto.</case>
  </bestFor>
</mode>

<mode id="M-002" name="EditableRecreation" priority="fallback">
  <description>
    Reconstrói a experiência observada utilizando código limpo e editável, com base em
    screenshots, gravações, estilos computados, métricas, assets autorizados e mapas de animação.
  </description>

  <activationConditions>
    <condition>O runtime local não inicia de forma confiável.</condition>
    <condition>Os bundles dependem fortemente de APIs externas ou protegidas.</condition>
    <condition>O usuário solicita um projeto fácil de modificar.</condition>
    <condition>O site usa arquitetura implantada inadequada para reutilização.</condition>
    <condition>O Static Mirror não atinge o nível mínimo solicitado.</condition>
  </activationConditions>
</mode>

<mode id="M-003" name="Hybrid">
  <description>
    Reutiliza recursos autorizados capturados, como imagens, fontes, vídeos e modelos,
    enquanto reconstrói componentes, layout, animações e lógica de interface.
  </description>
</mode>

<mode id="M-004" name="InspiredTransformation">
  <description>
    Preserva a linguagem de experiência e o comportamento geral, mas aplica nova identidade,
    novos componentes, novas composições, novos conteúdos e ativos próprios.
  </description>

  <recommendedCommercialUse>true</recommendedCommercialUse>
</mode>

<mode id="M-005" name="PartialMirror">
  <description>
    Entrega uma versão parcialmente funcional com relatório explícito de dependências,
    recursos bloqueados, estados não exercitados e diferenças conhecidas.
  </description>
</mode>
```

  </productionModes>

  <authorizationAndLegalScope>
    <authorizationAssistant>
      <description>
        O usuário não precisará criar manualmente um arquivo YAML. O comando de inicialização
        deverá abrir um assistente que identifica a relação do usuário com o site e gera os
        documentos de autorização.
      </description>

```
  <command>ntmirror init</command>

  <relationshipOptions>
    <option id="AUTH-OWNER">Sou proprietário ou responsável pelo site.</option>
    <option id="AUTH-CLIENT">Estou trabalhando para um cliente que autorizou.</option>
    <option id="AUTH-EMPLOYEE">Trabalho na empresa responsável pelo site.</option>
    <option id="AUTH-LICENSE">Possuo uma licença ou permissão por escrito.</option>
    <option id="AUTH-NONE">Não possuo autorização.</option>
  </relationshipOptions>

  <behaviorWithoutAuthorization>
    O Static Mirror completo deverá ser bloqueado. O sistema poderá oferecer apenas análise
    pública limitada ou Inspired Transformation sem preservar ativos protegidos ou código
    do runtime original.
  </behaviorWithoutAuthorization>

  <generatedDocuments>
    <document>authorization.yaml</document>
    <document>AUTHORIZATION.md</document>
    <document>scope.lock.json</document>
    <document>authorization.hash</document>
  </generatedDocuments>
</authorizationAssistant>

<domainVerification>
  <method id="DV-001">
    <name>Arquivo well-known</name>
    <example><![CDATA[
```

https://dominio.com/.well-known/ntmirror-verification.txt

ntmirror-verification=TOKEN_UNICO
]]></example> </method>

```
  <method id="DV-002">
    <name>Registro DNS TXT</name>
    <example><![CDATA[
```

ntmirror-verification=TOKEN_UNICO
]]></example> </method>

```
  <method id="DV-003">
    <name>Autorização de cliente</name>
    <description>
      Documento assinado, confirmação por e-mail corporativo ou registro contratual.
    </description>
  </method>

  <method id="DV-004">
    <name>Autodeclaração local</name>
    <description>
      Permitida para ambientes localhost, projetos internos e domínios comprovadamente controlados.
    </description>
  </method>
</domainVerification>

<authorizationTemplate>
  <content><![CDATA[
```

Autorização para captura e reprodução local de frontend

Eu, [NOME DO RESPONSÁVEL], representando [EMPRESA OU TITULAR], autorizo
[NOME DO PROFISSIONAL OU EMPRESA CONTRATADA] a analisar e capturar os
recursos frontend publicamente entregues pelo website [DOMÍNIO].

Finalidades autorizadas:

* migração;
* preservação;
* manutenção;
* ambiente local;
* QA;
* recriação técnica;
* continuidade do projeto.

A autorização não inclui:

* bancos de dados;
* servidores privados;
* painéis não autorizados;
* credenciais;
* informações pessoais;
* sistemas protegidos;
* recursos de terceiros não permitidos.

Domínios autorizados:
[LISTA]

Rotas autorizadas:
[LISTA]

Responsável:
[NOME]

Cargo:
[CARGO]

Empresa:
[EMPRESA]

Data:
[DATA]

Validade:
[DATA FINAL]

Assinatura:
[ASSINATURA]
]]></content> </authorizationTemplate>

```
<mandatoryRestrictions>
  <restriction>Não contornar autenticação.</restriction>
  <restriction>Não capturar credenciais.</restriction>
  <restriction>Não quebrar CAPTCHA.</restriction>
  <restriction>Não contornar WAF ou anti-bot.</restriction>
  <restriction>Não remover DRM.</restriction>
  <restriction>Não contornar paywall.</restriction>
  <restriction>Não quebrar URLs assinadas.</restriction>
  <restriction>Não explorar vulnerabilidades.</restriction>
  <restriction>Não acessar painéis administrativos fora do escopo.</restriction>
  <restriction>Não buscar arquivos privados.</restriction>
  <restriction>Não extrair backend ou banco de dados.</restriction>
  <restriction>Não navegar automaticamente para domínios fora da allowlist.</restriction>
  <restriction>Não realizar brute force.</restriction>
  <restriction>Não executar transações ou ações irreversíveis.</restriction>
</mandatoryRestrictions>

<thirdPartyDependencies>
  <rule>
    Recursos de terceiros deverão ser classificados separadamente e somente poderão ser
    preservados quando a autorização e os termos aplicáveis permitirem.
  </rule>

  <classifications>
    <classification>approved-local</classification>
    <classification>approved-external</classification>
    <classification>third-party-external</classification>
    <classification>blocked</classification>
    <classification>unknown</classification>
  </classifications>
</thirdPartyDependencies>

<authenticatedSessions>
  <rule>O login deverá ser realizado manualmente pelo usuário autorizado.</rule>
  <rule>O agente não poderá descobrir ou solicitar senha por automação.</rule>
  <rule>Cookies, tokens e cabeçalhos sensíveis deverão ser mascarados.</rule>
  <rule>O estado de autenticação não deverá ser incluído na entrega final.</rule>
  <rule>Sessões deverão possuir prazo de validade.</rule>
  <rule>Arquivos temporários deverão ser criptografados ou eliminados após a execução.</rule>
</authenticatedSessions>
```

  </authorizationAndLegalScope>

  <systemArchitecture>
    <architectureStyle>Multi-agent pipeline with persistent orchestration state</architectureStyle>

```
<coreComponents>
  <component id="C-001">CLI</component>
  <component id="C-002">Orquestrador multiagente</component>
  <component id="C-003">Navegador automatizado</component>
  <component id="C-004">Capturador de rede</component>
  <component id="C-005">Asset store</component>
  <component id="C-006">Experience Blueprint generator</component>
  <component id="C-007">Servidor local</component>
  <component id="C-008">Sistema de validação</component>
  <component id="C-009">Reconstruction workspace</component>
  <component id="C-010">Evidence store</component>
  <component id="C-011">Report generator</component>
</coreComponents>

<pipeline><![CDATA[
```

URL autorizada
|
v
Guardian
|
v
Environment Bootstrap
|
v
Scope Planner
|
v
Runtime Scout
|
v
Route and State Explorer
|
v
Asset Acquisition
|
v
WebGL and Media Specialist
|
v
Experience Blueprint Builder
|
v
Local Runtime Engineer
|
v
QA and Evidence
|
+-------------------------+
|                         |
v                         v
Critérios atingidos?      Critérios não atingidos
|                         |
v                         v
Handoff Reporter         Recreation Engineer
|
v
QA and Evidence
|
v
Handoff Reporter
]]></pipeline> </systemArchitecture>

  <agents>

```
<agent id="A-001" name="Guardian" critical="true">
  <purpose>
    Validar autorização, definir allowlists, proteger segredos, controlar redirecionamentos
    e interromper qualquer execução fora do escopo.
  </purpose>

  <inputs>
    <input>URL inicial</input>
    <input>authorization.yaml</input>
    <input>mirror.config.yaml</input>
    <input>Comprovação de domínio</input>
    <input>Estado de sessão autorizado, quando aplicável</input>
  </inputs>

  <responsibilities>
    <responsibility>Verificar validade da autorização.</responsibility>
    <responsibility>Gerar scope.lock.json.</responsibility>
    <responsibility>Validar domínios e rotas.</responsibility>
    <responsibility>Bloquear origens não autorizadas.</responsibility>
    <responsibility>Mascarar tokens, cookies e segredos.</responsibility>
    <responsibility>Aplicar rate limits.</responsibility>
    <responsibility>Interromper comportamentos suspeitos.</responsibility>
  </responsibilities>

  <outputs>
    <output>scope.lock.json</output>
    <output>authorization-validation.json</output>
    <output>domain-allowlist.json</output>
    <output>redaction-policy.json</output>
  </outputs>

  <acceptanceCriteria>
    <criterion>Nenhum agente posterior inicia sem status approved.</criterion>
    <criterion>Domínios externos são bloqueados por padrão.</criterion>
    <criterion>Segredos não aparecem em logs ou relatórios.</criterion>
  </acceptanceCriteria>
</agent>

<agent id="A-002" name="EnvironmentBootstrap">
  <purpose>Preparar, diagnosticar e registrar o ambiente local.</purpose>

  <responsibilities>
    <responsibility>Detectar Windows, Linux ou macOS.</responsibility>
    <responsibility>Preparar WSL 2 no Windows.</responsibility>
    <responsibility>Verificar arquitetura do processador.</responsibility>
    <responsibility>Verificar espaço livre, memória e portas.</responsibility>
    <responsibility>Instalar ferramentas necessárias.</responsibility>
    <responsibility>Instalar navegadores Playwright.</responsibility>
    <responsibility>Validar FFmpeg, Git, Node.js e Python.</responsibility>
    <responsibility>Validar Docker opcional.</responsibility>
  </responsibilities>

  <commands>
    <command>ntmirror doctor</command>
    <command>ntmirror bootstrap</command>
  </commands>

  <outputs>
    <output>environment-report.json</output>
    <output>bootstrap.log</output>
    <output>runtime-versions.lock</output>
  </outputs>
</agent>

<agent id="A-003" name="ScopePlanner">
  <purpose>
    Transformar o objetivo do usuário em um contrato preciso de rotas, viewports,
    interações e critérios de sucesso.
  </purpose>

  <responsibilities>
    <responsibility>Definir rotas incluídas e excluídas.</responsibility>
    <responsibility>Definir queries relevantes.</responsibility>
    <responsibility>Definir viewports.</responsibility>
    <responsibility>Definir temas e idiomas.</responsibility>
    <responsibility>Definir interações seguras.</responsibility>
    <responsibility>Definir estados de mídia.</responsibility>
    <responsibility>Definir critérios de validação.</responsibility>
    <responsibility>Definir limites de profundidade e recursos.</responsibility>
  </responsibilities>

  <outputs>
    <output>capture-plan.yaml</output>
    <output>interaction-plan.yaml</output>
    <output>validation-plan.yaml</output>
  </outputs>
</agent>

<agent id="A-004" name="RuntimeScout">
  <purpose>Descobrir como o site realmente funciona antes da aquisição.</purpose>

  <inspectionTargets>
    <target>Framework provável</target>
    <target>Sistema de rotas</target>
    <target>Bundles principais</target>
    <target>Dynamic imports</target>
    <target>Lazy loading</target>
    <target>Service Workers</target>
    <target>Web Workers</target>
    <target>Shared Workers</target>
    <target>Bibliotecas de animação</target>
    <target>Canvas</target>
    <target>WebGL</target>
    <target>Three.js</target>
    <target>Players de mídia</target>
    <target>Virtual scrolling</target>
    <target>APIs externas</target>
    <target>Local Storage</target>
    <target>Session Storage</target>
    <target>Cookies necessários</target>
    <target>Preloaders</target>
    <target>Click-to-enter</target>
    <target>Estados responsivos</target>
  </inspectionTargets>

  <outputs>
    <output>runtime-map.json</output>
    <output>dependency-map.json</output>
    <output>framework-evidence.json</output>
    <output>service-worker-report.json</output>
    <output>discovery-notes.md</output>
  </outputs>
</agent>

<agent id="A-005" name="RouteAndStateExplorer">
  <purpose>
    Navegar pelas rotas autorizadas e exercitar estados necessários para revelar
    recursos e comportamentos tardios.
  </purpose>

  <supportedInteractions>
    <interaction>Scroll incremental</interaction>
    <interaction>Scroll total</interaction>
    <interaction>Hover</interaction>
    <interaction>Clique seguro</interaction>
    <interaction>Abertura de menu</interaction>
    <interaction>Modal</interaction>
    <interaction>Acordeão</interaction>
    <interaction>Tabs</interaction>
    <interaction>Carrossel</interaction>
    <interaction>Drag seguro</interaction>
    <interaction>Touch em mobile</interaction>
    <interaction>Preloader</interaction>
    <interaction>Click-to-enter</interaction>
    <interaction>Reprodução de vídeo</interaction>
    <interaction>Reprodução de áudio</interaction>
    <interaction>Navegação SPA</interaction>
    <interaction>Navegação multipágina</interaction>
  </supportedInteractions>

  <prohibitedActions>
    <action>Comprar</action>
    <action>Excluir</action>
    <action>Publicar</action>
    <action>Enviar mensagem real</action>
    <action>Alterar conta</action>
    <action>Submeter formulário de produção</action>
    <action>Executar ação irreversível</action>
  </prohibitedActions>

  <outputs>
    <output>route-execution.jsonl</output>
    <output>interaction-execution.jsonl</output>
    <output>state-snapshots/</output>
    <output>navigation-graph.json</output>
  </outputs>
</agent>

<agent id="A-006" name="AssetAcquisition">
  <purpose>
    Preservar os recursos observados durante as rotas e interações autorizadas.
  </purpose>

  <supportedAssets>
    <asset>HTML</asset>
    <asset>CSS</asset>
    <asset>JavaScript</asset>
    <asset>JSON</asset>
    <asset>XML</asset>
    <asset>SVG</asset>
    <asset>PNG</asset>
    <asset>JPEG</asset>
    <asset>WEBP</asset>
    <asset>AVIF</asset>
    <asset>GIF</asset>
    <asset>Fontes</asset>
    <asset>Vídeo</asset>
    <asset>Áudio</asset>
    <asset>GLB</asset>
    <asset>GLTF</asset>
    <asset>BIN</asset>
    <asset>HDR</asset>
    <asset>EXR</asset>
    <asset>KTX</asset>
    <asset>KTX2</asset>
    <asset>Draco</asset>
    <asset>WASM</asset>
    <asset>Shaders</asset>
    <asset>Workers</asset>
    <asset>Manifests</asset>
    <asset>Source maps públicos autorizados</asset>
  </supportedAssets>

  <acquisitionStrategies>
    <strategy priority="1">Captura do corpo da resposta do navegador.</strategy>
    <strategy priority="2">Download direto autorizado.</strategy>
    <strategy priority="3">Leitura do cache do navegador.</strategy>
    <strategy priority="4">Captura após interação.</strategy>
    <strategy priority="5">Classificação como dependência externa.</strategy>
    <strategy priority="6">Classificação como bloqueado ou ausente.</strategy>
  </acquisitionStrategies>

  <storageRules>
    <rule>Utilizar hashes para evitar colisões de path e query.</rule>
    <rule>Preservar URL original no manifesto.</rule>
    <rule>Registrar redirect chain.</rule>
    <rule>Registrar status HTTP.</rule>
    <rule>Registrar MIME type.</rule>
    <rule>Registrar tamanho.</rule>
    <rule>Registrar SHA-256.</rule>
    <rule>Registrar rota e interação de descoberta.</rule>
  </storageRules>

  <outputs>
    <output>capture/manifest.json</output>
    <output>capture/acquisition-records.jsonl</output>
    <output>mirror/assets/</output>
    <output>capture/hashes.sha256</output>
  </outputs>
</agent>

<agent id="A-007" name="WebGLAndMediaSpecialist">
  <purpose>
    Analisar e preservar experiências WebGL, Three.js, Canvas, áudio, vídeo e arquivos binários.
  </purpose>

  <webGLInspection>
    <item>Criação de contextos WebGL e WebGL2.</item>
    <item>Bibliotecas Three.js, Babylon.js e engines semelhantes.</item>
    <item>Modelos e geometrias.</item>
    <item>Texturas e environment maps.</item>
    <item>Shaders.</item>
    <item>Draco, Meshopt e decoders.</item>
    <item>WASM.</item>
    <item>Câmera.</item>
    <item>Iluminação.</item>
    <item>Materiais.</item>
    <item>Pós-processamento.</item>
    <item>Interação com mouse, toque e scroll.</item>
    <item>Diferenças entre desktop e mobile.</item>
  </webGLInspection>

  <mediaInspection>
    <item>Autoplay.</item>
    <item>Muted.</item>
    <item>Loop.</item>
    <item>Poster.</item>
    <item>Legendas.</item>
    <item>Playlists.</item>
    <item>Segmentos.</item>
    <item>Codecs.</item>
    <item>Eventos de reprodução.</item>
    <item>Byte-range requests.</item>
  </mediaInspection>

  <outputs>
    <output>webgl-scene-report.json</output>
    <output>media-report.json</output>
    <output>three-scene-blueprint.json</output>
    <output>decoder-dependencies.json</output>
  </outputs>
</agent>

<agent id="A-008" name="ExperienceBlueprintBuilder">
  <purpose>
    Transformar observações, métricas e evidências em um mapa estruturado da experiência.
  </purpose>

  <blueprintModules>
    <module>Page map</module>
    <module>Section map</module>
    <module>Component hierarchy</module>
    <module>Design tokens</module>
    <module>Typography</module>
    <module>Colors</module>
    <module>Spacing</module>
    <module>Grid</module>
    <module>Breakpoints</module>
    <module>Asset map</module>
    <module>Animation map</module>
    <module>Scroll map</module>
    <module>Interaction map</module>
    <module>Responsive map</module>
    <module>Media map</module>
    <module>3D scene map</module>
    <module>Dependency map</module>
    <module>Content map</module>
  </blueprintModules>

  <outputs>
    <output>experience-blueprint/pages.json</output>
    <output>experience-blueprint/sections.json</output>
    <output>experience-blueprint/components.json</output>
    <output>experience-blueprint/animations.json</output>
    <output>experience-blueprint/scroll-map.json</output>
    <output>experience-blueprint/responsive-map.json</output>
    <output>experience-blueprint/design-tokens.json</output>
    <output>experience-blueprint/three-scene.json</output>
    <output>experience-blueprint/media.json</output>
  </outputs>
</agent>

<agent id="A-009" name="LocalRuntimeEngineer">
  <purpose>
    Criar um servidor local compatível com os contratos reais de rotas, arquivos e mídia.
  </purpose>

  <serverRequirements>
    <requirement>Rotas exatas.</requirement>
    <requirement>Queries relevantes.</requirement>
    <requirement>Redirects.</requirement>
    <requirement>MIME types corretos.</requirement>
    <requirement>HEAD requests.</requirement>
    <requirement>Byte ranges.</requirement>
    <requirement>Resposta HTTP 206 para mídia.</requirement>
    <requirement>Content-Range.</requirement>
    <requirement>Content-Length.</requirement>
    <requirement>Cache Control.</requirement>
    <requirement>Rotas SPA declaradas.</requirement>
    <requirement>Rotas multipágina.</requirement>
    <requirement>Fallback controlado.</requirement>
    <requirement>Logs de arquivos ausentes.</requirement>
    <requirement>Proteção contra path traversal.</requirement>
    <requirement>Binding em 127.0.0.1 por padrão.</requirement>
  </serverRequirements>

  <outputs>
    <output>server/</output>
    <output>capture/serving-contract.json</output>
    <output>LAUNCH.md</output>
  </outputs>
</agent>

<agent id="A-010" name="RecreationEngineer">
  <purpose>
    Reconstruir a experiência em código limpo, editável, organizado e reutilizável.
  </purpose>

  <defaultStack>
    <technology>TypeScript</technology>
    <technology>React</technology>
    <technology>Vite</technology>
    <technology>CSS moderno</technology>
    <technology>GSAP quando necessário</technology>
    <technology>Three.js quando necessário</technology>
    <technology>Playwright para validação</technology>
  </defaultStack>

  <rules>
    <rule>Reconstruir seção por seção.</rule>
    <rule>Validar cada seção antes de avançar.</rule>
    <rule>Separar conteúdo, layout e animação.</rule>
    <rule>Não copiar chamadas privadas.</rule>
    <rule>Substituir integrações externas por mocks documentados.</rule>
    <rule>Marcar componentes recriados.</rule>
    <rule>Registrar evidência utilizada.</rule>
    <rule>Implementar desktop e mobile.</rule>
    <rule>Implementar prefers-reduced-motion.</rule>
  </rules>

  <outputs>
    <output>recreation/src/</output>
    <output>recreation/content/</output>
    <output>recreation/animations/</output>
    <output>recreation/scenes/</output>
    <output>recreation/RECONSTRUCTION-MAP.md</output>
  </outputs>
</agent>

<agent id="A-011" name="QAAndEvidence">
  <purpose>
    Validar rotas, estados, animações, mídia, recursos, console, rede e comportamento offline.
  </purpose>

  <testCategories>
    <category>Boot local</category>
    <category>Rotas</category>
    <category>Queries</category>
    <category>Navegação</category>
    <category>Console</category>
    <category>Network</category>
    <category>Arquivos ausentes</category>
    <category>Visual comparison</category>
    <category>Scroll</category>
    <category>Hover</category>
    <category>Click</category>
    <category>Preloader</category>
    <category>Vídeo</category>
    <category>Áudio</category>
    <category>WebGL</category>
    <category>Desktop</category>
    <category>Mobile</category>
    <category>Service Worker</category>
    <category>Cache limpo</category>
    <category>Cache aquecido</category>
    <category>Offline</category>
  </testCategories>

  <evidence>
    <item>Screenshots da origem autorizada.</item>
    <item>Screenshots locais.</item>
    <item>Comparações visuais.</item>
    <item>Traces.</item>
    <item>HAR sanitizado.</item>
    <item>Logs de console.</item>
    <item>Logs de rede.</item>
    <item>Vídeo de validação.</item>
    <item>Hashes.</item>
    <item>Resultados estruturados.</item>
  </evidence>

  <outputs>
    <output>validation-results.json</output>
    <output>capture/screenshots/</output>
    <output>capture/traces/</output>
    <output>capture/recordings/</output>
    <output>capture/logs/</output>
  </outputs>
</agent>

<agent id="A-012" name="HandoffReporter">
  <purpose>
    Produzir uma entrega profissional, reproduzível e transparente.
  </purpose>

  <deliverables>
    <deliverable>README.md</deliverable>
    <deliverable>LAUNCH.md</deliverable>
    <deliverable>REPORT.md</deliverable>
    <deliverable>KNOWN-GAPS.md</deliverable>
    <deliverable>DEPENDENCIES.md</deliverable>
    <deliverable>AUTHORIZATION-SUMMARY.md</deliverable>
    <deliverable>manifest.json</deliverable>
    <deliverable>serving-contract.json</deliverable>
    <deliverable>validation-results.json</deliverable>
    <deliverable>hashes.sha256</deliverable>
    <deliverable>experience-blueprint/</deliverable>
  </deliverables>

  <mandatoryQuestions>
    <question>O que foi preservado?</question>
    <question>O que foi reconstruído?</question>
    <question>Quais rotas foram testadas?</question>
    <question>Quais viewports foram testados?</question>
    <question>Quais interações foram exercitadas?</question>
    <question>Quais recursos continuam externos?</question>
    <question>Quais recursos foram bloqueados?</question>
    <question>Quais estados não foram exercitados?</question>
    <question>O projeto funciona offline?</question>
    <question>Qual é o comando de inicialização?</question>
    <question>O resultado é mirror, recreation, hybrid, inspired ou partial?</question>
  </mandatoryQuestions>
</agent>
```

  </agents>

  <orchestrator>
    <statePersistence>true</statePersistence>
    <resumeAfterFailure>true</resumeAfterFailure>
    <maxAgentRetries>3</maxAgentRetries>
    <maxPipelineCycles>5</maxPipelineCycles>

```
<rules>
  <rule>Persistir o estado após cada etapa.</rule>
  <rule>Não permitir alteração silenciosa de evidências anteriores.</rule>
  <rule>Exigir aprovação do Guardian.</rule>
  <rule>Executar especialistas somente quando necessários.</rule>
  <rule>Impedir loops ilimitados.</rule>
  <rule>Mostrar progresso de alto nível.</rule>
  <rule>Não declarar sucesso sem critérios de aceite.</rule>
  <rule>Encaminhar para Recreation quando o mirror for insuficiente.</rule>
</rules>

<stateExample><![CDATA[
```

{
"projectId": "ntm_project_001",
"captureId": "cap_2026_07_24_001",
"phase": "asset-acquisition",
"status": "running",
"completedAgents": [
"guardian",
"environment-bootstrap",
"scope-planner",
"runtime-scout",
"route-and-state-explorer"
],
"activeAgent": "asset-acquisition",
"pendingAgents": [
"webgl-and-media-specialist",
"experience-blueprint-builder",
"local-runtime-engineer",
"qa-and-evidence",
"handoff-reporter"
],
"blockingIssues": [],
"retryCounts": {}
}
]]></stateExample> </orchestrator>

  <experienceDiscovery>
    <runtimeDiscovery>
      <requirement>Registrar cada requisição e resposta autorizada.</requirement>
      <requirement>Registrar dynamic imports.</requirement>
      <requirement>Registrar recursos carregados por interação.</requirement>
      <requirement>Registrar workers.</requirement>
      <requirement>Registrar Service Workers.</requirement>
      <requirement>Registrar recursos vindos de cache.</requirement>
      <requirement>Registrar estados mobile e desktop.</requirement>
      <requirement>Registrar preloader e progress screens.</requirement>
    </runtimeDiscovery>

```
<lateAssetStrategies>
  <strategy>Scroll progressivo.</strategy>
  <strategy>Espera por estabilidade de rede.</strategy>
  <strategy>MutationObserver.</strategy>
  <strategy>Monitoramento de imports dinâmicos.</strategy>
  <strategy>Monitoramento de workers.</strategy>
  <strategy>Hover seguro.</strategy>
  <strategy>Clique seguro.</strategy>
  <strategy>Navegação em carrossel.</strategy>
  <strategy>Alteração de viewport.</strategy>
  <strategy>Reprodução de mídia.</strategy>
  <strategy>Entrada em cenas WebGL.</strategy>
  <strategy>Espera por preloader.</strategy>
  <strategy>Execução com cache limpo.</strategy>
  <strategy>Execução com cache aquecido.</strategy>
</lateAssetStrategies>
```

  </experienceDiscovery>

  <experienceBlueprint>
    <description>
      O Experience Blueprint será a representação estruturada da experiência observada.
      Ele deverá funcionar como contrato entre os agentes de descoberta, reconstrução e validação.
    </description>

```
<pageMap>
  <field>path</field>
  <field>queryVariants</field>
  <field>pageType</field>
  <field>layout</field>
  <field>sections</field>
  <field>dependencies</field>
  <field>responsiveBranches</field>
</pageMap>

<sectionMap>
  <field>sectionId</field>
  <field>semanticRole</field>
  <field>startPosition</field>
  <field>endPosition</field>
  <field>stickyBehavior</field>
  <field>scrollBehavior</field>
  <field>background</field>
  <field>contentSlots</field>
  <field>animations</field>
</sectionMap>

<componentMap>
  <field>componentId</field>
  <field>suggestedName</field>
  <field>type</field>
  <field>props</field>
  <field>contentBindings</field>
  <field>visualStates</field>
  <field>responsiveBehavior</field>
  <field>animationBindings</field>
  <field>classification</field>
</componentMap>

<designTokens>
  <tokenGroup>Colors</tokenGroup>
  <tokenGroup>Typography</tokenGroup>
  <tokenGroup>Spacing</tokenGroup>
  <tokenGroup>Radius</tokenGroup>
  <tokenGroup>Shadows</tokenGroup>
  <tokenGroup>Blur</tokenGroup>
  <tokenGroup>Z-index</tokenGroup>
  <tokenGroup>Breakpoints</tokenGroup>
  <tokenGroup>Motion</tokenGroup>
</designTokens>

<frameByFrameAnalysis>
  <description>
    Animações vinculadas ao tempo ou scroll deverão ser observadas em múltiplos pontos,
    permitindo reconstruir estados intermediários em vez de apenas início e fim.
  </description>

  <defaultCheckpoints>
    <checkpoint>0%</checkpoint>
    <checkpoint>10%</checkpoint>
    <checkpoint>20%</checkpoint>
    <checkpoint>30%</checkpoint>
    <checkpoint>40%</checkpoint>
    <checkpoint>50%</checkpoint>
    <checkpoint>60%</checkpoint>
    <checkpoint>70%</checkpoint>
    <checkpoint>80%</checkpoint>
    <checkpoint>90%</checkpoint>
    <checkpoint>100%</checkpoint>
  </defaultCheckpoints>

  <capturedMetrics>
    <metric>Scroll position</metric>
    <metric>Bounding box</metric>
    <metric>Transform matrix</metric>
    <metric>Translate</metric>
    <metric>Scale</metric>
    <metric>Rotation</metric>
    <metric>Opacity</metric>
    <metric>Blur</metric>
    <metric>Clip path</metric>
    <metric>Mask</metric>
    <metric>Computed styles</metric>
    <metric>Canvas frame</metric>
    <metric>WebGL frame</metric>
    <metric>Loaded resources</metric>
  </capturedMetrics>
</frameByFrameAnalysis>

<animationSpecification>
  <fields>
    <field>animationId</field>
    <field>target</field>
    <field>trigger</field>
    <field>initialState</field>
    <field>finalState</field>
    <field>duration</field>
    <field>delay</field>
    <field>easing</field>
    <field>stagger</field>
    <field>scrollStart</field>
    <field>scrollEnd</field>
    <field>scrub</field>
    <field>pin</field>
    <field>mobileOverride</field>
    <field>reducedMotionBehavior</field>
    <field>classification</field>
  </fields>

  <example><![CDATA[
```

{
"animationId": "hero-title-reveal",
"target": "[data-hero-title]",
"trigger": {
"type": "page-load",
"delayMs": 400
},
"initialState": {
"opacity": 0,
"translateY": 60,
"rotateX": -8,
"blurPx": 12
},
"finalState": {
"opacity": 1,
"translateY": 0,
"rotateX": 0,
"blurPx": 0
},
"durationMs": 1100,
"easing": "cubic-bezier(0.16, 1, 0.3, 1)",
"staggerSeconds": 0.06,
"classification": "reconstructed"
}
]]></example>

```
  <scrollExample><![CDATA[
```

{
"animationId": "cards-scroll-sequence",
"target": "[data-feature-card]",
"trigger": {
"type": "scroll",
"start": "top 75%",
"end": "bottom 35%",
"scrub": true
},
"initialState": {
"opacity": 0,
"translateY": 80,
"scale": 0.94
},
"finalState": {
"opacity": 1,
"translateY": 0,
"scale": 1
},
"staggerSeconds": 0.12
}
]]></scrollExample> </animationSpecification>

```
<classificationValues>
  <classification id="captured">
    Recurso original autorizado preservado.
  </classification>

  <classification id="reconstructed">
    Comportamento reconstruído em código editável.
  </classification>

  <classification id="approximated">
    Resultado visual ou comportamental aproximado.
  </classification>

  <classification id="external">
    Recurso permanece dependente de origem externa.
  </classification>

  <classification id="blocked">
    Acesso impedido por proteção, autorização ou indisponibilidade.
  </classification>

  <classification id="missing">
    Recurso esperado não localizado.
  </classification>

  <classification id="unexercised">
    Estado não testado durante a execução.
  </classification>
</classificationValues>
```

  </experienceBlueprint>

  <editableWebsiteKit>
    <description>
      O Editable Website Kit será uma versão organizada da experiência, preparada para que
      um criador altere conteúdo e identidade sem precisar modificar a lógica principal.
    </description>

```
<editableProperties>
  <property>Nome da marca</property>
  <property>Logo</property>
  <property>Copy</property>
  <property>Headlines</property>
  <property>Descrições</property>
  <property>Imagens</property>
  <property>Vídeos</property>
  <property>Áudios</property>
  <property>Cores</property>
  <property>Fontes</property>
  <property>Links</property>
  <property>Cards</property>
  <property>Produtos</property>
  <property>Depoimentos</property>
  <property>Modelos 3D</property>
  <property>Texturas</property>
  <property>Intensidade de animação</property>
  <property>Duração das animações</property>
  <property>Velocidade de scroll</property>
  <property>Ordem das seções</property>
  <property>Visibilidade das seções</property>
</editableProperties>

<contentSeparation>
  <requiredFiles>
    <file>src/content/site-content.ts</file>
    <file>src/content/navigation.ts</file>
    <file>src/content/products.ts</file>
    <file>src/config/brand.ts</file>
    <file>src/config/theme.ts</file>
    <file>src/config/motion.ts</file>
    <file>src/config/media.ts</file>
    <file>src/config/scene.ts</file>
  </requiredFiles>

  <example><![CDATA[
```

export const siteContent = {
brand: {
name: 'Minha empresa',
logo: '/assets/images/logo.svg',
},

hero: {
eyebrow: 'Nova experiência',
title: 'Crie produtos digitais extraordinários',
description:
'Uma nova copy aplicada à mesma estrutura visual e narrativa.',
image: '/assets/images/new-hero.webp',
video: '/assets/videos/new-product.mp4',
},

cards: [
{
id: 'card-01',
title: 'Novo título',
description: 'Nova descrição',
image: '/assets/images/card-01.webp',
},
],
};
]]></example> </contentSeparation>

```
<recommendedComponents>
  <component>Navbar</component>
  <component>Hero</component>
  <component>AnimatedText</component>
  <component>FeatureCard</component>
  <component>HorizontalScroll</component>
  <component>StickySection</component>
  <component>VideoSection</component>
  <component>AudioSection</component>
  <component>ThreeScene</component>
  <component>ProductShowcase</component>
  <component>Testimonials</component>
  <component>CTA</component>
  <component>Footer</component>
  <component>PageTransition</component>
  <component>Preloader</component>
</recommendedComponents>

<componentExample><![CDATA[
```

<AnimatedCard
title="Novo produto"
description="Nova descrição"
image="/assets/images/product.webp"
animationPreset="rise-blur"
animationDelay={0.2}
/>
]]></componentExample>

```
<animationArchitecture>
  <requiredFolders>
    <folder>src/animations/presets/</folder>
    <folder>src/animations/timelines/</folder>
    <folder>src/animations/scroll/</folder>
    <folder>src/animations/transitions/</folder>
    <folder>src/animations/tokens/</folder>
  </requiredFolders>

  <rule>
    Configurações de animação não deverão ficar espalhadas sem documentação dentro dos componentes.
  </rule>

  <rule>
    Cada animação deverá possuir nome, trigger, duração, easing, dependências,
    comportamento mobile e fallback de movimento reduzido.
  </rule>
</animationArchitecture>

<visualEditingMode phase="future">
  <features>
    <feature>Editar textos.</feature>
    <feature>Substituir imagens.</feature>
    <feature>Substituir vídeos.</feature>
    <feature>Selecionar GLB ou GLTF.</feature>
    <feature>Alterar cores.</feature>
    <feature>Alterar fontes.</feature>
    <feature>Ativar e desativar seções.</feature>
    <feature>Reordenar seções.</feature>
    <feature>Ajustar intensidade de animações.</feature>
    <feature>Visualizar desktop e mobile.</feature>
    <feature>Exportar projeto.</feature>
  </features>
</visualEditingMode>
```

  </editableWebsiteKit>

  <threeDimensionalExperience>
    <capturedModelScenario>
      <condition>
        O navegador recebe arquivos GLB, GLTF, BIN, HDR, KTX, Draco, WASM,
        texturas, shaders ou outros recursos 3D públicos e autorizados.
      </condition>

```
  <capabilities>
    <capability>Preservar o modelo.</capability>
    <capability>Preservar texturas.</capability>
    <capability>Preservar environment maps.</capability>
    <capability>Registrar câmera.</capability>
    <capability>Registrar iluminação.</capability>
    <capability>Registrar materiais.</capability>
    <capability>Registrar pós-processamento.</capability>
    <capability>Registrar interação com scroll.</capability>
    <capability>Registrar interação com mouse e toque.</capability>
    <capability>Registrar animações internas.</capability>
  </capabilities>
</capturedModelScenario>

<unavailableModelScenario>
  <condition>
    O modelo original não é entregue publicamente, está bloqueado ou não pode ser preservado.
  </condition>

  <fallbacks>
    <fallback>Analisar screenshots.</fallback>
    <fallback>Analisar gravações.</fallback>
    <fallback>Estimar geometria e materiais.</fallback>
    <fallback>Criar modelo equivalente.</fallback>
    <fallback>Gerar placeholder 3D.</fallback>
    <fallback>Utilizar Blender proceduralmente.</fallback>
    <fallback>Recomendar modelagem manual para alta complexidade.</fallback>
  </fallbacks>

  <mandatoryClassification>reconstructed ou approximated</mandatoryClassification>
</unavailableModelScenario>

<sceneBlueprintExample><![CDATA[
```

{
"engine": "three.js",
"renderer": {
"alpha": true,
"antialias": true,
"toneMapping": "ACESFilmic"
},
"camera": {
"type": "perspective",
"position": [0, 0.4, 5.2],
"fov": 32
},
"model": {
"source": "/assets/models/product.glb",
"scale": [1.2, 1.2, 1.2],
"position": [0, -0.6, 0],
"classification": "captured"
},
"interaction": {
"type": "scroll-rotation",
"rotationY": [0, 3.14],
"scrollStart": 0.15,
"scrollEnd": 0.75
}
}
]]></sceneBlueprintExample> </threeDimensionalExperience>

  <serviceWorkersAndCache>
    <requirements>
      <requirement>Detectar registros de Service Worker.</requirement>
      <requirement>Registrar script e escopo.</requirement>
      <requirement>Identificar respostas vindas de cache.</requirement>
      <requirement>Executar teste com cache limpo.</requirement>
      <requirement>Executar teste com cache aquecido.</requirement>
      <requirement>Impedir controle de paths fora do projeto local.</requirement>
      <requirement>Documentar comportamentos dependentes da origem.</requirement>
    </requirements>

```
<securityRule>
  Um Service Worker da origem não poderá ser reutilizado silenciosamente se puder controlar
  caminhos externos ao projeto local.
</securityRule>
```

  </serviceWorkersAndCache>

  <mediaServing>
    <requirements>
      <requirement>Suporte a Range requests.</requirement>
      <requirement>Resposta 206 Partial Content.</requirement>
      <requirement>Content-Range correto.</requirement>
      <requirement>Accept-Ranges bytes.</requirement>
      <requirement>Content-Length correto.</requirement>
      <requirement>MIME type correto.</requirement>
      <requirement>Streaming de arquivos grandes.</requirement>
      <requirement>HEAD requests.</requirement>
    </requirements>
  </mediaServing>

  <localServer>
    <defaultHost>127.0.0.1</defaultHost>
    <defaultPort>4173</defaultPort>
    <spaFallbackDefault>false</spaFallbackDefault>

```
<servingContractExample><![CDATA[
```

{
"host": "127.0.0.1",
"port": 4173,
"routes": [
{
"requestPath": "/",
"file": "mirror/pages/index.html",
"contentType": "text/html"
},
{
"requestPath": "/produto",
"file": "mirror/pages/produto.html",
"contentType": "text/html"
}
],
"querySensitiveAssets": true,
"byteRangeSupport": true,
"spaFallback": false
}
]]></servingContractExample>

```
<behavior>
  <rule>Retornar 404 real para arquivos inexistentes.</rule>
  <rule>Não esconder arquivos ausentes com fallback genérico.</rule>
  <rule>Preservar redirects necessários.</rule>
  <rule>Aplicar tabela explícita de MIME types.</rule>
  <rule>Registrar acessos e falhas.</rule>
  <rule>Impedir path traversal.</rule>
</behavior>
```

  </localServer>

  <commandLineInterface>
    <command name="init">
      <syntax>ntmirror init</syntax>
      <description>Inicializa projeto, autorização e configuração.</description>
    </command>

```
<command name="doctor">
  <syntax>ntmirror doctor</syntax>
  <description>Valida ambiente e dependências.</description>
</command>

<command name="bootstrap">
  <syntax>ntmirror bootstrap</syntax>
  <description>Instala dependências locais.</description>
</command>

<command name="scope">
  <syntax>ntmirror scope --url https://exemplo.com</syntax>
  <description>Cria ou atualiza o escopo.</description>
</command>

<command name="discover">
  <syntax>ntmirror discover</syntax>
  <description>Executa descoberta inicial.</description>
</command>

<command name="capture">
  <syntax>ntmirror capture</syntax>
  <description>Executa captura autorizada.</description>
</command>

<command name="captureHeaded">
  <syntax>ntmirror capture --headed</syntax>
  <description>Executa com navegador visível.</description>
</command>

<command name="captureRoutes">
  <syntax>ntmirror capture --routes /,/produto,/sobre</syntax>
  <description>Captura rotas específicas.</description>
</command>

<command name="blueprint">
  <syntax>ntmirror blueprint</syntax>
  <description>Gera Experience Blueprint.</description>
</command>

<command name="recreate">
  <syntax>ntmirror recreate</syntax>
  <description>Inicia Editable Recreation.</description>
</command>

<command name="serve">
  <syntax>ntmirror serve</syntax>
  <description>Inicia servidor local.</description>
</command>

<command name="validate">
  <syntax>ntmirror validate</syntax>
  <description>Executa validação online local.</description>
</command>

<command name="validateOffline">
  <syntax>ntmirror validate --offline</syntax>
  <description>Executa validação com rede externa bloqueada.</description>
</command>

<command name="report">
  <syntax>ntmirror report</syntax>
  <description>Gera relatório e handoff.</description>
</command>

<command name="run">
  <syntax>ntmirror run --config mirror.config.yaml --authorization authorization.yaml</syntax>
  <description>Executa o pipeline completo.</description>
</command>
```

  </commandLineInterface>

  <configuration>
    <mirrorConfigExample><![CDATA[
project:
  name: exemplo-mirror
  output_dir: ./output

source:
url: https://exemplo.com
authorized_domains:
- exemplo.com
- [www.exemplo.com](http://www.exemplo.com)
- cdn.exemplo.com

mode:
preferred: static-mirror
fallback: editable-recreation

routes:
include:
- /
- /produto
- /sobre
exclude:
- /admin
- /checkout

viewports:

* name: desktop
  width: 1440
  height: 900
* name: tablet
  width: 834
  height: 1112
* name: mobile
  width: 390
  height: 844

capture:
service_workers: inspect
web_workers: true
lazy_assets: true
dynamic_imports: true
media: true
webgl: true
audio: true
video: true
max_depth: 3
rate_limit_requests_per_second: 4
max_total_download_gb: 20

interactions:
scroll: true
hover: true
click_safe_elements: true
forms: disabled
media_playback: true

validation:
visual: true
network: true
console: true
interactions: true
responsive: true
offline: true
]]></mirrorConfigExample>

```
<authorizationYamlExample><![CDATA[
```

project_name: site-cliente
authorization_type: client-approved

source:
primary_domain: exemplo.com

authorized_domains:

* exemplo.com
* [www.exemplo.com](http://www.exemplo.com)
* cdn.exemplo.com

authorized_routes:

* /
* /produto
* /sobre

authorized_actions:
static_asset_capture: true
route_capture: true
interaction_capture: true
authenticated_capture: false
third_party_assets: false

authorized_by:
name: João da Silva
role: Diretor de tecnologia
company: Empresa Exemplo
email: [joao@exemplo.com](mailto:joao@exemplo.com)

valid_from: 2026-07-24
valid_until: 2026-08-24
]]></authorizationYamlExample> </configuration>

  <installation>
    <windows>
      <strategy>WSL 2 with Ubuntu</strategy>

```
  <rules>
    <rule>Não particionar o disco automaticamente.</rule>
    <rule>Não configurar dual boot.</rule>
    <rule>Não substituir o Windows.</rule>
    <rule>Não desativar antivírus.</rule>
    <rule>Não desativar firewall.</rule>
    <rule>Não armazenar senha.</rule>
    <rule>Solicitar privilégios administrativos somente quando necessário.</rule>
    <rule>Informar quando reinicialização for necessária.</rule>
  </rules>

  <installerPath>install/windows/install-wsl.ps1</installerPath>

  <referenceCommands><![CDATA[
```

wsl --install -d Ubuntu
wsl --update
wsl --set-default-version 2
wsl --list --verbose
]]></referenceCommands>

```
  <postRestartExample><![CDATA[
```

wsl -d Ubuntu -- bash -lc "
cd /tmp &&
curl -fsSL https://DOMINIO_OFICIAL/ntmirror/bootstrap.sh -o bootstrap.sh &&
echo 'CHECKSUM_ESPERADO  bootstrap.sh' | sha256sum -c - &&
chmod +x bootstrap.sh &&
./bootstrap.sh
"
]]></postRestartExample>

```
  <requirements>
    <requirement>Verificar checksum ou assinatura do bootstrap.</requirement>
    <requirement>Gerar log local.</requirement>
    <requirement>Oferecer comando de desinstalação.</requirement>
    <requirement>Continuar instalação após reinicialização.</requirement>
  </requirements>
</windows>

<linux>
  <bootstrapPath>scripts/bootstrap.sh</bootstrapPath>

  <packages><![CDATA[
```

sudo apt-get update

sudo apt-get install -y 
git 
curl 
wget 
unzip 
jq 
ca-certificates 
build-essential 
python3 
python3-venv 
python3-pip 
ffmpeg 
imagemagick 
sqlite3
]]></packages>

```
  <nodeSetup><![CDATA[
```

corepack enable
npm ci
npx playwright install --with-deps chromium
]]></nodeSetup>

```
  <rules>
    <rule>Utilizar versão de Node definida pelo projeto.</rule>
    <rule>Registrar versões em runtime-versions.lock.</rule>
    <rule>Evitar depender de pacotes globais desconhecidos.</rule>
  </rules>
</linux>

<docker>
  <requiredForMVP>false</requiredForMVP>
  <recommended>true</recommended>

  <requirements>
    <requirement>Imagem versionada.</requirement>
    <requirement>Execução sem root quando possível.</requirement>
    <requirement>Volumes explícitos.</requirement>
    <requirement>Limites de CPU e memória.</requirement>
    <requirement>Rede externa configurável.</requirement>
  </requirements>
</docker>
```

  </installation>

  <projectStructure>
    <tree><![CDATA[
nt-site-mirror-project/
├── authorization.yaml
├── mirror.config.yaml
├── package.json
├── package-lock.json
├── README.md
├── LAUNCH.md
├── REPORT.md
├── KNOWN-GAPS.md
├── DEPENDENCIES.md
├── AUTHORIZATION-SUMMARY.md
│
├── capture/
│   ├── manifest.json
│   ├── serving-contract.json
│   ├── runtime-map.json
│   ├── dependency-map.json
│   ├── redirects.json
│   ├── hashes.sha256
│   ├── acquisition-records.jsonl
│   ├── har/
│   ├── traces/
│   ├── logs/
│   ├── screenshots/
│   ├── recordings/
│   └── snapshots/
│
├── experience-blueprint/
│   ├── pages.json
│   ├── sections.json
│   ├── components.json
│   ├── animations.json
│   ├── scroll-map.json
│   ├── responsive-map.json
│   ├── design-tokens.json
│   ├── three-scene.json
│   ├── media.json
│   └── dependencies.json
│
├── mirror/
│   ├── pages/
│   ├── assets/
│   ├── workers/
│   ├── media/
│   ├── models/
│   └── external-placeholders/
│
├── server/
│   ├── index.ts
│   ├── routes.ts
│   ├── mime.ts
│   ├── range.ts
│   ├── security.ts
│   └── logger.ts
│
├── recreation/
│   ├── src/
│   │   ├── components/
│   │   ├── sections/
│   │   ├── animations/
│   │   ├── scenes/
│   │   ├── content/
│   │   ├── config/
│   │   ├── styles/
│   │   └── assets/
│   └── RECONSTRUCTION-MAP.md
│
├── tests/
│   ├── routes.spec.ts
│   ├── interactions.spec.ts
│   ├── media.spec.ts
│   ├── webgl.spec.ts
│   ├── responsive.spec.ts
│   ├── network.spec.ts
│   └── offline.spec.ts
│
├── agents/
│   ├── guardian/
│   ├── environment-bootstrap/
│   ├── scope-planner/
│   ├── runtime-scout/
│   ├── route-and-state-explorer/
│   ├── asset-acquisition/
│   ├── webgl-and-media-specialist/
│   ├── experience-blueprint-builder/
│   ├── local-runtime-engineer/
│   ├── recreation-engineer/
│   ├── qa-and-evidence/
│   └── handoff-reporter/
│
├── scripts/
│   ├── bootstrap.sh
│   ├── doctor.sh
│   ├── capture.sh
│   ├── serve.sh
│   ├── validate.sh
│   └── cleanup-secrets.sh
│
└── install/
    ├── windows/
    │   └── install-wsl.ps1
    └── linux/
        └── install.sh
    ]]></tree>
  </projectStructure>

  <skillStructure>
    <tree><![CDATA[
nt-site-mirror/
├── SKILL.md
├── README.md
├── agents/
│   ├── guardian.md
│   ├── environment-bootstrap.md
│   ├── scope-planner.md
│   ├── runtime-scout.md
│   ├── route-and-state-explorer.md
│   ├── asset-acquisition.md
│   ├── webgl-and-media.md
│   ├── experience-blueprint.md
│   ├── local-runtime.md
│   ├── recreation.md
│   ├── qa-evidence.md
│   └── handoff.md
├── templates/
│   ├── authorization.yaml
│   ├── mirror.config.yaml
│   ├── capture-plan.yaml
│   ├── manifest.schema.json
│   ├── serving-contract.schema.json
│   ├── experience-blueprint.schema.json
│   └── report-template.md
├── scripts/
├── server/
├── validators/
├── install/
│   ├── windows/
│   └── linux/
└── docs/
    ]]></tree>
  </skillStructure>

  <manifest>
    <captureManifestExample><![CDATA[
{
  "captureId": "cap_2026_07_24_001",
  "projectId": "ntm_project_001",
  "startedAt": "2026-07-24T14:00:00-03:00",
  "completedAt": "2026-07-24T14:42:00-03:00",
  "source": "https://exemplo.com",
  "authorizationHash": "sha256:HASH",
  "toolVersion": "1.0.0",
  "browser": {
    "name": "chromium",
    "version": "VERSION"
  },
  "routesDeclared": 3,
  "routesExercised": 3,
  "interactionsDeclared": 12,
  "interactionsExercised": 11,
  "requestsObserved": 482,
  "resourcesLocal": 401,
  "resourcesExternal": 52,
  "resourcesBlocked": 11,
  "resourcesFailed": 18,
  "acceptanceLevel": "experience-validated"
}
    ]]></captureManifestExample>

```
<assetRecordExample><![CDATA[
```

{
"sourceUrl": "https://cdn.exemplo.com/hero.mp4?v=3",
"localPath": "mirror/assets/cdn.exemplo.com/video/hero__q_91e20a31.mp4",
"status": 200,
"contentType": "video/mp4",
"sizeBytes": 14823091,
"sha256": "HASH",
"acquisitionMethod": "browser-response",
"routeDiscovered": "/",
"interactionDiscovered": "initial-load",
"redirectChain": [],
"classification": "captured"
}
]]></assetRecordExample> </manifest>

  <validation>
    <visualValidation>
      <requirement>Comparar origem e local nos viewports declarados.</requirement>
      <requirement>Comparar estados intermediários de animação.</requirement>
      <requirement>Comparar composição, posição, dimensão e tipografia.</requirement>
      <requirement>Comparar comportamento de scroll.</requirement>
      <requirement>Comparar cenas 3D e frames de mídia.</requirement>
    </visualValidation>

```
<technicalValidation>
  <requirement>Projeto inicia pelo comando documentado.</requirement>
  <requirement>Rotas respondem corretamente.</requirement>
  <requirement>Não existem arquivos locais críticos ausentes.</requirement>
  <requirement>Erros introduzidos pelo mirror são identificados.</requirement>
  <requirement>Console é analisado.</requirement>
  <requirement>Network failures são analisadas.</requirement>
  <requirement>Byte ranges são testados.</requirement>
  <requirement>Service Worker é testado separadamente.</requirement>
  <requirement>Offline é validado em execução independente.</requirement>
</technicalValidation>

<offlineValidation>
  <description>
    A validação offline deverá bloquear conexões externas e não poderá ser confundida
    com um simples teste depois que o navegador já carregou recursos externos.
  </description>

  <requirements>
    <requirement>Iniciar nova sessão de navegador.</requirement>
    <requirement>Limpar ou isolar caches.</requirement>
    <requirement>Bloquear rede externa.</requirement>
    <requirement>Executar as rotas declaradas.</requirement>
    <requirement>Registrar cada dependência externa tentada.</requirement>
  </requirements>
</offlineValidation>
```

  </validation>

  <acceptanceLevels>
    <level id="L0" name="Failed">
      O projeto não inicia localmente.
    </level>

```
<level id="L1" name="FirstRender">
  A primeira tela é exibida, mas estados adicionais ainda não foram validados.
</level>

<level id="L2" name="RouteValidated">
  As rotas declaradas iniciam sem arquivos locais críticos ausentes.
</level>

<level id="L3" name="ExperienceValidated">
  Interações, animações, scroll, mídia e estados principais foram validados.
</level>

<level id="L4" name="OfflineValidated">
  A experiência declarada funciona em execução separada com rede externa bloqueada.
</level>

<level id="LR" name="RecreatedAndValidated">
  A experiência foi reconstruída e validada sem alegar recuperação do runtime original.
</level>

<level id="LP" name="Partial">
  A entrega possui valor técnico, mas contém lacunas relevantes documentadas.
</level>
```

  </acceptanceLevels>

  <functionalRequirements>
    <requirement id="FR-001">Gerar autorização por assistente.</requirement>
    <requirement id="FR-002">Validar controle de domínio.</requirement>
    <requirement id="FR-003">Preparar Linux ou WSL 2.</requirement>
    <requirement id="FR-004">Abrir website em navegador real.</requirement>
    <requirement id="FR-005">Registrar rede por rota.</requirement>
    <requirement id="FR-006">Executar interações declaradas.</requirement>
    <requirement id="FR-007">Descobrir recursos carregados após scroll.</requirement>
    <requirement id="FR-008">Capturar dynamic imports.</requirement>
    <requirement id="FR-009">Capturar workers e Service Workers.</requirement>
    <requirement id="FR-010">Capturar mídia e arquivos 3D.</requirement>
    <requirement id="FR-011">Armazenar recursos com hashes.</requirement>
    <requirement id="FR-012">Gerar servidor local.</requirement>
    <requirement id="FR-013">Suportar byte range.</requirement>
    <requirement id="FR-014">Gerar Experience Blueprint.</requirement>
    <requirement id="FR-015">Gerar Editable Website Kit.</requirement>
    <requirement id="FR-016">Separar conteúdo de componentes.</requirement>
    <requirement id="FR-017">Reconstruir animações principais.</requirement>
    <requirement id="FR-018">Reconstruir ou substituir cenas 3D.</requirement>
    <requirement id="FR-019">Validar desktop e mobile.</requirement>
    <requirement id="FR-020">Executar validação offline.</requirement>
    <requirement id="FR-021">Gerar relatório e evidências.</requirement>
    <requirement id="FR-022">Bloquear origens fora do escopo.</requirement>
    <requirement id="FR-023">Mascarar segredos.</requirement>
    <requirement id="FR-024">Permitir retomada após falha.</requirement>
  </functionalRequirements>

  <nonFunctionalRequirements>
    <security>
      <requirement>Princípio de menor privilégio.</requirement>
      <requirement>Execução local por padrão.</requirement>
      <requirement>Sandbox para código desconhecido.</requirement>
      <requirement>Limites de CPU, RAM, disco e rede.</requirement>
      <requirement>Allowlist de domínios.</requirement>
      <requirement>Redaction de segredos.</requirement>
      <requirement>Logs auditáveis.</requirement>
      <requirement>Proteção contra path traversal.</requirement>
      <requirement>Sem publicação automática.</requirement>
    </security>

```
<performance>
  <requirement>Captura retomável.</requirement>
  <requirement>Downloads paralelos limitados.</requirement>
  <requirement>Deduplicação por hash.</requirement>
  <requirement>Cache local controlado.</requirement>
  <requirement>Retomada de arquivos grandes.</requirement>
  <requirement>Limite configurável por projeto.</requirement>
</performance>

<reproducibility>
  <requirement>Lockfile.</requirement>
  <requirement>Versão do navegador registrada.</requirement>
  <requirement>Versão do runtime registrada.</requirement>
  <requirement>Imagem Docker versionada quando utilizada.</requirement>
  <requirement>Hashes dos arquivos.</requirement>
  <requirement>Comandos determinísticos.</requirement>
</reproducibility>

<observability>
  <requirement>Logs estruturados.</requirement>
  <requirement>Progresso por agente.</requirement>
  <requirement>Contagem de recursos.</requirement>
  <requirement>Recursos pendentes.</requirement>
  <requirement>Tempo por rota.</requirement>
  <requirement>Motivo de cada falha.</requirement>
  <requirement>Status da pipeline.</requirement>
</observability>

<accessibility>
  <requirement>Preservar semântica quando observável.</requirement>
  <requirement>Preservar navegação por teclado quando aplicável.</requirement>
  <requirement>Implementar prefers-reduced-motion na reconstrução.</requirement>
  <requirement>Registrar problemas de contraste ou foco encontrados.</requirement>
</accessibility>
```

  </nonFunctionalRequirements>

  <technologyStack>
    <core>
      <technology>Node.js</technology>
      <technology>TypeScript</technology>
      <technology>Playwright</technology>
      <technology>Chrome DevTools Protocol</technology>
      <technology>Shell Script</technology>
      <technology>PowerShell</technology>
      <technology>SQLite</technology>
      <technology>JSON</technology>
      <technology>JSONL</technology>
      <technology>YAML</technology>
      <technology>FFmpeg</technology>
      <technology>FFprobe</technology>
    </core>

```
<recreation>
  <technology>React</technology>
  <technology>Vite</technology>
  <technology>CSS</technology>
  <technology>GSAP</technology>
  <technology>Three.js</technology>
</recreation>

<testing>
  <technology>Playwright Test</technology>
  <technology>Visual comparison</technology>
  <technology>Network interception</technology>
  <technology>Offline browser contexts</technology>
</testing>

<packaging>
  <technology>npm</technology>
  <technology>Docker</technology>
  <technology>Ubuntu</technology>
  <technology>WSL 2</technology>
</packaging>
```

  </technologyStack>

  <mvpAcceptanceCriteria>
    <criterion id="MVP-001">Receber URL e autorização.</criterion>
    <criterion id="MVP-002">Preparar ambiente Linux ou WSL.</criterion>
    <criterion id="MVP-003">Abrir site com Chromium.</criterion>
    <criterion id="MVP-004">Capturar rede por rota.</criterion>
    <criterion id="MVP-005">Detectar recursos carregados após scroll.</criterion>
    <criterion id="MVP-006">Armazenar recursos com hash.</criterion>
    <criterion id="MVP-007">Criar servidor local.</criterion>
    <criterion id="MVP-008">Servir HTML, CSS, JS, imagens e fontes.</criterion>
    <criterion id="MVP-009">Suportar vídeo com byte range.</criterion>
    <criterion id="MVP-010">Validar desktop e mobile.</criterion>
    <criterion id="MVP-011">Registrar erros de console.</criterion>
    <criterion id="MVP-012">Executar validação offline.</criterion>
    <criterion id="MVP-013">Gerar Experience Blueprint inicial.</criterion>
    <criterion id="MVP-014">Gerar relatório.</criterion>
    <criterion id="MVP-015">Interromper captura fora da allowlist.</criterion>
    <criterion id="MVP-016">Mascarar tokens e cookies.</criterion>
    <criterion id="MVP-017">Classificar o resultado corretamente.</criterion>
  </mvpAcceptanceCriteria>

  <metrics>
    <technicalMetrics>
      <metric>Percentual de rotas exercitadas.</metric>
      <metric>Percentual de interações exercitadas.</metric>
      <metric>Percentual de recursos localizados.</metric>
      <metric>Percentual de dependências externas.</metric>
      <metric>Quantidade de arquivos ausentes.</metric>
      <metric>Quantidade de erros introduzidos pelo mirror.</metric>
      <metric>Taxa de aprovação dos testes.</metric>
      <metric>Diferença visual média.</metric>
      <metric>Tempo para primeira execução local.</metric>
      <metric>Taxa de reprodução em outra máquina.</metric>
    </technicalMetrics>

```
<honestyMetrics>
  <metric>Estados não exercitados corretamente declarados.</metric>
  <metric>Dependências externas corretamente classificadas.</metric>
  <metric>Ausência de falsos resultados de completude.</metric>
  <metric>Rastreabilidade entre arquivo e origem.</metric>
  <metric>Evidência presente para cada nível de aceitação.</metric>
</honestyMetrics>

<productMetrics>
  <metric>Tempo para trocar identidade visual.</metric>
  <metric>Tempo para substituir copy.</metric>
  <metric>Tempo para substituir vídeo.</metric>
  <metric>Tempo para substituir modelo 3D.</metric>
  <metric>Percentual de componentes editáveis.</metric>
  <metric>Percentual de animações reutilizáveis.</metric>
</productMetrics>
```

  </metrics>

  <risks>
    <risk id="R-001">
      <name>Promessa de recuperação total</name>
      <impact>Alta</impact>
      <mitigation>
        Diferenciar claramente código entregue ao navegador, código reconstruído e código privado inexistente.
      </mitigation>
    </risk>

```
<risk id="R-002">
  <name>Dependências externas protegidas</name>
  <impact>Alta</impact>
  <mitigation>Classificar, documentar e substituir por mocks ou alternativas.</mitigation>
</risk>

<risk id="R-003">
  <name>Sites com comportamento anti-automação</name>
  <impact>Média</impact>
  <mitigation>Não contornar proteções e solicitar ambiente ou autorização adequada.</mitigation>
</risk>

<risk id="R-004">
  <name>Captura incompleta de recursos tardios</name>
  <impact>Alta</impact>
  <mitigation>Exploração por estados, scroll, cache limpo e cache aquecido.</mitigation>
</risk>

<risk id="R-005">
  <name>Recriação visualmente semelhante, mas comportamentalmente incorreta</name>
  <impact>Alta</impact>
  <mitigation>Validação quadro a quadro e testes de interação.</mitigation>
</risk>

<risk id="R-006">
  <name>Arquivos muito grandes</name>
  <impact>Média</impact>
  <mitigation>Limites configuráveis, streaming, retomada e avisos de armazenamento.</mitigation>
</risk>

<risk id="R-007">
  <name>Vazamento de tokens ou cookies</name>
  <impact>Crítica</impact>
  <mitigation>Redaction, armazenamento temporário, criptografia e limpeza automática.</mitigation>
</risk>

<risk id="R-008">
  <name>Service Worker interferindo em outros projetos</name>
  <impact>Alta</impact>
  <mitigation>Escopo isolado, profiles separados e validação explícita.</mitigation>
</risk>
```

  </risks>

  <roadmap>
    <phase id="PH-001" name="MVP">
      <deliverables>
        <deliverable>Chromium.</deliverable>
        <deliverable>Rotas declaradas.</deliverable>
        <deliverable>Captura de rede.</deliverable>
        <deliverable>HTML, CSS, JS, imagens e fontes.</deliverable>
        <deliverable>Servidor local.</deliverable>
        <deliverable>Relatório.</deliverable>
        <deliverable>WSL 2.</deliverable>
        <deliverable>Desktop e mobile.</deliverable>
      </deliverables>
    </phase>

```
<phase id="PH-002" name="RuntimeAdvanced">
  <deliverables>
    <deliverable>Service Workers.</deliverable>
    <deliverable>Web Workers.</deliverable>
    <deliverable>Dynamic imports.</deliverable>
    <deliverable>Queries.</deliverable>
    <deliverable>Multi-route avançado.</deliverable>
    <deliverable>Áudio e vídeo.</deliverable>
    <deliverable>Byte ranges.</deliverable>
    <deliverable>Cache-state testing.</deliverable>
  </deliverables>
</phase>

<phase id="PH-003" name="ComplexExperiences">
  <deliverables>
    <deliverable>WebGL.</deliverable>
    <deliverable>Three.js.</deliverable>
    <deliverable>GLB e GLTF.</deliverable>
    <deliverable>Draco.</deliverable>
    <deliverable>KTX.</deliverable>
    <deliverable>HDR.</deliverable>
    <deliverable>WASM.</deliverable>
    <deliverable>Virtual scrolling.</deliverable>
    <deliverable>Cenas interativas.</deliverable>
  </deliverables>
</phase>

<phase id="PH-004" name="EditableRecreation">
  <deliverables>
    <deliverable>Análise visual.</deliverable>
    <deliverable>Reconstrução por seções.</deliverable>
    <deliverable>Experience Blueprint completo.</deliverable>
    <deliverable>Componentes editáveis.</deliverable>
    <deliverable>Content separation.</deliverable>
    <deliverable>Comparação automática.</deliverable>
    <deliverable>Mocks de integrações.</deliverable>
  </deliverables>
</phase>

<phase id="PH-005" name="VisualEditor">
  <deliverables>
    <deliverable>Painel local.</deliverable>
    <deliverable>Edição de textos.</deliverable>
    <deliverable>Troca de mídia.</deliverable>
    <deliverable>Troca de modelos 3D.</deliverable>
    <deliverable>Configuração de animações.</deliverable>
    <deliverable>Reordenação de seções.</deliverable>
    <deliverable>Exportação.</deliverable>
  </deliverables>
</phase>

<phase id="PH-006" name="CommercialProduct">
  <deliverables>
    <deliverable>Interface visual completa.</deliverable>
    <deliverable>Fila de projetos.</deliverable>
    <deliverable>Histórico.</deliverable>
    <deliverable>Permissões.</deliverable>
    <deliverable>Armazenamento seguro.</deliverable>
    <deliverable>Painel de evidências.</deliverable>
    <deliverable>Workers isolados.</deliverable>
  </deliverables>
</phase>
```

  </roadmap>

  <definitionOfDone>
    <criterion>Autorização válida.</criterion>
    <criterion>Escopo declarado.</criterion>
    <criterion>Projeto inicia pelo comando documentado.</criterion>
    <criterion>Rotas declaradas testadas.</criterion>
    <criterion>Sem arquivos locais críticos ausentes.</criterion>
    <criterion>Experience Blueprint gerado.</criterion>
    <criterion>Manifesto gerado.</criterion>
    <criterion>Hashes gerados.</criterion>
    <criterion>Dependências externas informadas.</criterion>
    <criterion>Estados não exercitados informados.</criterion>
    <criterion>Nível de aceitação informado.</criterion>
    <criterion>Instruções de reprodução incluídas.</criterion>
    <criterion>Sem cookies, tokens ou credenciais.</criterion>
    <criterion>Sem alegação de recuperação de código privado.</criterion>
    <criterion>Conteúdo editável separado quando houver Recreation.</criterion>
    <criterion>Animações principais validadas.</criterion>
    <criterion>Desktop e mobile validados.</criterion>
    <criterion>Mídia e cenas 3D verificadas quando aplicáveis.</criterion>
  </definitionOfDone>

  <completionMessageTemplate>
    <template><![CDATA[
Captura concluída.

Classificação: Experience Validated
Método: Static Mirror
Rotas declaradas: 4
Rotas validadas: 4
Viewports validados: 2
Interações declaradas: 12
Interações validadas: 11
Recursos locais: 438
Dependências externas: 17
Recursos bloqueados: 3
Estados não exercitados: 1
Offline validado: não

Comando de inicialização:
npm ci && npm run mirror:serve

Consulte:

* REPORT.md
* KNOWN-GAPS.md
* DEPENDENCIES.md
* capture/manifest.json
* experience-blueprint/
  ]]></template> </completionMessageTemplate>

  <finalProductStatement>
    <statement>
      O NT Site Mirror Agent Team deverá transformar uma URL autorizada em uma investigação
      técnica completa, um baseline local reproduzível e, quando solicitado, uma versão editável
      capaz de preservar a essência da experiência.
    </statement>

    <statement>
      O produto deverá permitir que criadores substituam marca, copy, imagens, vídeos, fontes,
      cores, modelos 3D e conteúdo, sem perder as animações, interações, narrativa por scroll,
      transições e comportamento responsivo que tornam a referência especial.
    </statement>

    <statement>
      A confiança no produto virá não de promessas de cópia perfeita, mas de um processo
      transparente de observação, captura, reconstrução, comparação, correção e validação.
    </statement>
  </finalProductStatement>

</prd>
