import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rspack/cli';
import { rspack, type Compiler } from '@rspack/core';
import fs from 'node:fs';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';
const pageBundleConcurrency = 6;
const sourceFileExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const srcDir = path.resolve(__dirname, 'src');
const componentsDir = path.resolve(srcDir, 'components');
const tsconfigPath = path.resolve(__dirname, 'tsconfig.json');
const reactPackageRoot = path.dirname(require.resolve('react/package.json'));
const reactDomPackageRoot = path.dirname(require.resolve('react-dom/package.json'));
const reactDomClientEntry = require.resolve('react-dom/client');

type TsconfigAliasEntry = {
  pattern: string;
  hasWildcard: boolean;
  patternPrefix: string;
  targets: string[];
};

type TsconfigResolverConfig = {
  baseUrlPath: string;
  aliases: TsconfigAliasEntry[];
};

const pagesDir = path.resolve(__dirname, 'src/pages');
if (!fs.existsSync(pagesDir)) {
  throw new Error(`Pages directory not found: ${pagesDir}`);
}

const readRequiredJson = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required JSON file not found: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    throw new Error(`Failed to parse JSON file: ${filePath}\n${String(error)}`);
  }
};

const resolvePrototypeVersion = () => {
  const packageJsonPath = path.resolve(__dirname, 'package.json');
  const packageJson = readRequiredJson(packageJsonPath) as { version?: unknown };
  const version = typeof packageJson.version === 'string' ? packageJson.version.trim() : '';
  if (!version) {
    throw new Error(
      `Invalid package.json: "version" is required and must be a non-empty string. File: ${packageJsonPath}`
    );
  }
  return version;
};

const prototypeVersion = resolvePrototypeVersion();

const initialStoreData = readRequiredJson(path.resolve(__dirname, 'src/data/store.json'));
const initialThemeData = readRequiredJson(path.resolve(__dirname, 'src/data/theme.json'));
const supabaseRuntimeConfigPath = path.resolve(__dirname, 'supabase.config.json');

type SupabaseRuntimeConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const resolveSupabaseRuntimeConfig = (): SupabaseRuntimeConfig => {
  if (!fs.existsSync(supabaseRuntimeConfigPath)) {
    return {
      supabaseUrl: '',
      supabaseAnonKey: '',
    };
  }

  const parsed = readRequiredJson(supabaseRuntimeConfigPath) as {
    supabaseUrl?: unknown;
    supabaseAnonKey?: unknown;
  };

  return {
    supabaseUrl: typeof parsed.supabaseUrl === 'string' ? parsed.supabaseUrl : '',
    supabaseAnonKey: typeof parsed.supabaseAnonKey === 'string' ? parsed.supabaseAnonKey : '',
  };
};

const appRuntimeConfig = resolveSupabaseRuntimeConfig();

const pageFiles = fs
  .readdirSync(pagesDir)
  .filter((file) => file.endsWith('.page.tsx'))
  .map((file) => ({
    name: file.replace(/\.page\.tsx$/, ''),
    path: path.resolve(pagesDir, file),
  }));

if (pageFiles.length === 0) {
  throw new Error(`No .page.tsx files found in pages directory: ${pagesDir}`);
}

const validateAppEntryPageForBuild = () => {
  const appDataPath = path.resolve(__dirname, 'src/data/app.json');
  const appData = readRequiredJson(appDataPath) as {
    entryPage?: unknown;
    pages?: unknown;
  };

  const entryPage =
    typeof appData.entryPage === 'string' ? appData.entryPage.trim() : '';
  if (!entryPage) {
    throw new Error(`Invalid app.json: "entryPage" is required and must be a non-empty string. File: ${appDataPath}`);
  }

  const compiledPageNames = new Set(pageFiles.map((page) => page.name));
  if (!compiledPageNames.has(entryPage)) {
    throw new Error(
      `Invalid app.json: entryPage "${entryPage}" does not exist in src/pages (*.page.tsx). ` +
        `Available pages: ${Array.from(compiledPageNames).sort().join(', ')}`
    );
  }

  if (Array.isArray(appData.pages) && !appData.pages.includes(entryPage)) {
    throw new Error(
      `Invalid app.json: entryPage "${entryPage}" is not included in app.json pages.`
    );
  }
};

