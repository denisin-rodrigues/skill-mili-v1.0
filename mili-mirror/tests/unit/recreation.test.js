import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import {
  createRecreationProject,
  renderBrandModule,
  renderContentModule,
  renderIndexHtml,
  updateRecreationContent,
  validateRecreationPlan,
} from '../../scripts/lib/recreation.js';

const roots = [];
const templateRoot = path.resolve('templates/recreation-studio');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mili-recreation-'));
  roots.push(root);
  return root;
}

function plan(overrides = {}) {
  return {
    version: 1,
    activationReason: 'Mirror L0; usuário solicitou uma versão editável.',
    brand: {
      name: 'Laboratório',
      accent: '#ffd600',
      ink: '#101010',
      paper: '#ffffff',
    },
    navigation: [{ label: 'Estúdio', href: '#studio' }],
    hero: {
      eyebrow: 'Digital studio',
      titleLines: ['The Gold', 'Standard'],
      subtitleLines: ['Smooth Digital', 'Production'],
    },
    about: {
      eyebrow: 'Who we are',
      statement: 'Uma experiência editável.',
    },
    contact: {
      prompt: 'Vamos criar algo?',
      label: 'Contato',
      href: 'mailto:hello@example.com',
    },
    evidence: [
      {
        component: 'Hero',
        classification: 'approximated',
        source: 'capture/snapshots/index.html',
        note: 'Composição reconstruída a partir do conteúdo observado.',
      },
    ],
    assets: [],
    ...overrides,
  };
}

