// Runtime validators (Milestone: Core Hardening).
// Real consumers for the ACTIVE schemas in schemas/. Schemas without a consumer
// live in schemas/future/ (see schemas/future/README.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Ajv 2020-12 build: includes the draft 2020-12 meta-schema declared by our schemas
const Ajv2020 = /** @type {any} */ (require('ajv/dist/2020.js'));

const SCHEMAS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'schemas');

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });

function loadSchema(name) {
  const file = path.join(SCHEMAS_ROOT, name);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const compiled = new Map();
function getValidator(name) {
  if (!compiled.has(name)) {
    compiled.set(name, ajv.compile(loadSchema(name)));
  }
  return compiled.get(name);
}

/**
 * @typedef {object} ValidationResult
 * @property {boolean} valid
 * @property {Array<{path:string, message:string}>} errors
 */

function run(schemaName, document) {
  const validate = getValidator(schemaName);
  const valid = validate(document);
  const errors = (validate.errors || []).map((err) => ({
    path: err.instancePath || '(raiz)',
    message: `${err.instancePath || '(raiz)'} ${err.message}`.trim(),
  }));
  return { valid, errors };
}

/**
 * @param {object} document parsed mirror.config.yaml
 * @returns {ValidationResult}
 */
export function validateMirrorConfig(document) {
  return run('mirror-config.schema.json', document);
}

/**
 * @param {object} document parsed capture/serving-contract.json
 * @returns {ValidationResult}
 */
export function validateServingContract(document) {
  return run('serving-contract.schema.json', document);
}

/**
 * @param {object} document parsed capture/manifest.json
 * @returns {ValidationResult}
 */
export function validateManifest(document) {
  return run('manifest.schema.json', document);
}

/**
 * Formats validation errors for CLI output.
 * @param {string} label
 * @param {Array<{path:string, message:string}>} errors
 * @returns {string}
 */
export function formatValidationErrors(label, errors) {
  return [`${label} inválido(a):`, ...errors.map((e) => `  - ${e.message}`)].join('\n');
}