validateAppEntryPageForBuild();

const tempEntriesDir = path.resolve(__dirname, '.temp-entries');
if (!fs.existsSync(tempEntriesDir)) {
  fs.mkdirSync(tempEntriesDir, { recursive: true });
}

const removeTempEntriesDir = () => {
  if (!fs.existsSync(tempEntriesDir)) return;
  fs.rmSync(tempEntriesDir, { recursive: true, force: true });
};

const entry = pageFiles.reduce(
  (acc, page) => {
    const wrapperPath = path.resolve(tempEntriesDir, `${page.name}.ts`);
    const pageRelativePath = path
      .relative(tempEntriesDir, page.path)
      .replace(/\\/g, '/');
    const normalizedPagePath = pageRelativePath.startsWith('.')
      ? pageRelativePath
      : `./${pageRelativePath}`;

    const wrapperContent = `// Auto-generated wrapper entry for ${page.name}
import { initPage } from '../src/core/page-entry';
import * as PageModule from '${normalizedPagePath}';

const fallbackComponent = Object.values(PageModule).find(
  (exp) => typeof exp === 'function' && /^[A-Z]/.test(exp.name || '')
);

const PageComponent =
  PageModule.default ??
  (typeof PageModule.Page === 'function' ? PageModule.Page : undefined) ??
  fallbackComponent;

if (!PageComponent) {
  throw new Error(
    'No React page component export found in ${normalizedPagePath}. ' +
      'Available exports: ' +
      Object.keys(PageModule).join(', ')
  );
}

initPage(PageComponent);
`;

    fs.writeFileSync(wrapperPath, wrapperContent, 'utf-8');
    acc[page.name] = wrapperPath;
    return acc;
  },
  {} as Record<string, string>
);

const htmlPlugins = pageFiles.map((page) => {
  const pageTitle = `${page.name.charAt(0).toUpperCase() + page.name.slice(1)} - App`;
  return new rspack.HtmlRspackPlugin({
    template: './src/template.html',
    filename: `${page.name}.html`,
    chunks: [page.name],
    inject: 'body',
    templateParameters: { title: pageTitle },
    minify: !isDev,
  });
});

const toPosixPath = (value: string) => value.replace(/\\/g, '/');

const toProjectRelativePath = (value: string) => toPosixPath(path.relative(__dirname, value));

const isInsideDirectory = (targetFilePath: string, parentDirPath: string) => {
  const relativePath = path.relative(parentDirPath, targetFilePath);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const fileExists = (filePath: string) => {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};

const stripImportQueryAndHash = (value: string) => {
  const queryStart = value.indexOf('?');
  const hashStart = value.indexOf('#');
  const cutIndexCandidates = [queryStart, hashStart].filter((index) => index >= 0);
  if (cutIndexCandidates.length === 0) {
    return value;
  }
  const cutIndex = Math.min(...cutIndexCandidates);
  return value.slice(0, cutIndex);
};

const loadTsconfigResolverConfig = (): TsconfigResolverConfig => {
  const defaultConfig: TsconfigResolverConfig = {
    baseUrlPath: __dirname,
    aliases: [],
  };
  if (!fs.existsSync(tsconfigPath)) {
    return defaultConfig;
  }

  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf-8');
    const parsed = JSON.parse(raw) as {
      compilerOptions?: {
        baseUrl?: string;
        paths?: Record<string, string[]>;
      };
    };
    const compilerOptions = parsed.compilerOptions || {};
    const baseUrlPath = compilerOptions.baseUrl
      ? path.resolve(__dirname, compilerOptions.baseUrl)
      : __dirname;
    const pathsRecord = compilerOptions.paths || {};
    const aliases = Object.entries(pathsRecord)
      .filter(([, targets]) => Array.isArray(targets) && targets.length > 0)
      .map(([pattern, targets]) => {
        const hasWildcard = pattern.includes('*');
        const patternPrefix = hasWildcard ? pattern.slice(0, pattern.indexOf('*')) : pattern;
        return {
          pattern,
          hasWildcard,
          patternPrefix,
          targets: targets.filter((target) => typeof target === 'string' && target.length > 0),
        };
      });

    return {
      baseUrlPath,
      aliases,
    };
  } catch (error) {
    console.warn(`Page bundle: failed to parse tsconfig at ${tsconfigPath}`, error);
    return defaultConfig;
  }
};

