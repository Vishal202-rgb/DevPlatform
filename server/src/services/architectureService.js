const path = require('path');
const env = require('../config/env');
const ArchitectureGraph = require('../models/ArchitectureGraph');
const geminiService = require('./geminiService');

const CATEGORY_MAP = {
  routes: {
    label: 'Routes / API',
    color: '#38BDF8', // Sky Blue
    description: 'API endpoints, route handlers, and URL controllers',
  },
  controllers: {
    label: 'Controllers',
    color: '#818CF8', // Indigo
    description: 'Request orchestration and controller logic',
  },
  services: {
    label: 'Services / Core',
    color: '#F59E0B', // Amber
    description: 'Business logic, API clients, and domain services',
  },
  models: {
    label: 'Models / DB',
    color: '#10B981', // Emerald
    description: 'Database schemas, ORM models, and data access',
  },
  middleware: {
    label: 'Middleware',
    color: '#A855F7', // Purple
    description: 'Authentication, logging, request validation, and error guards',
  },
  components: {
    label: 'Components / UI',
    color: '#F97316', // Orange
    description: 'Frontend views, UI components, pages, and layouts',
  },
  config: {
    label: 'Config / Setup',
    color: '#06B6D4', // Cyan
    description: 'Environment, database configuration, and build settings',
  },
  dependencies: {
    label: 'Dependencies',
    color: '#EC4899', // Pink
    description: 'Major third-party libraries and runtime packages',
  },
  utils: {
    label: 'Utilities / Helpers',
    color: '#94A3B8', // Slate
    description: 'Helper functions, formatters, and shared utilities',
  },
  misc: {
    label: 'Entry / Core',
    color: '#64748B', // Graphite
    description: 'Application entry points and core modules',
  },
};

// Known major framework and runtime libraries worth highlighting as architectural dependencies
const MAJOR_PACKAGES = new Set([
  'react',
  'react-dom',
  'react-router',
  'react-router-dom',
  'express',
  'mongoose',
  'axios',
  'jsonwebtoken',
  'bcrypt',
  'bcryptjs',
  'tailwindcss',
  'vite',
  'next',
  'cors',
  'helmet',
  'redux',
  'zustand',
  'dotenv',
  'cookie-parser',
  'morgan',
  'fastify',
  'prisma',
  '@prisma/client',
  'pg',
  'mysql2',
  'redis',
  'ioredis',
  'graphql',
  'apollo-server',
  'socket.io',
  'zod',
  'joi',
  'flask',
  'django',
  'fastapi',
  'sqlalchemy',
]);

/**
 * Classify a source file into an architectural category based on file path and content.
 */
