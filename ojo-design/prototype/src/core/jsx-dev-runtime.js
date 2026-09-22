// design-template code, don't change this file.
import * as React from 'react';

const instanceCounter = new Map();
const HTML_TAGS = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base',
  'bdi', 'bdo', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption',
  'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del',
  'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img',
  'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map',
  'mark', 'menu', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol',
  'optgroup', 'option', 'output', 'p', 'param', 'picture', 'pre', 'progress',
  'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select',
  'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup',
  'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead',
  'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr', 'svg',
  'path', 'g', 'defs', 'linearGradient', 'radialGradient', 'stop', 'rect',
  'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan',
  'clipPath', 'mask', 'pattern', 'symbol', 'use', 'view'
]);

const fnv1aHash32 = (input) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return (hash >>> 0).toString(36);
};

const extractWorkspacePath = (fullPath) => {
  if (!fullPath) return fullPath;
  const match = fullPath.match(/(\/workspace\/.+)/);
  return match ? match[1] : fullPath;
};

const getSourceFingerprint = (type, sourceObj) => {
  const fileNameNormalized = extractWorkspacePath(sourceObj?.fileName) || 'unknown';
  const lineNumber = sourceObj?.lineNumber || 0;
  const columnNumber = sourceObj?.columnNumber || 0;
  const sourceSeed = `${fileNameNormalized}:${lineNumber}:${columnNumber}:${type}`;
  return fnv1aHash32(sourceSeed);
};

const FINGERPRINT_HINT_KEYS = ['id', 'uuid', '_id', 'code', 'name', 'slug', 'path', 'href', 'src', 'title', 'label'];
const FINGERPRINT_SKIP_KEYS = new Set([
  'children',
  'key',
  'ref',
  '__source',
  '__self',
  'data-source-id',
  'data-source',
  'data-source-file',
  'data-source-line',
  'data-source-column',
]);

const stableSerialize = (value, depth = 0, seen = new WeakSet()) => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const valueType = typeof value;
  if (valueType === 'string') return `s:${value}`;
  if (valueType === 'number' || valueType === 'boolean' || valueType === 'bigint') return `${valueType[0]}:${value}`;
  if (valueType === 'symbol') return `y:${String(value)}`;
  if (valueType === 'function') return 'f:[fn]';

  if (depth >= 2) return 'o:[max-depth]';
  if (seen.has(value)) return 'o:[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return `a:[${value.map((item) => stableSerialize(item, depth + 1, seen)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const parts = [];
  for (const key of keys) {
    parts.push(`${key}=${stableSerialize(value[key], depth + 1, seen)}`);
  }
  return `o:{${parts.join(',')}}`;
};

const getDataFingerprint = (props, children) => {
  const hints = [];
  for (const hintKey of FINGERPRINT_HINT_KEYS) {
    if (props && props[hintKey] !== undefined && props[hintKey] !== null) {
      hints.push(`${hintKey}:${stableSerialize(props[hintKey])}`);
    }
  }

  if (!hints.length && props) {
    const fallbackKeys = Object.keys(props)
      .filter((propKey) => !FINGERPRINT_SKIP_KEYS.has(propKey))
      .sort();
    for (const propKey of fallbackKeys.slice(0, 8)) {
      hints.push(`${propKey}:${stableSerialize(props[propKey])}`);
    }
  }

  const childSeed = stableSerialize(children);
  const dataSeed = `${hints.join('|')}|children:${childSeed}`;
  return fnv1aHash32(dataSeed);
};

const formatKeyForId = (key) => {
  const rawKey = String(key);
  const isSafeKey = /^[a-zA-Z0-9_-]+$/.test(rawKey);
  if (isSafeKey) return rawKey;

  const encodedKey = encodeURIComponent(rawKey);
  return encodedKey || fnv1aHash32(rawKey);
};

const getInstanceSuffix = (scopeKey, sourceFingerprint, key, props, children) => {
  const dataFingerprint = getDataFingerprint(props, children);

  if (key !== undefined && key !== null) {
    const normalizedKey = formatKeyForId(key);
    const counterKey = `${scopeKey}|${sourceFingerprint}|k:${normalizedKey}|d:${dataFingerprint}`;
    const siblingIndex = instanceCounter.get(counterKey) || 0;
    instanceCounter.set(counterKey, siblingIndex + 1);
    return `k:${normalizedKey}:d:${dataFingerprint}:i:${siblingIndex}`;
  }

  const counterKey = `${scopeKey}|${sourceFingerprint}|${dataFingerprint}`;
  const siblingIndex = instanceCounter.get(counterKey) || 0;
  instanceCounter.set(counterKey, siblingIndex + 1);
  return `d:${dataFingerprint}:i:${siblingIndex}`;
};

export function jsx(type, config, maybeKey) {
  let propName;
  const props = {};
  let key = null;
  let ref = null;

  if (maybeKey !== undefined) {
    key = '' + maybeKey;
  }

  if (config != null) {
    if (config.key !== undefined) key = '' + config.key;
    if (config.ref !== undefined) ref = config.ref;
    for (propName in config) {
      if (
        Object.prototype.hasOwnProperty.call(config, propName) &&
        propName !== 'key' &&
        propName !== 'ref'
      ) {
        props[propName] = config[propName];
      }
    }
  }

  if (key) props.key = key;
  if (ref) props.ref = ref;
  return React.createElement(type, props);
}

export function jsxs(type, config, maybeKey) {
  return jsx(type, config, maybeKey);
}

export function jsxDEV(type, props, key, isStaticChildren, source, self) {
  const { children, ...restProps } = props || {};
  const sourceObj = source || null;
  const elementProps = {
    ...restProps,
    key,
    __source: sourceObj,
    __self: self,
  };

  const isDomTag = typeof type === 'string' && HTML_TAGS.has(type);
  if (isDomTag) {
    const sourceFingerprint = getSourceFingerprint(type, sourceObj);
    const parentStableId = restProps?.['data-source-id'];
    const scopeKey = parentStableId || 'root';
    const instanceSuffix = getInstanceSuffix(scopeKey, sourceFingerprint, key, restProps, children);
    elementProps['data-source-id'] = `${sourceFingerprint}:${instanceSuffix}`;
    if (sourceObj && (sourceObj.fileName || sourceObj.lineNumber)) {
      const fileName = extractWorkspacePath(sourceObj.fileName);
      elementProps['data-source'] = `${fileName || ''}:${sourceObj.lineNumber || ''}:${sourceObj.columnNumber || ''}`;
      if (fileName) elementProps['data-source-file'] = fileName;
      if (sourceObj.lineNumber) elementProps['data-source-line'] = String(sourceObj.lineNumber);
      if (sourceObj.columnNumber) {
        elementProps['data-source-column'] = String(sourceObj.columnNumber);
      }
    }
  }

  return React.createElement(type, elementProps, children);
}

export const Fragment = React.Fragment;
