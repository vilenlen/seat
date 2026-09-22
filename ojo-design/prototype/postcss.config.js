import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const SAFE_AREA_TOP_RE = /env\(\s*safe-area-inset-top\s*(?:,[^)]+)?\)/g;
const SAFE_AREA_BOTTOM_RE = /env\(\s*safe-area-inset-bottom\s*(?:,[^)]+)?\)/g;

const replaceSafeAreaEnv = (value) =>
  value
    .replace(SAFE_AREA_TOP_RE, 'var(--safe-area-inset-top)')
    .replace(SAFE_AREA_BOTTOM_RE, 'var(--safe-area-inset-bottom)');

const safeAreaEnvRewritePlugin = {
  postcssPlugin: 'safe-area-env-rewrite',
  Declaration(decl) {
    if (!decl.value || !decl.value.includes('safe-area-inset-')) {
      return;
    }
    decl.value = replaceSafeAreaEnv(decl.value);
  },
  AtRule(rule) {
    if (!rule.params || !rule.params.includes('safe-area-inset-')) {
      return;
    }
    rule.params = replaceSafeAreaEnv(rule.params);
  },
};

export default {
  plugins: [tailwindcss(), safeAreaEnvRewritePlugin, autoprefixer()],
};
