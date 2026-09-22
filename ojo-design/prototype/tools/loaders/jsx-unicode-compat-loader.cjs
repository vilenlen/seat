const ts = require('typescript');

const UNICODE_ESCAPE_RE = /(?<!\\)\\u([0-9a-fA-F]{4})/g;

const decodeUnicodeEscape = (text) =>
  text.replace(UNICODE_ESCAPE_RE, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

module.exports = function jsxUnicodeCompatLoader(source) {
  if (typeof source !== 'string' || source.indexOf('\\u') === -1) {
    return source;
  }

  const resourcePath = this.resourcePath || '';
  const isJsxLike = /\.(tsx|jsx)$/.test(resourcePath);
  if (!isJsxLike) {
    return source;
  }

  const scriptKind = resourcePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX;
  const sf = ts.createSourceFile(resourcePath, source, ts.ScriptTarget.Latest, true, scriptKind);
  const edits = [];

  const queueDecodedEdit = (start, end) => {
    const original = source.slice(start, end);
    const decoded = decodeUnicodeEscape(original);
    if (decoded !== original) {
      edits.push({ start, end, replacement: decoded });
    }
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const start = node.getStart(sf, false);
      const end = node.end;
      queueDecodedEdit(start, end);
    }

    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      const start = node.initializer.getStart(sf, false);
      const end = node.initializer.end;
      queueDecodedEdit(start, end);
    }

    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      ts.isStringLiteral(node.expression)
    ) {
      const start = node.expression.getStart(sf, false);
      const end = node.expression.end;
      queueDecodedEdit(start, end);
    }

    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      ts.isNoSubstitutionTemplateLiteral(node.expression)
    ) {
      const start = node.expression.getStart(sf, false);
      const end = node.expression.end;
      queueDecodedEdit(start, end);
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);

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