const classifyFile = (filePath, content = '') => {
  const normPath = filePath.replace(/\\/g, '/').toLowerCase();
  const baseName = path.posix.basename(normPath);
  const ext = path.posix.extname(normPath);

  // 1. Config / Setup
  if (
    normPath.includes('/config/') ||
    normPath.startsWith('config/') ||
    baseName === 'env.js' ||
    baseName === 'db.js' ||
    baseName === 'database.js' ||
    baseName.startsWith('vite.config') ||
    baseName.startsWith('tailwind.config') ||
    baseName.startsWith('webpack.') ||
    baseName.startsWith('tsconfig') ||
    baseName.startsWith('package.json')
  ) {
    return 'config';
  }

  // 2. Routes / API
  if (
    normPath.includes('/routes/') ||
    normPath.startsWith('routes/') ||
    normPath.includes('/api/') ||
    normPath.startsWith('api/') ||
    normPath.includes('/endpoints/') ||
    baseName.includes('.routes.') ||
    baseName.includes('routes.js') ||
    baseName.includes('routes.ts') ||
    content.includes('express.Router()') ||
    content.includes('router.get(') ||
    content.includes('router.post(') ||
    content.includes('app.use(')
  ) {
    return 'routes';
  }

  // 3. Controllers
  if (
    normPath.includes('/controllers/') ||
    normPath.startsWith('controllers/') ||
    normPath.includes('/handlers/') ||
    normPath.startsWith('handlers/') ||
    baseName.includes('.controller.') ||
    baseName.includes('controller.js') ||
    baseName.includes('controller.ts')
  ) {
    return 'controllers';
  }

  // 4. Services
  if (
    normPath.includes('/services/') ||
    normPath.startsWith('services/') ||
    normPath.includes('/service/') ||
    normPath.includes('/managers/') ||
    normPath.includes('/providers/') ||
    baseName.includes('.service.') ||
    baseName.includes('service.js') ||
    baseName.includes('service.ts')
  ) {
    return 'services';
  }

  // 5. Models / DB Schemas
  if (
    normPath.includes('/models/') ||
    normPath.startsWith('models/') ||
    normPath.includes('/schemas/') ||
    normPath.includes('/entities/') ||
    normPath.includes('/model/') ||
    baseName.includes('.model.') ||
    baseName.includes('model.js') ||
    baseName.includes('model.ts') ||
    content.includes('mongoose.model(') ||
    content.includes('mongoose.Schema(') ||
    content.includes('new Schema(') ||
    content.includes('sequelize.define(') ||
    content.includes('class extends Model')
  ) {
    return 'models';
  }

  // 6. Middleware
  if (
    normPath.includes('/middleware/') ||
    normPath.startsWith('middleware/') ||
    normPath.includes('/middlewares/') ||
    normPath.includes('/guards/') ||
    normPath.includes('/interceptors/') ||
    baseName.includes('middleware') ||
    content.includes('(req, res, next)') ||
    content.includes('next()')
  ) {
    return 'middleware';
  }

  // 7. Frontend UI Components & Pages
  if (
    normPath.includes('/components/') ||
    normPath.includes('/pages/') ||
    normPath.includes('/views/') ||
    normPath.includes('/layouts/') ||
    normPath.includes('/widgets/') ||
    normPath.includes('/screens/') ||
    normPath.includes('/client/') ||
    ext === '.jsx' ||
    ext === '.tsx' ||
    ext === '.vue' ||
    ext === '.svelte' ||
    baseName === 'app.jsx' ||
    baseName === 'main.jsx' ||
    baseName === 'index.html'
  ) {
    return 'components';
  }

  // 8. Utilities / Helpers
  if (
    normPath.includes('/utils/') ||
    normPath.startsWith('utils/') ||
    normPath.includes('/helpers/') ||
    normPath.includes('/lib/') ||
    normPath.includes('/common/') ||
    normPath.includes('/tools/') ||
    baseName.includes('util') ||
    baseName.includes('helper')
  ) {
    return 'utils';
  }

  // 9. Root Entry Points
  if (
    baseName === 'server.js' ||
    baseName === 'app.js' ||
    baseName === 'index.js' ||
    baseName === 'main.js' ||
    baseName === 'main.py' ||
    baseName === 'app.py' ||
    baseName === 'main.go'
  ) {
    return 'misc';
  }

  return 'misc';
};

/**
 * Extract imports from code content across multiple languages (JS/TS, Python, Go, etc.)
 */
const extractImportsFromContent = (content) => {
  const imports = [];
  if (!content || typeof content !== 'string') return imports;

  // 1. ES Module imports: import ... from 'path' & import('path') & export ... from 'path'
  const esImportRegex = /(?:import\s+(?:[\w*\s{},$]+\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|export\s+[\w*\s{},$]+\s+from\s+['"]([^'"]+)['"])/g;
  let match;
  while ((match = esImportRegex.exec(content)) !== null) {
    const rawPath = match[1] || match[2] || match[3];
    if (rawPath) imports.push(rawPath.trim());
  }

  // 2. CommonJS requires: require('path')
  const cjsRequireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = cjsRequireRegex.exec(content)) !== null) {
    if (match[1]) imports.push(match[1].trim());
  }

  // 3. Python imports: from path import ... & import path
  const pyImportRegex = /(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/g;
  while ((match = pyImportRegex.exec(content)) !== null) {
    const rawPath = match[1] || match[2];
    if (rawPath) imports.push(rawPath.trim().replace(/\./g, '/'));
  }

  // 4. Go imports: import "path" or import ( "path" )
  const goImportRegex = /import\s+(?:\(\s*([^)]+)\s*\)|"([^"]+)")/g;
  while ((match = goImportRegex.exec(content)) !== null) {
    if (match[2]) {
      imports.push(match[2].trim());
    } else if (match[1]) {
      const lines = match[1].split('\n');
      for (const line of lines) {
        const lineMatch = line.match(/"([^"]+)"/);
        if (lineMatch) imports.push(lineMatch[1].trim());
      }
    }
  }

  return Array.from(new Set(imports));
};

/**
 * Resolve an import string relative to the current file to match a known repository file path.
 */