const tsconfigResolverConfig = loadTsconfigResolverConfig();

const resolveWithExtensions = (basePath: string) => {
  if (fileExists(basePath)) {
    return basePath;
  }
  for (const ext of sourceFileExtensions) {
    const withExtension = `${basePath}${ext}`;
    if (fileExists(withExtension)) {
      return withExtension;
    }
  }
  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const ext of sourceFileExtensions) {
      const indexPath = path.resolve(basePath, `index${ext}`);
      if (fileExists(indexPath)) {
        return indexPath;
      }
    }
  }
  return null;
};

const extractImportSpecifiers = (sourceCode: string, sourceFilePath: string) => {
  try {
    const sourceFile = ts.createSourceFile(
      sourceFilePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const importSpecifiers = new Set<string>();
    const usedValueIdentifiers = new Set<string>();

    const isInTypePosition = (node: ts.Node) => {
      let current: ts.Node | undefined = node;
      while (current) {
        if (ts.isTypeNode(current)) {
          return true;
        }
        current = current.parent;
      }
      return false;
    };

    const collectUsedIdentifiers = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
        return;
      }
      if (ts.isIdentifier(node) && !isInTypePosition(node)) {
        usedValueIdentifiers.add(node.text);
      }
      ts.forEachChild(node, collectUsedIdentifiers);
    };

    collectUsedIdentifiers(sourceFile);

    for (const statement of sourceFile.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text
      ) {
        const moduleSpecifier = statement.moduleSpecifier.text;
        const importClause = statement.importClause;

        if (!importClause) {
          // Side-effect import: import './setup';
          importSpecifiers.add(moduleSpecifier);
          continue;
        }
        if (importClause.isTypeOnly) {
          continue;
        }

        const importedLocalNames: string[] = [];
        if (importClause.name) {
          importedLocalNames.push(importClause.name.text);
        }
        if (importClause.namedBindings) {
          if (ts.isNamespaceImport(importClause.namedBindings)) {
            importedLocalNames.push(importClause.namedBindings.name.text);
          } else {
            importClause.namedBindings.elements.forEach((element) => {
              if (!element.isTypeOnly) {
                importedLocalNames.push(element.name.text);
              }
            });
          }
        }

        if (
          importedLocalNames.length === 0 ||
          importedLocalNames.some((name) => usedValueIdentifiers.has(name))
        ) {
          importSpecifiers.add(moduleSpecifier);
        }
      }

      if (
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text
      ) {
        importSpecifiers.add(statement.moduleSpecifier.text);
      }
    }

    const visitNode = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length > 0 &&
        !isInTypePosition(node)
      ) {
        const firstArgument = node.arguments[0];
        if (ts.isStringLiteral(firstArgument) && firstArgument.text) {
          importSpecifiers.add(firstArgument.text);
        }
      }

      ts.forEachChild(node, visitNode);
    };

    visitNode(sourceFile);
    return Array.from(importSpecifiers);
  } catch (error) {
    console.warn(`Page bundle: TypeScript AST parse failed for ${sourceFilePath}`, error);
    return [];
  }
};

