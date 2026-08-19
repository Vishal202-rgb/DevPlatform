// Directory segments that are never worth sending to the analyzer.
const IGNORED_DIR_SEGMENTS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  '.cache',
  '.turbo',
  '.vercel',
  '.parcel-cache',
  'coverage',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  'target', // Rust/Java build output
  'bin',
  'obj',
  '.idea',
  '.vscode',
]);

// Specific filenames to always skip, regardless of extension.
const IGNORED_FILENAMES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.ds_store',
]);

// Binary / generated / non-source extensions.
const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.mp4', '.mp3', '.mov', '.webm', '.avi',
  '.exe', '.dll', '.so', '.dylib', '.class', '.jar', '.wasm',
  '.map', '.lock', '.log',
  '.db', '.sqlite',
]);

// Source-code extensions we'll actually send to Gemini for review.
const ALLOWED_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs',
  '.ts', '.tsx',
  '.py', '.java', '.go', '.rb', '.php',
  '.c', '.cc', '.cpp', '.h', '.hpp',
  '.cs', '.rs', '.kt', '.kts', '.swift', '.scala',
  '.sql', '.html', '.css', '.scss', '.less',
  '.vue', '.svelte',
  '.json', '.yml', '.yaml', '.sh',
]);

/**
 * Decide whether a repository path (e.g. "src/utils/env.js") should be
 * fetched and analyzed.
 */
const isAnalyzablePath = (path) => {
  const segments = path.split('/');
  const filename = segments[segments.length - 1];
  const lowerFilename = filename.toLowerCase();

  if (segments.some((segment) => IGNORED_DIR_SEGMENTS.has(segment))) return false;
  if (IGNORED_FILENAMES.has(lowerFilename)) return false;
  if (lowerFilename.startsWith('.env')) return false;

  const dotIndex = lowerFilename.lastIndexOf('.');
  if (dotIndex === -1) return false; // no extension - skip (e.g. LICENSE, Dockerfile handled separately if desired)
  const ext = lowerFilename.slice(dotIndex);

  if (IGNORED_EXTENSIONS.has(ext)) return false;
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;

  return true;
};

module.exports = {
  isAnalyzablePath,
  IGNORED_DIR_SEGMENTS,
  IGNORED_FILENAMES,
  IGNORED_EXTENSIONS,
  ALLOWED_EXTENSIONS,
};