const resolveImportPath = (importStr, currentFilePath, knownFilePathsSet, knownFilePathsList) => {
  if (!importStr) return null;

  const currentDir = path.posix.dirname(currentFilePath);

  // Case 1: Relative path (e.g. "./foo", "../services/githubService")
  if (importStr.startsWith('.') || importStr.startsWith('/')) {
    const resolvedNorm = path.posix.normalize(path.posix.join(currentDir, importStr));

    // Try exact match
    if (knownFilePathsSet.has(resolvedNorm)) {
      return resolvedNorm;
    }

    // Try common extensions
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.vue', '.svelte', '.py', '.go'];
    for (const ext of extensions) {
      const withExt = `${resolvedNorm}${ext}`;
      if (knownFilePathsSet.has(withExt)) {
        return withExt;
      }
      const indexWithExt = path.posix.join(resolvedNorm, `index${ext}`);
      if (knownFilePathsSet.has(indexWithExt)) {
        return indexWithExt;
      }
    }

    // Fuzzy match on file basename
    const targetBase = path.posix.basename(resolvedNorm).toLowerCase();
    const candidate = knownFilePathsList.find((f) => {
      const fBase = path.posix.basename(f).replace(/\.[^/.]+$/, '').toLowerCase();
      return fBase === targetBase && f.includes(path.posix.dirname(resolvedNorm).split('/')[0]);
    });
    if (candidate) return candidate;

    return null;
  }

  // Case 2: Path alias (e.g. "@/components/Button" or "src/...")
  if (importStr.startsWith('@/') || importStr.startsWith('~/') || importStr.startsWith('src/')) {
    const cleanAlias = importStr.replace(/^[@~]\//, 'src/').replace(/^src\//, '');
    for (const prefix of ['', 'client/', 'server/', 'client/src/', 'server/src/', 'src/']) {
      const candidatePath = path.posix.join(prefix, cleanAlias);
      const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];
      for (const ext of extensions) {
        const fullCandidate = `${candidatePath}${ext}`;
        if (knownFilePathsSet.has(fullCandidate)) {
          return fullCandidate;
        }
      }
    }
  }

  // Case 3: Major external package / library
  const pkgName = importStr.startsWith('@')
    ? importStr.split('/').slice(0, 2).join('/')
    : importStr.split('/')[0];

  if (MAJOR_PACKAGES.has(pkgName.toLowerCase())) {
    return `dep:${pkgName.toLowerCase()}`;
  }

  return null;
};

/**
 * Generate human-readable node name from file path.
 */
const formatNodeName = (filePath) => {
  if (filePath.startsWith('dep:')) {
    const pkg = filePath.replace('dep:', '');
    return `${pkg} (pkg)`;
  }
  return path.posix.basename(filePath);
};

/**
 * Generate a descriptive subtitle for a node.
 */
const generateNodeDescription = (category, filePath) => {
  const baseName = path.posix.basename(filePath);
  switch (category) {
    case 'routes':
      return `Express/API Route Handler (${baseName})`;
    case 'controllers':
      return `Controller & Action Handler (${baseName})`;
    case 'services':
      return `Core Service & Domain Logic (${baseName})`;
    case 'models':
      return `Database Schema & Data Model (${baseName})`;
    case 'middleware':
      return `Middleware & Request Guard (${baseName})`;
    case 'components':
      return `UI Component / Page View (${baseName})`;
    case 'config':
      return `Environment & Configuration (${baseName})`;
    case 'dependencies':
      return `External Package Dependency (${baseName.replace(' (pkg)', '')})`;
    case 'utils':
      return `Utility Function & Helper (${baseName})`;
    default:
      return `Application Module (${baseName})`;
  }
};

/**
 * Build graph data purely from source code analysis (AST/regex/imports).
 */
