// Centralized CLI exit codes (Milestone: Core Hardening).
// Every command returns a coherent code, never masks an earlier failure and
// never exits successfully after an error. Codes are part of the CLI contract:
// automated tests assert on them.

/**
 * @enum {number}
 */
export const EXIT = Object.freeze({
  SUCCESS: 0,
  INVALID_CONFIG: 2,
  AUTHORIZATION_DENIED: 3,
  DOMAIN_BLOCKED: 4,
  CAPTURE_FAILED: 5,
  VALIDATION_FAILED: 6,
  DEPENDENCY_MISSING: 7,
  INTERNAL_ERROR: 8,
  PARTIAL_RESULT: 9,
});

const LABELS = {
  [EXIT.SUCCESS]: 'sucesso',
  [EXIT.INVALID_CONFIG]: 'configuração inválida',
  [EXIT.AUTHORIZATION_DENIED]: 'autorização negada',
  [EXIT.DOMAIN_BLOCKED]: 'domínio bloqueado',
  [EXIT.CAPTURE_FAILED]: 'captura falhou',
  [EXIT.VALIDATION_FAILED]: 'validação falhou',
  [EXIT.DEPENDENCY_MISSING]: 'dependência ausente',
  [EXIT.INTERNAL_ERROR]: 'erro interno',
  [EXIT.PARTIAL_RESULT]: 'resultado parcial',
};

/**
 * @param {number} code
 * @returns {string}
 */
export function exitLabel(code) {
  return LABELS[code] || `desconhecido(${code})`;
}

/**
 * Fails the current process with a coherent code and a registered cause.
 * Use instead of bare process.exit(1).
 * @param {number} code EXIT code (never SUCCESS)
 * @param {string} cause human-readable reason, written to stderr
 */
export function failWith(code, cause) {
  if (code === EXIT.SUCCESS) throw new Error('failWith não aceita SUCCESS');
  console.error(`[exit ${code} — ${exitLabel(code)}] ${cause}`);
  process.exit(code);
}
