import {
  createWithEqualityFn as originalCreate,
  useStoreWithEqualityFn,
} from 'zustand/traditional';
import type { StateCreator, StoreApi } from 'zustand/vanilla';
export * from 'zustand/vanilla';
export const useStore = useStoreWithEqualityFn;

const parseJsonFromUrlValue = (valueStr: string): unknown => {
  try {
    return JSON.parse(valueStr);
  } catch {
    return undefined;
  }
};

type ParamTypeHint =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'json';

type ParsedParamValue = {
  val: unknown;
  typeHint?: ParamTypeHint;
};

const TYPED_PARAM_PREFIX = '__pd__:';

const parseTypedParamEnvelope = (valueStr: string): ParsedParamValue => {
  if (!valueStr.startsWith(TYPED_PARAM_PREFIX)) {
    return { val: valueStr };
  }

  const payload = valueStr.slice(TYPED_PARAM_PREFIX.length);
  const parsed = parseJsonFromUrlValue(payload);
  if (!parsed || typeof parsed !== 'object') {
    return { val: valueStr };
  }

  const record = parsed as Record<string, unknown>;
  const typeHint = record.type;
  if (
    typeHint !== 'string' &&
    typeHint !== 'number' &&
    typeHint !== 'boolean' &&
    typeHint !== 'null' &&
    typeHint !== 'undefined' &&
    typeHint !== 'json'
  ) {
    return { val: valueStr };
  }

  return {
    val: record.val,
    typeHint,
  };
};

const parseLegacyNullableValue = (valueStr: string): unknown => {
  if (valueStr === 'null') return null;
  if (valueStr === 'undefined') return undefined;
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;
  if (valueStr === '1') return '1';
  if (valueStr === '0') return '0';

  const trimmed = valueStr.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = parseJsonFromUrlValue(trimmed);
    if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) {
      return parsed;
    }
  }

  const numericValue = Number(valueStr);
  if (valueStr.trim() !== '' && !Number.isNaN(numericValue)) {
    return numericValue;
  }

  return valueStr;
};

const parseWithTypeHint = (param: ParsedParamValue): unknown => {
  if (!param.typeHint) {
    return param.val;
  }

  switch (param.typeHint) {
    case 'null':
      return null;
    case 'undefined':
      return undefined;
    case 'boolean': {
      if (typeof param.val === 'boolean') return param.val;
      if (param.val === 'true' || param.val === '1') return true;
      if (param.val === 'false' || param.val === '0') return false;
      return Boolean(param.val);
    }
    case 'number': {
      if (typeof param.val === 'number') return param.val;
      const parsed = Number(param.val);
      return Number.isNaN(parsed) ? param.val : parsed;
    }
    case 'json': {
      if (typeof param.val === 'string') {
        const parsed = parseJsonFromUrlValue(param.val);
        return parsed === undefined ? param.val : parsed;
      }
      return param.val;
    }
    case 'string':
      return String(param.val ?? '');
    default:
      return param.val;
  }
};

const parseValue = (valueStr: string, initialValue: unknown): unknown => {
  const parsedParam = parseTypedParamEnvelope(valueStr);

  if (initialValue === null || initialValue === undefined) {
    // Priority when initial type is unknown: typed envelope first, then legacy parser.
    if (parsedParam.typeHint) {
      return parseWithTypeHint(parsedParam);
    }
    return parseLegacyNullableValue(valueStr);
  }

  if (initialValue instanceof Set) {
    const candidate =
      typeof parsedParam.val === 'string'
        ? parseJsonFromUrlValue(parsedParam.val)
        : parsedParam.val;
    return Array.isArray(candidate) ? new Set(candidate) : initialValue;
  }

  if (initialValue instanceof Map) {
    const candidate =
      typeof parsedParam.val === 'string'
        ? parseJsonFromUrlValue(parsedParam.val)
        : parsedParam.val;
    if (Array.isArray(candidate)) {
      return new Map(candidate as Array<[unknown, unknown]>);
    }
    if (candidate && typeof candidate === 'object') {
      return new Map(Object.entries(candidate as Record<string, unknown>));
    }
    return initialValue;
  }

  const type = typeof initialValue;
  const normalizedValue =
    typeof parsedParam.val === 'string' ? parsedParam.val : String(parsedParam.val ?? '');

  if (type === 'number') {
    const nextValue = Number(normalizedValue);
    return Number.isNaN(nextValue) ? initialValue : nextValue;
  }

  if (type === 'boolean') {
    if (normalizedValue === 'true' || normalizedValue === '1') return true;
    if (normalizedValue === 'false' || normalizedValue === '0') return false;
    return initialValue;
  }

  if (Array.isArray(initialValue) || type === 'object') {
    const candidate =
      typeof parsedParam.val === 'string'
        ? parseJsonFromUrlValue(parsedParam.val)
        : parsedParam.val;
    return candidate === undefined ? initialValue : candidate;
  }

  if (type === 'string') {
    return normalizedValue;
  }

  return initialValue;
};

