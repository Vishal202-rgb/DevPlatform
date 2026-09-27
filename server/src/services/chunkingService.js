const crypto = require('crypto');
const path = require('path');

const computeHash = (content) => {
  return crypto.createHash('sha256').update(content || '').digest('hex');
};

const detectLanguage = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.js':
    case '.cjs':
    case '.mjs':
      return 'javascript';
    case '.jsx':
      return 'jsx';
    case '.ts':
      return 'typescript';
    case '.tsx':
      return 'tsx';
    case '.py':
      return 'python';
    case '.java':
      return 'java';
    case '.c':
    case '.h':
      return 'c';
    case '.cpp':
    case '.cc':
    case '.hpp':
      return 'cpp';
    case '.json':
      return 'json';
    case '.yaml':
    case '.yml':
      return 'yaml';
    case '.md':
    case '.markdown':
      return 'markdown';
    default:
      return 'generic';
  }
};

/**
 * Parses JavaScript/TypeScript/JSX/TSX into logical semantic chunks.
 */
const chunkJavaScript = (filePath, content, language) => {
  const lines = content.split('\n');
  const chunks = [];
  let currentChunk = null;
  let braceDepth = 0;

  // Regex patterns for key symbols
  const functionRegex = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/;
  const arrowFunctionRegex = /^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/;
  const classRegex = /^(?:export\s+)?(?:default\s+)?class\s+([a-zA-Z0-9_$]+)/;
  const routeRegex = /(?:router|app)\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]+)['"`]/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    // Count open/close braces to track scope
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    // Detect new symbol start
    if (braceDepth === 0) {
      let match;
      if ((match = line.match(functionRegex))) {
        if (currentChunk) finalizeChunk(chunks, currentChunk, i);
        const name = match[1];
        const isComponent = /^[A-Z][a-zA-Z0-9_$]*$/.test(name);
        currentChunk = {
          filePath,
          language,
          symbolName: name,
          chunkType: isComponent ? 'component' : 'function',
          startLine: lineNum,
          lines: [line],
        };
      } else if ((match = line.match(arrowFunctionRegex))) {
        if (currentChunk) finalizeChunk(chunks, currentChunk, i);
        const name = match[1];
        const isComponent = /^[A-Z][a-zA-Z0-9_$]*$/.test(name);
        currentChunk = {
          filePath,
          language,
          symbolName: name,
          chunkType: isComponent ? 'component' : 'function',
          startLine: lineNum,
          lines: [line],
        };
      } else if ((match = line.match(classRegex))) {
        if (currentChunk) finalizeChunk(chunks, currentChunk, i);
        currentChunk = {
          filePath,
          language,
          symbolName: match[1],
          chunkType: 'class',
          startLine: lineNum,
          lines: [line],
        };
      } else if ((match = line.match(routeRegex))) {
        if (currentChunk) finalizeChunk(chunks, currentChunk, i);
        currentChunk = {
          filePath,
          language,
          symbolName: `${match[1].toUpperCase()} ${match[2]}`,
          chunkType: 'route',
          startLine: lineNum,
          lines: [line],
        };
      } else if (trimmed.startsWith('export ') || trimmed.startsWith('module.exports')) {
        if (currentChunk) finalizeChunk(chunks, currentChunk, i);
        currentChunk = {
          filePath,
          language,
          symbolName: 'exports',
          chunkType: 'export',
          startLine: lineNum,
          lines: [line],
        };
      } else if (!currentChunk) {
        currentChunk = {
          filePath,
          language,
          symbolName: path.basename(filePath),
          chunkType: 'module',
          startLine: lineNum,
          lines: [line],
        };
      } else {
        currentChunk.lines.push(line);
      }
    } else if (currentChunk) {
      currentChunk.lines.push(line);
    }

    braceDepth += openBraces - closeBraces;
    if (braceDepth < 0) braceDepth = 0;

    // If block closes at top-level, finalize chunk
    if (braceDepth === 0 && currentChunk && currentChunk.lines.length >= 5) {
      finalizeChunk(chunks, currentChunk, lineNum);
      currentChunk = null;
    }
  }

  if (currentChunk) {
    finalizeChunk(chunks, currentChunk, lines.length);
  }

  // If no chunks were created, fallback to line-based chunking
  if (!chunks.length) {
    return chunkBySlidingWindow(filePath, content, language);
  }

  return chunks;
};