const generateStaticArchitectureGraph = (repoLabel, files) => {
  if (!files || !files.length) {
    return {
      nodes: [],
      links: [],
      summary: {
        totalModules: 0,
        totalLinks: 0,
        categories: {},
        entryPoints: [],
        topConnected: [],
        generatedWith: 'static',
        lastGeneratedAt: new Date(),
      },
    };
  }

  const knownFilePathsList = files.map((f) => f.path.replace(/\\/g, '/'));
  const knownFilePathsSet = new Set(knownFilePathsList);

  const nodeMap = new Map();
  const links = [];
  const linkKeySet = new Set();
  const dependencyUsage = new Map(); // depName -> count

  // 1. Create file nodes
  for (const file of files) {
    const normPath = file.path.replace(/\\/g, '/');
    const category = classifyFile(normPath, file.content);
    const categoryConfig = CATEGORY_MAP[category] || CATEGORY_MAP.misc;
    const lines = (file.content || '').split('\n').length;

    nodeMap.set(normPath, {
      id: normPath,
      name: formatNodeName(normPath),
      path: normPath,
      category,
      type: category, // alias for frontend compatibility
      color: categoryConfig.color,
      val: Math.max(1.5, Math.min(5, Math.log2(lines + 4))),
      description: generateNodeDescription(category, normPath),
      linesOfCode: lines,
      importsCount: 0,
      importedByCount: 0,
    });
  }

  // 2. Parse dependencies & links
  for (const file of files) {
    const sourcePath = file.path.replace(/\\/g, '/');
    const sourceNode = nodeMap.get(sourcePath);
    if (!sourceNode) continue;

    const rawImports = extractImportsFromContent(file.content);

    for (const rawImport of rawImports) {
      const resolvedTarget = resolveImportPath(
        rawImport,
        sourcePath,
        knownFilePathsSet,
        knownFilePathsList
      );

      if (!resolvedTarget || resolvedTarget === sourcePath) continue;

      if (resolvedTarget.startsWith('dep:')) {
        // Track third-party dependency
        dependencyUsage.set(
          resolvedTarget,
          (dependencyUsage.get(resolvedTarget) || 0) + 1
        );
      } else {
        const targetNode = nodeMap.get(resolvedTarget);
        if (targetNode) {
          const linkKey = `${sourcePath}->${resolvedTarget}`;
          if (!linkKeySet.has(linkKey)) {
            linkKeySet.add(linkKey);
            links.push({
              source: sourcePath,
              target: resolvedTarget,
              label: 'imports',
              type: 'imports',
            });
            sourceNode.importsCount = (sourceNode.importsCount || 0) + 1;
            targetNode.importedByCount = (targetNode.importedByCount || 0) + 1;
          }
        }
      }
    }
  }

  // 3. Create nodes for major dependencies (limit to top 10 most used)
  const topDeps = Array.from(dependencyUsage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [depId, count] of topDeps) {
    const depName = depId.replace('dep:', '');
    const depConfig = CATEGORY_MAP.dependencies;

    nodeMap.set(depId, {
      id: depId,
      name: `${depName}`,
      path: `node_modules/${depName}`,
      category: 'dependencies',
      type: 'dependencies',
      color: depConfig.color,
      val: Math.min(6, 2 + count * 0.5),
      description: `External Library: ${depName} (imported by ${count} files)`,
      linesOfCode: null,
      importsCount: 0,
      importedByCount: count,
    });

    // Link files that imported this dependency
    for (const file of files) {
      const sourcePath = file.path.replace(/\\/g, '/');
      const rawImports = extractImportsFromContent(file.content);
      const importsDep = rawImports.some((imp) => {
        const pkg = imp.startsWith('@')
          ? imp.split('/').slice(0, 2).join('/')
          : imp.split('/')[0];
        return pkg.toLowerCase() === depName;
      });

      if (importsDep) {
        const linkKey = `${sourcePath}->${depId}`;
        if (!linkKeySet.has(linkKey)) {
          linkKeySet.add(linkKey);
          links.push({
            source: sourcePath,
            target: depId,
            label: 'uses',
            type: 'uses',
          });
          const srcNode = nodeMap.get(sourcePath);
          if (srcNode) {
            srcNode.importsCount = (srcNode.importsCount || 0) + 1;
          }
        }
      }
    }
  }

  // 4. Fine-tune node weights based on centrality (importedByCount)
  for (const node of nodeMap.values()) {
    node.val = Number(
      (node.val + (node.importedByCount || 0) * 0.6 + (node.importsCount || 0) * 0.2).toFixed(1)
    );
  }

  const nodes = Array.from(nodeMap.values());

  // 5. Generate summary statistics
  const categoryCounts = {};
  for (const node of nodes) {
    categoryCounts[node.category] = (categoryCounts[node.category] || 0) + 1;
  }

  const entryPoints = nodes
    .filter((n) => {
      const b = path.posix.basename(n.path || '').toLowerCase();
      return (
        b === 'server.js' ||
        b === 'app.js' ||
        b === 'index.js' ||
        b === 'main.js' ||
        b === 'app.jsx' ||
        b === 'main.jsx' ||
        b === 'main.py' ||
        b === 'app.py' ||
        b === 'main.go'
      );
    })
    .map((n) => n.id);

  const topConnected = [...nodes]
    .sort((a, b) => ((b.importedByCount || 0) + (b.importsCount || 0)) - ((a.importedByCount || 0) + (a.importsCount || 0)))
    .slice(0, 5)
    .map((n) => ({
      id: n.id,
      name: n.name,
      category: n.category,
      color: n.color,
      connections: (n.importedByCount || 0) + (n.importsCount || 0),
    }));

  return {
    nodes,
    links,
    summary: {
      totalModules: nodes.length,
      totalLinks: links.length,
      categories: categoryCounts,
      entryPoints,
      topConnected,
      generatedWith: 'static',
      lastGeneratedAt: new Date(),
    },
  };
};

