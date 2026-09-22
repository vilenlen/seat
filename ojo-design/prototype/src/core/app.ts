// design-template code, don't change this file.
import '../global.css';
import '../fonts.css';
import { configureGeneratedApi, createSupabaseClient } from '@workspace/api-client-react';

interface AppInterface {
  store: any;
  theme: any;
  initPage(): void;
  transitionTo(targetPageId: string, runtimeParams?: Record<string, any>): void;
  goBack(): void;
  renderCurrentPage(): void;
  renderError(error: Error): void;
}

const isLowercasePageId = (value: string) => /^[a-z0-9_-]+$/.test(value);

const resolveInitialStore = () => {
  // @ts-ignore - runtime-injected inline data from html.
  if (typeof window !== 'undefined' && window.__INLINE_DATA__?.store) {
    // @ts-ignore
    return window.__INLINE_DATA__.store || {};
  }
  if (typeof __APP_INITIAL_STORE__ !== 'undefined' && __APP_INITIAL_STORE__) {
    return __APP_INITIAL_STORE__;
  }
  return {};
};

const resolveInitialTheme = () => {
  // @ts-ignore - runtime-injected inline data from html.
  if (typeof window !== 'undefined' && window.__INLINE_DATA__?.theme) {
    // @ts-ignore
    return window.__INLINE_DATA__.theme || {};
  }
  if (typeof __APP_INITIAL_THEME__ !== 'undefined' && __APP_INITIAL_THEME__) {
    return __APP_INITIAL_THEME__;
  }
  return {};
};

const bootstrapGeneratedApi = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const supabaseUrl = __APP_CONFIG__?.supabaseUrl?.trim();
  const supabaseAnonKey = __APP_CONFIG__?.supabaseAnonKey?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return;
  }

  const supabase = createSupabaseClient({
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  });

  configureGeneratedApi({
    client: supabase,
  });
};

export const App: AppInterface = {
  store: resolveInitialStore(),
  theme: resolveInitialTheme(),

  initPage() {
    App.renderCurrentPage();
    // @ts-ignore
    if (typeof lucide !== 'undefined') {
      // @ts-ignore
      lucide.createIcons();
    }
  },

  transitionTo(targetPageId: string, runtimeParams?: Record<string, any>) {
    if (!targetPageId || !isLowercasePageId(targetPageId)) {
      console.error(
        `Invalid target page "${targetPageId}". Expected lowercase page id matching src/pages filename.`
      );
      return;
    }

    window.parent.postMessage(
      {
        type: 'navigate',
        name: 'navigate',
        data: {
          targetPageId,
          params: runtimeParams || {},
        },
      },
      '*'
    );
  },

  goBack() {
    window.parent.postMessage(
      {
        type: 'goBack',
        name: 'navigate',
      },
      '*'
    );
  },

  renderCurrentPage() {
    console.warn('renderCurrentPage() not implemented for this page');
  },

  renderError(error: Error) {
    const app = document.getElementById('root');
    if (app) {
      app.innerHTML = `
        <div class="p-8 text-center">
          <div class="text-red-500 font-bold mb-2">Error</div>
          <div class="text-gray-600">${error.message}</div>
        </div>
      `;
    }
  },
};

declare global {
  interface Window {
    App: typeof App;
    __INLINE_DATA__?: {
      store?: any;
      theme?: any;
    };
  }
  const __APP_CONFIG__:
    | {
        supabaseUrl?: string;
        supabaseAnonKey?: string;
      }
    | undefined;
  const __APP_INITIAL_STORE__: any;
  const __APP_INITIAL_THEME__: any;
}

if (typeof window !== 'undefined') {
  bootstrapGeneratedApi();
  window.App = App;
  if (window.__INLINE_DATA__?.store) {
    window.App.store = window.__INLINE_DATA__.store || {};
  }
  if (window.__INLINE_DATA__?.theme) {
    window.App.theme = window.__INLINE_DATA__.theme || {};
  }
}