/**
 * Parses Python into logical function, class, and module chunks.
 */
const chunkPython = (filePath, content) => {
  const lines = content.split('\n');
  const chunks = [];
  let currentChunk = null;
  let currentIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;
    const indent = line.search(/\S|$/);

    if (trimmed.startsWith('def ') || trimmed.startsWith('async def ')) {
      if (currentChunk) finalizeChunk(chunks, currentChunk, i);
      const name = trimmed.replace(/^(?:async\s+)?def\s+([a-zA-Z0-9_]+).*/, '$1');
      currentIndent = indent;
      currentChunk = {
        filePath,
        language: 'python',
        symbolName: name,
        chunkType: 'function',
        startLine: lineNum,
        lines: [line],
      };
    } else if (trimmed.startsWith('class ')) {
      if (currentChunk) finalizeChunk(chunks, currentChunk, i);
      const name = trimmed.replace(/^class\s+([a-zA-Z0-9_]+).*/, '$1');
      currentIndent = indent;
      currentChunk = {
        filePath,
        language: 'python',
        symbolName: name,
        chunkType: 'class',
        startLine: lineNum,
        lines: [line],
      };
    } else if (currentChunk) {
      if (trimmed.length > 0 && indent <= currentIndent && !line.startsWith(' ') && !line.startsWith('\t')) {
        finalizeChunk(chunks, currentChunk, i);
        currentChunk = {
          filePath,
          language: 'python',
          symbolName: path.basename(filePath),
          chunkType: 'module',
          startLine: lineNum,
          lines: [line],
        };
      } else {
        currentChunk.lines.push(line);
      }
    } else {
      currentChunk = {
        filePath,
        language: 'python',
        symbolName: path.basename(filePath),
        chunkType: 'module',
        startLine: lineNum,
        lines: [line],
      };
    }
  }

  if (currentChunk) {
    finalizeChunk(chunks, currentChunk, lines.length);
  }

  return chunks.length ? chunks : chunkBySlidingWindow(filePath, content, 'python');
};

/**
 * Logical sliding window chunker with overlapping boundaries for generic files.
 */
const chunkBySlidingWindow = (filePath, content, language, maxLines = 60, overlap = 10) => {
  const lines = content.split('\n');
  const chunks = [];

  if (lines.length <= maxLines) {
    return [
      {
        filePath,
        language,
        symbolName: path.basename(filePath),
        chunkType: 'module',
        startLine: 1,
        endLine: lines.length,
        content: content.trim(),
        charCount: content.length,
      },
    ];
  }

  let i = 0;
  while (i < lines.length) {
    const end = Math.min(i + maxLines, lines.length);
    const chunkLines = lines.slice(i, end);
    const text = chunkLines.join('\n').trim();

    if (text.length > 0) {
      chunks.push({
        filePath,
        language,
        symbolName: `${path.basename(filePath)} [L${i + 1}-${end}]`,
        chunkType: 'block',
        startLine: i + 1,
        endLine: end,
        content: text,
        charCount: text.length,
      });
    }

    if (end === lines.length) break;
    i += maxLines - overlap;
  }

  return chunks;
};

const finalizeChunk = (chunks, chunk, endLine) => {
  const text = chunk.lines.join('\n').trim();
  if (text.length > 10) {
    chunks.push({
      filePath: chunk.filePath,
      language: chunk.language,
      symbolName: chunk.symbolName,
      chunkType: chunk.chunkType,
      startLine: chunk.startLine,
      endLine: Math.max(chunk.startLine, endLine),
      content: text,
      charCount: text.length,
    });
  }
};

/**
 * Main entry point: Chunk a single file content into logical semantic units.
 */
const chunkFile = (filePath, content) => {
  if (!content || typeof content !== 'string') return [];

  const language = detectLanguage(filePath);
  const fileHash = computeHash(content);

  let rawChunks = [];
  if (['javascript', 'jsx', 'typescript', 'tsx'].includes(language)) {
    rawChunks = chunkJavaScript(filePath, content, language);
  } else if (language === 'python') {
    rawChunks = chunkPython(filePath, content);
  } else {
    rawChunks = chunkBySlidingWindow(filePath, content, language);
  }

  return rawChunks.map((c) => ({
    ...c,
    fileHash,
  }));
};

module.exports = {
  chunkFile,
  detectLanguage,
  computeHash,
};