function project(root) {
  return {
    outputDir: root,
    config: { source: { url: 'https://example.com/' } },
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

test('valida plano e gera módulos editáveis separados', () => {
  const input = plan();
  assert.equal(validateRecreationPlan(input), input);
  assert.match(renderContentModule(input), /The Gold/);
  assert.match(renderBrandModule(input), /#ffd600/);
  assert.match(renderIndexHtml(input), /<title>Laboratório<\/title>/);
});

test('aceita projetos editáveis e declara a nova seção no estado', () => {
  const root = makeRoot();
  const input = plan({
    work: { eyebrow: 'Selected work', title: 'Projetos em colaboração.' },
    projects: [
      {
        title: 'Projeto Um',
        slug: 'projeto-um',
        client: 'Cliente',
        year: '2026',
        summary: 'Uma descrição pública do projeto.',
        disciplines: ['Design', 'Frontend'],
        colors: { primary: '#ff6600', secondary: '#101010' },
      },
    ],
  });

  const result = createRecreationProject({ project: project(root), plan: input, templateRoot });

  assert.deepEqual(result.state.scope, ['header', 'hero', 'about', 'projects']);
  assert.equal(result.state.projectCount, 1);
  assert.equal(result.state.notImplemented.includes('projects'), false);
  assert.match(fs.readFileSync(path.join(root, 'recreation', 'src', 'content', 'site-content.ts'), 'utf8'), /Projeto Um/);
});

test('gera projeto executável, estado e mapa de evidências', () => {
  const root = makeRoot();
  fs.mkdirSync(path.join(root, 'mirror', 'fonts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'mirror', 'fonts', 'display.woff2'), 'font-bytes');
  const input = plan({
    assets: [
      {
        source: 'mirror/fonts/display.woff2',
        target: 'fonts/butter-display.woff2',
        classification: 'captured',
      },
    ],
  });

  const result = createRecreationProject({ project: project(root), plan: input, templateRoot });

  assert.equal(result.state.mode, 'hybrid');
  assert.deepEqual(result.state.scope, ['header', 'hero', 'about']);
  assert.equal(result.state.assets.length, 1);
  assert.ok(fs.existsSync(path.join(root, 'recreation', 'src', 'App.tsx')));
  assert.ok(fs.existsSync(path.join(root, 'recreation', 'src', 'content', 'site-content.ts')));
  assert.equal(fs.readFileSync(path.join(root, 'recreation', 'public', 'fonts', 'butter-display.woff2'), 'utf8'), 'font-bytes');
  assert.match(fs.readFileSync(path.join(root, 'recreation', 'RECONSTRUCTION-MAP.md'), 'utf8'), /approximated/);
});

test('recusa escape de asset e nunca sobrescreve saída existente', () => {
  const root = makeRoot();
  assert.throws(
    () =>
      createRecreationProject({
        project: project(root),
        plan: plan({
          assets: [{ source: '../secret', target: 'fonts/x.woff2', classification: 'reconstructed' }],
        }),
        templateRoot,
      }),
    /fora da raiz autorizada/,
  );

  fs.mkdirSync(path.join(root, 'recreation'), { recursive: true });
  fs.writeFileSync(path.join(root, 'recreation', 'user-file.txt'), 'preserve');
  assert.throws(
    () => createRecreationProject({ project: project(root), plan: plan(), templateRoot }),
    /Nada foi sobrescrito/,
  );
  assert.equal(fs.readFileSync(path.join(root, 'recreation', 'user-file.txt'), 'utf8'), 'preserve');
});

test('conecta rotas de case quando image/imageAlt/detail são declarados juntos', () => {
  const root = makeRoot();
  const input = plan({
    work: { eyebrow: 'Selected work', title: 'Casos em destaque.' },
    projects: [
      {
        title: 'Projeto Caso',
        slug: 'projeto-caso',
        client: 'Cliente',
        year: '2026',
        summary: 'Resumo público.',
        disciplines: ['Design'],
        colors: { primary: '#ff6600', secondary: '#101010' },
        image: '/projects/projeto-caso.jpg',
        imageAlt: 'Arte do projeto caso',
        detail: 'História pública do projeto.',
      },
    ],
    assets: [{ source: 'recreation-media/projeto-caso.jpg', target: 'projects/projeto-caso.jpg', classification: 'captured' }],
  });
  fs.mkdirSync(path.join(root, 'recreation-media'), { recursive: true });
  fs.writeFileSync(path.join(root, 'recreation-media', 'projeto-caso.jpg'), 'jpg-bytes');

  const result = createRecreationProject({ project: project(root), plan: input, templateRoot });

  assert.deepEqual(result.state.caseRoutes, ['/work/projeto-caso']);
  assert.deepEqual(result.state.cases, [{ slug: 'projeto-caso', title: 'Projeto Caso', image: '/projects/projeto-caso.jpg' }]);
  assert.equal(result.state.notImplemented.includes('case-routes'), false);
});

test('updateRecreationContent atualiza conteúdo/estado sem tocar no scaffold', () => {
  const root = makeRoot();
  const initial = plan();
  createRecreationProject({ project: project(root), plan: initial, templateRoot });
  const appTsxPath = path.join(root, 'recreation', 'src', 'App.tsx');
  const originalAppTsx = fs.readFileSync(appTsxPath, 'utf8');

  const updated = plan({
    work: { eyebrow: 'Selected work', title: 'Casos em destaque.' },
    projects: [
      {
        title: 'Projeto Caso',
        slug: 'projeto-caso',
        client: 'Cliente',
        year: '2026',
        summary: 'Resumo público.',
        disciplines: ['Design'],
        colors: { primary: '#ff6600', secondary: '#101010' },
        image: '/projects/projeto-caso.jpg',
        imageAlt: 'Arte do projeto caso',
        detail: 'História pública do projeto.',
      },
    ],
    assets: [{ source: 'recreation-media/projeto-caso.jpg', target: 'projects/projeto-caso.jpg', classification: 'captured' }],
  });
  fs.mkdirSync(path.join(root, 'recreation-media'), { recursive: true });
  fs.writeFileSync(path.join(root, 'recreation-media', 'projeto-caso.jpg'), 'jpg-bytes');

  const result = updateRecreationContent({ project: project(root), plan: updated });

  assert.deepEqual(result.state.caseRoutes, ['/work/projeto-caso']);
  assert.equal(result.state.notImplemented.includes('case-routes'), false);
  assert.equal(fs.readFileSync(appTsxPath, 'utf8'), originalAppTsx);
  assert.match(fs.readFileSync(path.join(root, 'recreation', 'src', 'content', 'site-content.ts'), 'utf8'), /Projeto Caso/);
  assert.equal(fs.readFileSync(path.join(root, 'recreation', 'public', 'projects', 'projeto-caso.jpg'), 'utf8'), 'jpg-bytes');
});

test('updateRecreationContent recusa Recreation inexistente', () => {
  const root = makeRoot();
  assert.throws(
    () => updateRecreationContent({ project: project(root), plan: plan() }),
    /Execute scripts\/recreate\.js primeiro/,
  );
});

test('rejeita classificação falsa ou plano incompleto', () => {
  assert.throws(
    () =>
      validateRecreationPlan(
        plan({
          evidence: [
            {
              component: 'Hero',
              classification: 'captured',
              source: 'x',
              note: 'x',
            },
          ],
        }),
      ),
    /reconstructed ou approximated/,
  );
  assert.throws(
    () =>
      validateRecreationPlan(
        plan({
          work: { eyebrow: 'Work', title: 'Projetos' },
          projects: [
            {
              title: 'Incompleto',
              slug: 'incompleto',
              client: 'Cliente',
              year: '2026',
              summary: 'Sem disciplinas.',
              disciplines: [],
              colors: { primary: '#fff', secondary: '#000' },
            },
          ],
        }),
      ),
    /projects\[0\]\.disciplines/,
  );
  assert.throws(() => validateRecreationPlan({ version: 1 }), /activationReason/);
});