const resolveImportedFilePath = (importSpecifier: string, importerFilePath: string) => {
  const cleanSpecifier = stripImportQueryAndHash(importSpecifier).trim();
  if (!cleanSpecifier) {
    return null;
  }

  const candidateBasePaths: string[] = [];

  if (cleanSpecifier.startsWith('./') || cleanSpecifier.startsWith('../')) {
    candidateBasePaths.push(path.resolve(path.dirname(importerFilePath), cleanSpecifier));
  } else if (cleanSpecifier.startsWith('/')) {
    candidateBasePaths.push(path.resolve(srcDir, cleanSpecifier.slice(1)));
  } else if (cleanSpecifier.startsWith('@/')) {
    candidateBasePaths.push(path.resolve(srcDir, cleanSpecifier.slice(2)));
  }

  for (const alias of tsconfigResolverConfig.aliases) {
    if (!alias.hasWildcard) {
      if (cleanSpecifier !== alias.pattern) {
        continue;
      }
      for (const target of alias.targets) {
        candidateBasePaths.push(path.resolve(tsconfigResolverConfig.baseUrlPath, target));
      }
      continue;
    }

    if (!cleanSpecifier.startsWith(alias.patternPrefix)) {
      continue;
    }

    const wildcardValue = cleanSpecifier.slice(alias.patternPrefix.length);
    for (const target of alias.targets) {
      const targetPath = target.includes('*')
        ? target.replace(/\*/g, wildcardValue)
        : `${target}${wildcardValue}`;
      candidateBasePaths.push(path.resolve(tsconfigResolverConfig.baseUrlPath, targetPath));
    }
  }

  for (const candidateBasePath of candidateBasePaths) {
    const resolved = resolveWithExtensions(candidateBasePath);
    if (resolved) {
      return resolved;
    }
  }

  return null;
};

const collectPageComponentDependencies = async (entryPagePath: string) => {
  const visitedFiles = new Set<string>();
  const visitedComponentFiles = new Set<string>();
  const componentFiles: string[] = [];
  const queue: string[] = [entryPagePath];

  while (queue.length > 0) {
    const currentFilePath = queue.shift();
    if (!currentFilePath || visitedFiles.has(currentFilePath)) {
      continue;
    }
    visitedFiles.add(currentFilePath);

    let sourceCode = '';
    try {
      sourceCode = fs.readFileSync(currentFilePath, 'utf-8');
    } catch (error) {
      console.warn(`Page bundle: failed to read ${currentFilePath}`, error);
      continue;
    }

    const specifiers = extractImportSpecifiers(sourceCode, currentFilePath);
    for (const specifier of specifiers) {
      const importedFilePath = resolveImportedFilePath(specifier, currentFilePath);
      if (!importedFilePath || !isInsideDirectory(importedFilePath, srcDir)) {
        continue;
      }

      if (isInsideDirectory(importedFilePath, componentsDir) && !visitedComponentFiles.has(importedFilePath)) {
        visitedComponentFiles.add(importedFilePath);
        componentFiles.push(importedFilePath);
      }
      if (!visitedFiles.has(importedFilePath)) {
        queue.push(importedFilePath);
      }
    }
  }

  return componentFiles.sort((a, b) => a.localeCompare(b));
};

const formatCodeSection = (title: string, filePath: string, language: string, content: string | null) => {
  const lines = [`## ${title}`, `Path: \`${toProjectRelativePath(filePath)}\``];
  if (content === null) {
    lines.push('', 'Not Found');
    return lines.join('\n');
  }
  lines.push('', `\`\`\`${language}`, content, '```');
  return lines.join('\n');
};

