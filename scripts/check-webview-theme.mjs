#!/usr/bin/env node
/**
 * Fails when a webview stylesheet introduces a colour literal instead of a VS Code
 * theme variable.
 *
 *   npm run lint:theme            # check, exit 1 on new literals
 *   npm run lint:theme -- --update   # accept the current findings into the baseline
 *
 * A literal is reported when it appears outside a `var(--vscode-…, fallback)` group,
 * e.g. `background-color: #fff` or `color: rgba(255, 255, 255, 0.1)`.
 *
 * Reviewed exceptions are listed in scripts/webview-theme-baseline.json. Adding an
 * entry there should be a deliberate decision (a shadow, a scrim over a coloured
 * surface, a brand fill with matching foreground), not a way to silence the check.
 * Entries that no longer match anything are reported as stale warnings.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const baselinePath = join(projectRoot, 'scripts', 'webview-theme-baseline.json');
const shouldUpdate = process.argv.includes('--update');

/** Colours that need a theme variable; anything else (none, transparent, currentColor) is fine. */
const COLOUR_PROPERTIES =
  /^(color|background|background-color|background-image|border|border-[a-z]+|border-[a-z]+-color|fill|stroke|outline|outline-color|caret-color|accent-color|text-decoration-color|column-rule|column-rule-color)$/;

/** Depth cues that carry no colour meaning on their own. */
const EXEMPT_PROPERTIES = new Set(['box-shadow', 'text-shadow']);

const COLOUR_LITERAL =
  /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black|silver|gray|grey|lightgray|lightgrey|darkgray|darkgrey|whitesmoke|gainsboro|red|green|blue|orange|yellow|purple|pink|brown|cyan|magenta|gold|beige|ivory|navy|teal|olive|maroon|lime|aqua|fuchsia)\b/;

const SKIP_PATHS = [/[/\\]node_modules[/\\]/, /[/\\]dist[/\\]/, /\.map$/];

function collectStylesheets(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (SKIP_PATHS.some((pattern) => pattern.test(full))) {
      continue;
    }
    const info = statSync(full);
    if (info.isDirectory()) {
      collectStylesheets(full, found);
    } else if (entry.endsWith('.css')) {
      found.push(full);
    }
  }
  return found.sort();
}

/**
 * Parses flat CSS (with at-rule nesting) into declarations carrying their innermost
 * selector, joining values that span several lines.
 */
function parseDeclarations(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations = [];
  const stack = [];
  let selectorBuffer = '';
  let declarationBuffer = '';
  let parens = 0;

  const flushDeclaration = () => {
    const text = declarationBuffer.trim();
    declarationBuffer = '';
    if (!text) {
      return;
    }
    const split = text.indexOf(':');
    if (split === -1) {
      return;
    }
    const property = text.slice(0, split).trim();
    const value = text.slice(split + 1).trim();
    const selector = [...stack].reverse().find((entry) => !entry.startsWith('@')) ?? '';
    declarations.push({ selector, property, value });
  };

  for (const character of source) {
    if (character === '(') {
      parens += 1;
    } else if (character === ')') {
      parens = Math.max(0, parens - 1);
    }

    if (stack.length === 0) {
      if (character === '{') {
        stack.push(selectorBuffer.trim());
        selectorBuffer = '';
      } else {
        selectorBuffer += character;
      }
      continue;
    }

    if (character === '{') {
      // Nested block: the pending buffer is a nested selector (or an at-rule prelude).
      flushNestedSelector();
      continue;
    }

    if (character === '}') {
      flushDeclaration();
      stack.pop();
      continue;
    }

    if (character === ';' && parens === 0) {
      flushDeclaration();
      continue;
    }

    declarationBuffer += character;
  }

  function flushNestedSelector() {
    const nested = declarationBuffer.trim();
    declarationBuffer = '';
    stack.push(nested);
  }

  return declarations;
}

/** Replaces `var(--vscode-…)` groups so their fallback literals do not count. */
function maskVscodeVariables(value) {
  let masked = '';
  let index = 0;

  while (index < value.length) {
    const start = value.indexOf('var(', index);
    if (start === -1) {
      masked += value.slice(index);
      break;
    }
    masked += value.slice(index, start);

    let depth = 0;
    let end = start + 3;
    for (; end < value.length; end += 1) {
      if (value[end] === '(') {
        depth += 1;
      } else if (value[end] === ')') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }

    const group = value.slice(start, end);
    masked += group.includes('--vscode-') ? 'var()' : group;
    index = end;
  }

  // `rgba(var(--vscode-token-rgb, 0, 0, 0), 0.1)` derives its colour from the theme,
  // so it is not a literal. Drop the channel arguments to keep the alpha only.
  return masked.replace(/rgba?\(var\(\),/g, 'rgba(');
}

const normaliseValue = (value) => value.replace(/\s+/g, ' ').trim();
const entryKey = (file, selector, property, value) =>
  [relative(projectRoot, file), selector, property, normaliseValue(value)].join(' :: ');

async function readBaseline() {
  try {
    return JSON.parse(await readFile(baselinePath, 'utf8'));
  } catch {
    return { entries: [] };
  }
}

function findOffenders(file) {
  const css = readFile(file, 'utf8');
  return css.then((contents) =>
    parseDeclarations(contents).flatMap(({ selector, property, value }) => {
      if (!COLOUR_PROPERTIES.test(property) || EXEMPT_PROPERTIES.has(property)) {
        return [];
      }
      if (!COLOUR_LITERAL.test(maskVscodeVariables(value))) {
        return [];
      }
      return [{ file, key: entryKey(file, selector, property, value), selector, property, value }];
    })
  );
}

async function main() {
  const files = collectStylesheets(resolve(projectRoot, 'src'));
  const baseline = await readBaseline();
  const allowed = new Set(baseline.entries ?? []);
  const seen = new Set();
  const offenders = [];

  for (const file of files) {
    for (const offender of await findOffenders(file)) {
      seen.add(offender.key);
      if (!allowed.has(offender.key)) {
        offenders.push(offender);
      }
    }
  }

  const stale = [...allowed].filter((entry) => !seen.has(entry));

  if (shouldUpdate) {
    const entries = [...seen].sort();
    await writeFile(baselinePath, `${JSON.stringify({ entries }, null, 2)}\n`);
    console.log(`[lint:theme] Baseline updated with ${entries.length} reviewed exception(s).`);
    return;
  }

  if (offenders.length > 0) {
    console.error('[lint:theme] Colour literals need a --vscode-* variable:\n');
    for (const offender of offenders) {
      console.error(`  ${relative(projectRoot, offender.file)}`);
      console.error(`    ${offender.selector} { ${offender.property}: ${offender.value} }`);
    }
    console.error(
      `\n${offenders.length} new literal(s). Use var(--vscode-<token>, <fallback>) so the webview follows` +
        ' both light and dark themes. If the literal is a reviewed exception (shadow, scrim over a' +
        ' coloured surface, brand fill with matching foreground), add it deliberately with' +
        ' `npm run lint:theme -- --update` and say why in review.'
    );
    process.exit(1);
  }

  if (stale.length > 0) {
    console.warn(
      `[lint:theme] ${stale.length} baseline entr${stale.length === 1 ? 'y is' : 'ies are'} stale` +
        ' (the literal is gone). Refresh with `npm run lint:theme -- --update`.'
    );
  }

  console.log(`[lint:theme] ${files.length} stylesheets checked, no new colour literals.`);
}

await main();