/**
 * Generate architecture graph using hybrid approach: static code analysis + optional AI enrichment.
 * Never fails if Gemini is unavailable.
 */
const generateArchitecture = async (repoLabel, files, onStatusUpdate = () => {}) => {
  // 1. Always build the complete, guaranteed-accurate static code analysis graph
  const staticResult = generateStaticArchitectureGraph(repoLabel, files);

  // 2. If Gemini API key is configured, attempt AI enrichment
  if (env.geminiApiKey) {
    try {
      onStatusUpdate('Analyzing architectural dependencies with AI…');
      const aiGraph = await geminiService.generateArchitectureGraph(repoLabel, files, onStatusUpdate);

      if (aiGraph && Array.isArray(aiGraph.nodes) && aiGraph.nodes.length > 0) {
        // AI returned valid graph data - merge enhancements
        staticResult.summary.generatedWith = 'hybrid';
        
        // Enrich any static node with AI-suggested names or colors if missing
        const aiNodeMap = new Map(aiGraph.nodes.map((n) => [n.id, n]));
        for (const node of staticResult.nodes) {
          const aiNode = aiNodeMap.get(node.id);
          if (aiNode) {
            if (aiNode.name && aiNode.name !== node.id) {
              node.name = aiNode.name;
            }
          }
        }
      }
    } catch (_geminiError) {
      // Clean fallback: static graph remains 100% functional
      staticResult.summary.generatedWith = 'static';
    }
  }

  return staticResult;
};

/**
 * Generate and save architecture graph for a specific repository.
 */
const generateAndSaveArchitecture = async (repository, files, user, onStatusUpdate = () => {}) => {
  if (!repository || !files || !files.length) {
    return null;
  }

  const graphData = await generateArchitecture(repository.fullName, files, onStatusUpdate);

  let graph = await ArchitectureGraph.findOne({ repository: repository._id });
  if (graph) {
    graph.nodes = graphData.nodes;
    graph.links = graphData.links;
    graph.summary = graphData.summary;
    await graph.save();
  } else {
    graph = await ArchitectureGraph.create({
      repository: repository._id,
      nodes: graphData.nodes,
      links: graphData.links,
      summary: graphData.summary,
    });
  }

  return {
    graph,
    summary: graphData.summary,
    repository: {
      id: repository._id,
      name: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      language: repository.language,
      htmlUrl: repository.htmlUrl,
    },
  };
};

/**
 * Retrieve cached ArchitectureGraph for a repository or automatically generate & save it from GitHub source files.
 */
const getOrGenerateGraph = async (repositoryId, userId) => {
  let graph = await ArchitectureGraph.findOne({ repository: repositoryId });
  if (graph && Array.isArray(graph.nodes) && graph.nodes.length > 0) {
    return graph;
  }

  const Repository = require('../models/Repository');
  const githubService = require('./githubService');
  const repo = await Repository.findOne({ _id: repositoryId, user: userId });
  if (!repo) {
    return graph || null;
  }

  try {
    const userWithGithub = await githubService.getUserWithGithubToken(userId);
    const accessToken = userWithGithub?.github?.accessToken;
    if (!accessToken) return graph || null;

    const result = await githubService.fetchSourceFiles(
      accessToken,
      repo.githubOwner,
      repo.name,
      repo.defaultBranch
    );
    const files = result?.files || [];
    if (!files.length) return graph || null;

    const saved = await generateAndSaveArchitecture(repo, files, userWithGithub);
    return saved?.graph || null;
  } catch (err) {
    return graph || null;
  }
};

module.exports = {
  classifyFile,
  extractImportsFromContent,
  resolveImportPath,
  generateStaticArchitectureGraph,
  generateArchitecture,
  generateAndSaveArchitecture,
  getOrGenerateGraph,
  CATEGORY_MAP,
};
