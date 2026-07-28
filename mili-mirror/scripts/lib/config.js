// Shared config, YAML and path helpers.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const eq = token.indexOf('=');
    if (eq !== -1) {
      args[token.slice(2, eq)] = token.slice(eq + 1);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      args[token.slice(2)] = argv[i + 1];
      i += 1;
    } else {
      args[token.slice(2)] = true;
    }
  }
  return args;
}

export function loadYaml(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Arquivo não encontrado: ${abs}`);
  }
  return YAML.parse(fs.readFileSync(abs, 'utf8'));
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function appendJsonl(filePath, record) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Resolves the project root (directory containing mirror.config.yaml)
 * and the standard output directories defined by the PRD project tree.
 */
export function resolveProject(configPath) {
  const root = path.dirname(path.resolve(configPath));
  const config = loadYaml(configPath);
  const outputDir = path.resolve(root, config?.project?.output_dir || '.');
  // output_dir must stay confined to the project root (central path safety)
  const rel = path.relative(root, outputDir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Configuração inválida: project.output_dir escapa da raiz do projeto (${config?.project?.output_dir}).`);
  }
  return {
    root,
    config,
    outputDir,
    dirs: {
      capture: path.join(outputDir, 'capture'),
      mirror: path.join(outputDir, 'mirror'),
      mirrorPages: path.join(outputDir, 'mirror', 'pages'),
      mirrorAssets: path.join(outputDir, 'mirror', 'assets'),
      blueprint: path.join(outputDir, 'experience-blueprint'),
      logs: path.join(outputDir, 'capture', 'logs'),
      screenshots: path.join(outputDir, 'capture', 'screenshots'),
      snapshots: path.join(outputDir, 'capture', 'snapshots'),
      recordings: path.join(outputDir, 'capture', 'recordings'),
      traces: path.join(outputDir, 'capture', 'traces'),
    },
    files: {
      scopeLock: path.join(outputDir, 'scope.lock.json'),
      authHash: path.join(outputDir, 'authorization.hash'),
      manifest: path.join(outputDir, 'capture', 'manifest.json'),
      servingContract: path.join(outputDir, 'capture', 'serving-contract.json'),
      acquisitionRecords: path.join(outputDir, 'capture', 'acquisition-records.jsonl'),
      hashes: path.join(outputDir, 'capture', 'hashes.sha256'),
      validationResults: path.join(outputDir, 'capture', 'validation-results.json'),
    },
  };
}

export function requireScopeLock(project) {
  if (!fs.existsSync(project.files.scopeLock)) {
    throw new Error(
      'scope.lock.json não encontrado. Execute primeiro: node scripts/guardian.js --config <mirror.config.yaml> --authorization <authorization.yaml>',
    );
  }
  const scope = JSON.parse(fs.readFileSync(project.files.scopeLock, 'utf8'));
  if (scope.status !== 'approved') {
    throw new Error(`Escopo não aprovado (status: ${scope.status}). Execução bloqueada pelo Guardian.`);
  }
  return scope;
}

export function isoNow() {
  return new Date().toISOString();
}

export function sanitizePathname(pathname) {
  const clean = pathname
    .replace(/^\/+/, '')
    .replace(/[<>:"|?*\\]/g, '_')
    .replaceAll('/', '_');
  return clean === '' ? 'index' : clean;
}

/** Maps a route path to its mirror/pages html file (relative to outputDir). */
export function routeToPageFile(routePath) {
  const clean = sanitizePathname(routePath);
  if (clean === 'index') return path.join('mirror', 'pages', 'index.html');
  if (clean.endsWith('.html')) return path.join('mirror', 'pages', clean);
  return path.join('mirror', 'pages', `${clean}.html`);
}