const withUrlHydration = <T>(
  stateCreator: StateCreator<T, [], []>
): StateCreator<T, [], []> => {
  return (set, get, api) => {
    let shouldProtectProvidedKeys = false;
    const providedKeys = new Set<string>();

    const protectedSet: typeof set = (partial, replace) => {
      if (!shouldProtectProvidedKeys || providedKeys.size === 0) {
        return set(partial, replace);
      }

      const sanitizeNextState = (nextState: unknown, prevState: T) => {
        if (!nextState || typeof nextState !== 'object') {
          return nextState;
        }

        const nextRecord = nextState as Record<string, unknown>;
        const prevRecord = prevState as Record<string, unknown>;
        let output: Record<string, unknown> | undefined;
        let attemptedProvidedWrite = false;

        for (const key of providedKeys) {
          if (replace === true) {
            attemptedProvidedWrite = true;
            if (!output) {
              output = { ...nextRecord };
            }
            output[key] = prevRecord[key];
            continue;
          }

          if (!(key in nextRecord)) {
            continue;
          }

          attemptedProvidedWrite = true;
          const prevValue = prevRecord[key];
          if (!Object.is(nextRecord[key], prevValue)) {
            if (!output) {
              output = { ...nextRecord };
            }
            output[key] = prevValue;
          }
        }

        // Guard once on the first conflicting write, then release.
        if (attemptedProvidedWrite) {
          shouldProtectProvidedKeys = false;
        }

        return output ?? nextState;
      };

      if (typeof partial === 'function') {
        return set(
          (prevState) =>
            sanitizeNextState(
              (partial as (state: T) => T | Partial<T>)(prevState),
              prevState
            ) as T | Partial<T>,
          replace
        );
      }

      return set(
        (prevState) =>
          sanitizeNextState(partial as unknown, prevState) as T | Partial<T>,
        replace
      );
    };

    const initialState = stateCreator(protectedSet, get, api);

    if (
      typeof window === 'undefined' ||
      !initialState ||
      typeof initialState !== 'object'
    ) {
      return initialState;
    }

    const params = new URLSearchParams(window.location.search);
    const overrides: Record<string, unknown> = {};
    let hasOverrides = false;
    const stateRecord = initialState as Record<string, unknown>;

    for (const key of Object.keys(stateRecord)) {
      if (!params.has(key)) continue;
      const rawValue = params.get(key);
      if (rawValue === null) continue;
      overrides[key] = parseValue(rawValue, stateRecord[key]);
      providedKeys.add(key);
      hasOverrides = true;
    }

    shouldProtectProvidedKeys = hasOverrides;

    return hasOverrides
      ? ({ ...stateRecord, ...overrides } as T)
      : initialState;
  };
};

const cloneWithoutFunctions = (value: unknown, seen = new WeakMap<object, unknown>()): unknown => {
  if (value === null) return null;

  const valueType = typeof value;
  if (
    valueType === 'string' ||
    valueType === 'number' ||
    valueType === 'boolean' ||
    valueType === 'undefined' ||
    valueType === 'bigint'
  ) {
    return value;
  }
  if (valueType === 'function' || valueType === 'symbol') {
    return undefined;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return seen.get(value);
    const output: unknown[] = [];
    seen.set(value, output);
    value.forEach((item) => {
      output.push(cloneWithoutFunctions(item, seen));
    });
    return output;
  }

  if (value instanceof Set) {
    if (seen.has(value)) return seen.get(value);
    const output = new Set<unknown>();
    seen.set(value, output);
    value.forEach((item) => {
      const nextValue = cloneWithoutFunctions(item, seen);
      if (nextValue !== undefined) {
        output.add(nextValue);
      }
    });
    return output;
  }

  if (value instanceof Map) {
    if (seen.has(value)) return seen.get(value);
    const output = new Map<unknown, unknown>();
    seen.set(value, output);
    value.forEach((mapValue, mapKey) => {
      const nextKey = cloneWithoutFunctions(mapKey, seen);
      const nextValue = cloneWithoutFunctions(mapValue, seen);
      if (nextKey !== undefined && nextValue !== undefined) {
        output.set(nextKey, nextValue);
      }
    });
    return output;
  }

  if (valueType === 'object') {
    const objectValue = value as Record<string, unknown>;
    if (seen.has(objectValue)) return seen.get(objectValue);
    const output: Record<string, unknown> = {};
    seen.set(objectValue, output);
    Object.entries(objectValue).forEach(([key, itemValue]) => {
      const nextValue = cloneWithoutFunctions(itemValue, seen);
      if (nextValue !== undefined) {
        output[key] = nextValue;
      }
    });
    return output;
  }

  return value;
};

const toSafeStatePayload = (state: unknown) => {
  const filteredState = cloneWithoutFunctions(state);
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(filteredState);
    } catch {
      // Ignore and fallback to the filtered object.
    }
  }
  return filteredState;
};

const postStoreUpdate = (state: unknown) => {
  if (typeof window === 'undefined' || !window.parent) {
    return;
  }
  window.parent.postMessage(
    {
      type: 'update',
      name: 'state',
      data: {
        state: toSafeStatePayload(state),
        ts: Date.now(),
      },
    },
    '*'
  );
};

const attachStateBridge = <T>(storeApi: StoreApi<T>) => {
  if (typeof window === 'undefined') {
    return;
  }

  storeApi.subscribe((nextState) => {
    try {
      postStoreUpdate(nextState);
    } catch {
      // Swallow bridge errors so store updates never break page behavior.
    }
  });
};

const createWithBridge = <T,>(stateCreator: StateCreator<T, [], []>) => {
  const store = originalCreate(withUrlHydration(stateCreator));
  attachStateBridge(store as unknown as StoreApi<T>);
  return store;
};

export const create: typeof originalCreate = ((stateCreator?: unknown) => {
  if (typeof stateCreator === 'function') {
    return createWithBridge(stateCreator as StateCreator<unknown>);
  }

  return (nextStateCreator: unknown) =>
    createWithBridge(nextStateCreator as StateCreator<unknown>);
}) as typeof originalCreate;

// Compatibility for packages that still import default from `zustand`.
export default create;