const generatePageBundleMarkdown = async (pageName: string, pagePath: string) => {
  const storePath = path.resolve(srcDir, 'stores', `${pageName}.store.ts`);
  const snapshotPath = path.resolve(srcDir, 'snapshots', `${pageName}.snapshots.json`);
  const storeContent = fileExists(storePath) ? fs.readFileSync(storePath, 'utf-8') : null;
  const snapshotContent = fileExists(snapshotPath) ? fs.readFileSync(snapshotPath, 'utf-8') : null;
  const pageContent = fs.readFileSync(pagePath, 'utf-8');
  const componentFiles = await collectPageComponentDependencies(pagePath);

  const markdownSections = [
    `# Page Bundle: ${pageName}`,
    '',
    '## Page',
    `- id: \`${pageName}\``,
    `- path: \`${toProjectRelativePath(pagePath)}\``,
    '',
    '## LayoutBaseline',
    '```html',
    '<html>',
    '  <body>',
    '    <div id="root"><!-- page mounts here --></div>',
    '  </body>',
    '</html>',
    '```',
    '',
    'Notice: In this template, `html`, `body`, and `#root` do **not** have `height: 100%` by default.',
    'Do not assume a full-height parent chain unless it is explicitly defined in CSS.',
    '',
    formatCodeSection('Store', storePath, 'ts', storeContent),
    '',
    formatCodeSection('Snapshot', snapshotPath, 'json', snapshotContent),
    '',
    '## PageSource',
    `Path: \`${toProjectRelativePath(pagePath)}\``,
    '',
    '```tsx',
    pageContent,
    '```',
    '',
    '## Components',
  ];

  if (componentFiles.length === 0) {
    markdownSections.push('No component dependencies found under `src/components/`.');
  } else {
    for (const componentFilePath of componentFiles) {
      const componentContent = fs.readFileSync(componentFilePath, 'utf-8');
      markdownSections.push(
        '',
        `### ${toProjectRelativePath(componentFilePath)}`,
        '',
        '```tsx',
        componentContent,
        '```'
      );
    }
  }

  markdownSections.push('');
  return markdownSections.join('\n');
};

