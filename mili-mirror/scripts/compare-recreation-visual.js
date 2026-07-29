#!/usr/bin/env node
// QAAndEvidence (A-011) for Editable Recreation — PH-004 "comparação visual":
// gera um sinal APROXIMADO de similaridade estrutural entre os screenshots do
// mirror original (capture/screenshots) e os da Recreation (recreation/validation).
// Não é prova de captura completa (CP-001 EvidenceOverAppearance) e NÃO afeta a
// classificação LR/LP — é evidência suplementar registrada em KNOWN-GAPS/REPORT.
// Usage: node scripts/compare-recreation-visual.js --config mirror.config.yaml [--output recreation]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createCleanContext } from '../browser/context-factory.js';
import { resolveBrowserPolicy } from '../browser/browser-policy.js';
import { ensureDir, isoNow, parseArgs, requireScopeLock, resolveProject, writeJson } from './lib/config.js';
import { EXIT, failWith } from './lib/exit-codes.js';
import { resolveWithin } from './lib/safe-path.js';

async function compareOne(page, originalPath, recreationPath) {
  const originalB64 = fs.readFileSync(originalPath).toString('base64');
  const recreationB64 = fs.readFileSync(recreationPath).toString('base64');

  return page.evaluate(
    async ({ originalB64, recreationB64 }) => {
      function loadImage(base64) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Falha ao decodificar screenshot para comparação.'));
          img.src = `data:image/png;base64,${base64}`;
        });
      }

      const [original, recreation] = await Promise.all([loadImage(originalB64), loadImage(recreationB64)]);
      const width = Math.min(original.naturalWidth, recreation.naturalWidth);
      const height = Math.min(original.naturalHeight, recreation.naturalHeight);
      if (width === 0 || height === 0) {
        return { comparable: false, reason: 'Uma das imagens tem dimensão zero.' };
      }

      const canvasA = document.createElement('canvas');
      canvasA.width = width;
      canvasA.height = height;
      const ctxA = canvasA.getContext('2d');
      ctxA.drawImage(original, 0, 0, width, height);
      const dataA = ctxA.getImageData(0, 0, width, height).data;

      const canvasB = document.createElement('canvas');
      canvasB.width = width;
      canvasB.height = height;
      const ctxB = canvasB.getContext('2d');
      ctxB.drawImage(recreation, 0, 0, width, height);
      const dataB = ctxB.getImageData(0, 0, width, height).data;

      const pixelCount = width * height;
      const threshold = 32; // diferença média por canal (0-255) para contar o pixel como "diferente"
      let sumAbsDiff = 0;
      let diffPixels = 0;
      let sumA = 0;
      let sumSqA = 0;
      for (let i = 0; i < dataA.length; i += 4) {
        const dr = Math.abs(dataA[i] - dataB[i]);
        const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
        const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
        const meanDiff = (dr + dg + db) / 3;
        sumAbsDiff += meanDiff;
        if (meanDiff > threshold) diffPixels += 1;
        const luma = (dataA[i] + dataA[i + 1] + dataA[i + 2]) / 3;
        sumA += luma;
        sumSqA += luma * luma;
      }

      // Detecta referência "achatada" (tela preta/preloader/quase sólida): quando o
      // desvio padrão de luminância do original é muito baixo, ele não é uma referência
      // visual utilizável (CP-001 EvidenceOverAppearance) — o score não deve ser lido
      // como "recreation ruim" nesse caso, e sim como "referência sem conteúdo".
      const meanA = sumA / pixelCount;
      const varianceA = sumSqA / pixelCount - meanA * meanA;
      const stdDevA = Math.sqrt(Math.max(varianceA, 0));
      const referenceLikelyBlank = stdDevA < 8;

      return {
        comparable: true,
        comparedWidth: width,
        comparedHeight: height,
        originalDimensions: { width: original.naturalWidth, height: original.naturalHeight },
        recreationDimensions: { width: recreation.naturalWidth, height: recreation.naturalHeight },
        meanAbsoluteDifference: Number((sumAbsDiff / pixelCount / 255).toFixed(4)),
        diffPixelRatio: Number((diffPixels / pixelCount).toFixed(4)),
        structuralSimilarity: Number((1 - diffPixels / pixelCount).toFixed(4)),
        originalLumaStdDev: Number(stdDevA.toFixed(2)),
        referenceLikelyBlank,
      };
    },
    { originalB64, recreationB64 },
  );
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.config) {
    failWith(EXIT.INVALID_CONFIG, 'Uso: node scripts/compare-recreation-visual.js --config <mirror.config.yaml> [--output recreation]');
  }
  const project = resolveProject(args.config);
  const scope = requireScopeLock(project);
  const outputName = args.output ? String(args.output) : 'recreation';
  const outputResolution = resolveWithin(project.outputDir, outputName);
  if (outputResolution.ok === false) {
    failWith(EXIT.INVALID_CONFIG, `Diretório de Recreation inválido: ${outputResolution.reason}.`);
    return;
  }
  const recreationRoot = outputResolution.abs;
  const validationDir = path.join(recreationRoot, 'validation');
  if (!fs.existsSync(validationDir)) {
    failWith(EXIT.INVALID_CONFIG, 'Nenhuma validação de Recreation encontrada. Execute scripts/validate-recreation.js primeiro.');
  }

  const viewports = scope.viewports?.length
    ? scope.viewports
    : [
        { name: 'desktop', width: 1440, height: 900 },
        { name: 'mobile', width: 390, height: 844 },
      ];

  const policy = resolveBrowserPolicy(project.config);
  const browser = await chromium.launch({ headless: policy.acquisition.headless });
  const comparisons = [];
  try {
    const context = await createCleanContext(browser, { viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto('about:blank');
    for (const viewport of viewports) {
      const originalPath = path.join(project.dirs.screenshots, `index-${viewport.name}.png`);
      const recreationPath = path.join(validationDir, `${viewport.name}.png`);
      if (!fs.existsSync(originalPath) || !fs.existsSync(recreationPath)) {
        comparisons.push({
          viewport: viewport.name,
          comparable: false,
          reason: !fs.existsSync(originalPath) ? 'Screenshot original ausente (capture/screenshots).' : 'Screenshot da Recreation ausente.',
        });
        continue;
      }
      const result = await compareOne(page, originalPath, recreationPath);
      comparisons.push({ viewport: viewport.name, originalPath, recreationPath, ...result });
    }
    await context.close();
  } finally {
    await browser.close();
  }

  const comparable = comparisons.filter((item) => item.comparable);
  const report = {
    generatedAt: isoNow(),
    method: 'canvas-pixel-diff-approximate',
    note:
      'Sinal aproximado de similaridade estrutural (dimensões comuns, diferença média por pixel). ' +
      'NÃO é prova de captura completa (CP-001) e NÃO altera a classificação LR/LP. Quando ' +
      'referenceLikelyBlank for true, o screenshot original está achatado (ex.: preloader/tela ' +
      'preta de uma captura L0) e o score não deve ser lido como qualidade da Recreation.',
    comparisons,
    averageStructuralSimilarity: comparable.length
      ? Number((comparable.reduce((sum, item) => sum + item.structuralSimilarity, 0) / comparable.length).toFixed(4))
      : null,
    anyReferenceLikelyBlank: comparable.some((item) => item.referenceLikelyBlank === true),
  };
  ensureDir(validationDir);
  writeJson(path.join(validationDir, 'visual-comparison.json'), report);

  console.log('\n[COMPARE:VISUAL] Comparação aproximada gerada (evidência suplementar, não gate).');
  for (const item of comparisons) {
    if (!item.comparable) {
      console.log(`  ${item.viewport}: não comparável — ${item.reason}`);
      continue;
    }
    const blankWarning = item.referenceLikelyBlank
      ? ' [AVISO: screenshot original parece em branco/preloader — score não reflete a Recreation]'
      : '';
    console.log(
      `  ${item.viewport}: similaridade estrutural ${(item.structuralSimilarity * 100).toFixed(1)}% (${item.comparedWidth}x${item.comparedHeight}, original ${item.originalDimensions.width}x${item.originalDimensions.height}, recreation ${item.recreationDimensions.width}x${item.recreationDimensions.height})${blankWarning}`,
    );
  }
  console.log(`  Relatório: ${path.join(validationDir, 'visual-comparison.json')}`);
}

main().catch((error) => failWith(EXIT.INTERNAL_ERROR, `[COMPARE:VISUAL] Falha fatal: ${error.message}`));
