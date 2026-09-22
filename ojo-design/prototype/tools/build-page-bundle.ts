import path from 'node:path';
import fs from 'node:fs';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const pageBundleConcurrency = 6;
const sourceFileExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const srcDir = path.resolve(projectRoot, 'src');
const componentsDir = path.resolve(srcDir, 'components');
const sharedComponentsDir = path.resolve(projectRoot, '..', 'components');
const pagesDir = path.resolve(srcDir, 'pages');
const tsconfigPath = path.resolve(projectRoot, 'tsconfig.json');

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

const toPosixPath = (value: string) => value.replace(/\\/g, '/');
const toProjectRelativePath = (value: string) => toPosixPath(path.relative(projectRoot, value));

const isInsideDirectory = (targetFilePath: string, parentDirPath: string) => {
  const relativePath = path.relative(parentDirPath, targetFilePath);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const isInsideAnyDirectory = (targetFilePath: string, parentDirPaths: string[]) =>
  parentDirPaths.some((parentDirPath) => isInsideDirectory(targetFilePath, parentDirPath));

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
    baseUrlPath: projectRoot,
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
      ? path.resolve(projectRoot, compilerOptions.baseUrl)
      : projectRoot;
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
  const dependencySearchDirs = [srcDir, sharedComponentsDir];
  const componentSearchDirs = [componentsDir, sharedComponentsDir];
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
      if (!importedFilePath || !isInsideAnyDirectory(importedFilePath, dependencySearchDirs)) {
        continue;
      }

      if (
        isInsideAnyDirectory(importedFilePath, componentSearchDirs) &&
        !visitedComponentFiles.has(importedFilePath)
      ) {
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
    markdownSections.push(
      'No component dependencies found under `src/components/` or `../components/`.'
    );
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

const collectPageFiles = () => {
  if (!fs.existsSync(pagesDir)) {
    console.warn(`Page bundle skipped: pages directory not found: ${pagesDir}`);
    return [] as Array<{ name: string; path: string }>;
  }

  return fs
    .readdirSync(pagesDir)
    .filter((file) => file.endsWith('.page.tsx'))
    .map((file) => ({
      name: file.replace(/\.page\.tsx$/, ''),
      path: path.resolve(pagesDir, file),
    }));
};

const main = async () => {
  const outputArg = process.argv[2];
  const outputPath = outputArg
    ? path.resolve(projectRoot, outputArg)
    : path.resolve(projectRoot, 'dist');
  const pageFiles = collectPageFiles();

  if (pageFiles.length === 0) {
    console.warn('Page bundle skipped: no .page.tsx files found in src/pages.');
    return;
  }

  await generatePageBundles(pageFiles, outputPath);
  console.log(`Page bundle generated for ${pageFiles.length} page(s) at ${toProjectRelativePath(path.resolve(outputPath, 'pageBundle'))}`);
};

main().catch((error) => {
  console.error('Page bundle build failed:', error);
  process.exitCode = 1;
});
