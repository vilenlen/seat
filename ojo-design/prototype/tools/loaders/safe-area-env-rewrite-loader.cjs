const ts = require('typescript');

const SAFE_AREA_TOP_RE = /env\(\s*safe-area-inset-top\s*(?:,[^)]+)?\)/g;
const SAFE_AREA_BOTTOM_RE = /env\(\s*safe-area-inset-bottom\s*(?:,[^)]+)?\)/g;
const STYLE_KEYS = new Set([
  'padding',
  'paddingTop',
  'paddingBottom',
  'top',
  'bottom',
  'inset',
  'insetTop',
  'insetBottom',
]);

const replaceSafeAreaEnv = (text) =>
  text
    .replace(SAFE_AREA_TOP_RE, 'var(--safe-area-inset-top)')
    .replace(SAFE_AREA_BOTTOM_RE, 'var(--safe-area-inset-bottom)');

const getPropertyName = (nameNode) => {
  if (!nameNode) return '';
  if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode)) {
    return nameNode.text;
  }
  return '';
};

const isClassContext = (node) => {
  let current = node;
  while (current) {
    if (ts.isJsxAttribute(current)) {
      const attrName = current.name?.text;
      if (attrName === 'className' || attrName === 'class') {
        return true;
      }
    }
    if (ts.isPropertyAssignment(current)) {
      const propName = getPropertyName(current.name);
      if (propName === 'className' || propName === 'class') {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
};

const isStyleContext = (node) => {
  if (isClassContext(node)) {
    return false;
  }

  let current = node;
  while (current) {
    if (ts.isJsxAttribute(current) && current.name?.text === 'style') {
      return true;
    }
    if (ts.isPropertyAssignment(current)) {
      const propName = getPropertyName(current.name);
      if (propName === 'style' || STYLE_KEYS.has(propName)) {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
};

const shouldRewriteNode = (node) => !isClassContext(node);

module.exports = function safeAreaEnvRewriteLoader(source) {
  if (typeof source !== 'string' || !source.includes('safe-area-inset-')) {
    return source;
  }

  const scriptKind = this.resourcePath?.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : this.resourcePath?.endsWith('.ts')
      ? ts.ScriptKind.TS
      : this.resourcePath?.endsWith('.jsx')
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.JS;

  const sourceFile = ts.createSourceFile(
    this.resourcePath || 'source.js',
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );

  const edits = [];
  const visit = (node) => {
    const isStringLike = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
    if (isStringLike && node.text.includes('safe-area-inset-') && shouldRewriteNode(node)) {
      const start = node.getStart(sourceFile) + 1;
      const end = node.end - 1;
      const raw = source.slice(start, end);
      const next = replaceSafeAreaEnv(raw);
      if (next !== raw) {
        edits.push({ start, end, replacement: next });
      }
    }
    if (ts.isTemplateExpression(node) && shouldRewriteNode(node)) {
      if (node.head.text.includes('safe-area-inset-')) {
        const headStart = node.head.getStart(sourceFile) + 1;
        const headEnd = node.head.end - 2;
        const headRaw = source.slice(headStart, headEnd);
        const headNext = replaceSafeAreaEnv(headRaw);
        if (headNext !== headRaw) {
          edits.push({ start: headStart, end: headEnd, replacement: headNext });
        }
      }

      for (const span of node.templateSpans) {
        if (!span.literal.text.includes('safe-area-inset-')) {
          continue;
        }
        const literalStart = span.literal.getStart(sourceFile) + 1;
        const literalEnd = span.literal.end - 1;
        const literalRaw = source.slice(literalStart, literalEnd);
        const literalNext = replaceSafeAreaEnv(literalRaw);
        if (literalNext !== literalRaw) {
          edits.push({ start: literalStart, end: literalEnd, replacement: literalNext });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (edits.length === 0) {
    return source;
  }

  edits.sort((a, b) => b.start - a.start);
  let output = source;
  for (const edit of edits) {
    output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
  }

  return output;
};