const generatePageBundles = async (
  pages: Array<{ name: string; path: string }>,
  outputPath: string
) => {
  const pageBundleDir = path.resolve(outputPath, 'pageBundle');
  if (!fs.existsSync(pageBundleDir)) {
    fs.mkdirSync(pageBundleDir, { recursive: true });
  }

  if (pages.length === 0) {
    return;
  }

  const workerCount = Math.max(1, Math.min(pageBundleConcurrency, pages.length));
  let cursor = 0;

  const runWorker = async () => {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;
      if (currentIndex >= pages.length) {
        return;
      }

      const page = pages[currentIndex];
      try {
        const pageMarkdown = await generatePageBundleMarkdown(page.name, page.path);
        fs.writeFileSync(path.resolve(pageBundleDir, `${page.name}.md`), pageMarkdown, 'utf-8');
      } catch (error) {
        console.warn(`Page bundle: failed to generate bundle for page ${page.name}`, error);
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
};

class InlineAssetsPlugin {
  // @ts-ignore - Compiler type compatibility issue in rspack definitions.
  apply(compiler: rspack.Compiler) {
    if (isDev) return;

    compiler.hooks.afterEmit.tapAsync('InlineAssetsPlugin', (compilation, callback) => {
      const outputPath =
        compilation.options.output?.path || path.resolve(__dirname, 'dist');

      setTimeout(async () => {
        try {
          if (!fs.existsSync(outputPath)) {
            callback();
            return;
          }

          const htmlFiles = fs.readdirSync(outputPath).filter((f) => f.endsWith('.html'));
          const dataDir = path.resolve(__dirname, 'src/data');
          let storeData = null;
          let themeData = null;

          try {
            const storePath = path.resolve(dataDir, 'store.json');
            const themePath = path.resolve(dataDir, 'theme.json');
            if (fs.existsSync(storePath)) {
              storeData = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
            }
            if (fs.existsSync(themePath)) {
              themeData = JSON.parse(fs.readFileSync(themePath, 'utf-8'));
            }
          } catch (error) {
            console.warn('Failed to load data files:', error);
          }

          htmlFiles.forEach((htmlFile) => {
            const htmlPath = path.resolve(outputPath, htmlFile);
            let html = fs.readFileSync(htmlPath, 'utf-8');

            if (storeData || themeData) {
              const jsonScript = `
  <script>
    window.__INLINE_DATA__ = {
      store: ${JSON.stringify(storeData)},
      theme: ${JSON.stringify(themeData)}
    };
  </script>`;

              if (html.includes('</head>')) {
                html = html.replace('</head>', `${jsonScript}\n</head>`);
              } else if (html.includes('<body')) {
                html = html.replace(/<body([^>]*)>/, `${jsonScript}\n<body$1>`);
              }
            }

            html = html.replace(
              /<script[^>]*src="([^"]+\.js)"[^>]*><\/script>/gi,
              (match, src) => {
                if (src.startsWith('http://') || src.startsWith('https://')) return match;
                const jsPath = path.resolve(outputPath, src.replace(/^\//, ''));
                if (!fs.existsSync(jsPath)) return match;
                return `<script>${fs.readFileSync(jsPath, 'utf-8')}</script>`;
              }
            );

            html = html.replace(
              /<link[^>]*href="([^"]+\.css)"[^>]*>/gi,
              (match, href) => {
                if (href.startsWith('http://') || href.startsWith('https://')) return match;
                const cssPath = path.resolve(outputPath, href.replace(/^\//, ''));
                if (!fs.existsSync(cssPath)) return match;
                return `<style>${fs.readFileSync(cssPath, 'utf-8')}</style>`;
              }
            );

            fs.writeFileSync(htmlPath, html, 'utf-8');
          });

          fs.readdirSync(outputPath).forEach((file) => {
            if (file.endsWith('.js') || file.endsWith('.js.map')) {
              fs.unlinkSync(path.resolve(outputPath, file));
            }
          });

          const copyJsonDir = (fromDir: string, toDir: string) => {
            if (!fs.existsSync(fromDir)) return;
            if (!fs.existsSync(toDir)) {
              fs.mkdirSync(toDir, { recursive: true });
            }
            fs.readdirSync(fromDir).forEach((file) => {
              if (file.endsWith('.json')) {
                const sourcePath = path.resolve(fromDir, file);
                const targetPath = path.resolve(toDir, file);
                fs.copyFileSync(sourcePath, targetPath);
              }
            });
          };

          const generateBlueprint = (
            sourceDataDir: string,
            sourceSnapshotsDir: string,
            outputDataDir: string
          ) => {
            const appPath = path.resolve(sourceDataDir, 'app.json');
            if (!fs.existsSync(appPath)) {
              console.warn(`Blueprint skipped: app.json not found at ${appPath}`);
              return;
            }

            let entryPage: string | null = null;
            try {
              const appData = JSON.parse(fs.readFileSync(appPath, 'utf-8')) as {
                entryPage?: unknown;
              };
              if (typeof appData.entryPage === 'string' && appData.entryPage.trim()) {
                entryPage = appData.entryPage;
              } else {
                console.warn('Blueprint skipped: app.json entryPage is missing or invalid');
                return;
              }
            } catch (error) {
              console.warn('Blueprint skipped: failed to parse app.json', error);
              return;
            }

            const snapshots: Array<Record<string, unknown>> = [];
            if (fs.existsSync(sourceSnapshotsDir)) {
              const snapshotFiles = fs
                .readdirSync(sourceSnapshotsDir)
                .filter((file) => file.endsWith('.snapshots.json'))
                .sort();

              snapshotFiles.forEach((file) => {
                const snapshotPath = path.resolve(sourceSnapshotsDir, file);
                try {
                  const snapshotContent = JSON.parse(
                    fs.readFileSync(snapshotPath, 'utf-8')
                  ) as Record<string, unknown>;
                  snapshots.push(snapshotContent);
                } catch (error) {
                  console.warn(`Blueprint skipped snapshot file: ${file}`, error);
                }
              });
            }

            if (!fs.existsSync(outputDataDir)) {
              fs.mkdirSync(outputDataDir, { recursive: true });
            }

            const blueprint = {
              version: prototypeVersion,
              entryPage,
              snapshots,
            };
            fs.writeFileSync(
              path.resolve(outputDataDir, 'blueprint.json'),
              JSON.stringify(blueprint, null, 2),
              'utf-8'
            );
          };

          const sourceDataDir = path.resolve(__dirname, 'src/data');
          const sourceSnapshotsDir = path.resolve(__dirname, 'src/snapshots');
          const outputDataDir = path.resolve(outputPath, 'data');

          copyJsonDir(sourceDataDir, outputDataDir);
          copyJsonDir(sourceSnapshotsDir, path.resolve(outputPath, 'snapshots'));
          generateBlueprint(sourceDataDir, sourceSnapshotsDir, outputDataDir);
        } catch (error) {
          console.error('InlineAssetsPlugin error:', error);
        }
        callback();
      }, 100);
    });
  }
}

class TempEntriesCleanupPlugin {
  private cleaned = false;

  private cleanup() {
    if (this.cleaned) return;
    this.cleaned = true;
    removeTempEntriesDir();
  }

  apply(compiler: Compiler) {
    compiler.hooks.done.tap('TempEntriesCleanupPlugin', () => {
      this.cleanup();
    });
    compiler.hooks.failed.tap('TempEntriesCleanupPlugin', () => {
      this.cleanup();
    });
  }
}

export default defineConfig({
  bail: true,
  stats: {
    preset: 'errors-warnings',
    errorDetails: true,
    moduleTrace: true,
  },
  entry,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: isDev ? '[name].js' : '[name].[contenthash].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      'react$': reactPackageRoot,
      'react-dom$': reactDomPackageRoot,
      'react-dom/client$': reactDomClientEntry,
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, '../components'),
      'zustand$': path.resolve(__dirname, 'src/core/zustand-wrapper.ts'),
    },
  },
  module: {
    ...(!isDev && {
      parser: {
        javascript: {
          dynamicImportMode: 'eager',
        },
      },
    }),
    rules: [
      {
        test: /\.[jt]sx?$/,
        include: [srcDir, path.resolve(__dirname, '../components')],
        exclude: /node_modules/,
        enforce: 'pre',
        use: [
          {
            loader: path.resolve(__dirname, 'tools/loaders/safe-area-env-rewrite-loader.cjs'),
          },
        ],
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                  decorators: false,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                    development: true,
                    refresh: false,
                  },
                },
              },
            },
          },
          {
            loader: path.resolve(__dirname, 'tools/loaders/jsx-unicode-compat-loader.cjs'),
          },
        ],
        type: 'javascript/auto',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.json$/,
        type: 'json',
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        type: 'asset',
      },
    ],
  },
  plugins: [
    ...htmlPlugins,
    new InlineAssetsPlugin(),
    ...(!isDev
      ? [
          new TempEntriesCleanupPlugin(),
          new rspack.optimize.LimitChunkCountPlugin({ maxChunks: pageFiles.length }),
        ]
      : []),
    new rspack.NormalModuleReplacementPlugin(
      /^react\/jsx-dev-runtime$/,
      path.resolve(__dirname, 'src/core/jsx-dev-runtime.js')
    ),
    new rspack.NormalModuleReplacementPlugin(
      /^react\/jsx-runtime$/,
      path.resolve(__dirname, 'src/core/jsx-dev-runtime.js')
    ),
    new rspack.DefinePlugin({
      __APP_INITIAL_STORE__: JSON.stringify(initialStoreData),
      __APP_INITIAL_THEME__: JSON.stringify(initialThemeData),
      __APP_CONFIG__: JSON.stringify(appRuntimeConfig),
      __INLINE_DATA_AVAILABLE__: JSON.stringify(
        !isDev && fs.existsSync(path.resolve(__dirname, 'src/data/store.json'))
      ),
    }),
  ],
  devServer: {
    port: 3000,
    hot: false,
    open: true,
    historyApiFallback: true,
  },
  optimization: {
    minimize: !isDev,
    splitChunks: isDev ? undefined : false,
  },
});
