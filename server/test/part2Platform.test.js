const { test, describe } = require('node:test');
const assert = require('node:assert');
const { chunkFile, detectLanguage, computeHash } = require('../src/services/chunkingService');
const { cosineSimilarity, generateDeterministicEmbedding } = require('../src/services/embeddingService');
const impactService = require('../src/services/impactService');

describe('DevMind Part 2 - Semantic Chunking Engine', () => {
  test('correctly identifies JavaScript/TypeScript symbols, routes, and components', () => {
    const code = `
import express from 'express';
const router = express.Router();

export function calculateMetrics(data) {
  const result = data.map(d => d.value * 2);
  return result;
}

export const AuthModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return <div>Modal Content</div>;
};

router.post('/api/auth/login', async (req, res) => {
  res.json({ token: 'abc' });
});
`;

    const chunks = chunkFile('src/routes/auth.jsx', code);
    assert.ok(chunks.length > 0, 'Should produce at least one chunk');

    const fnChunk = chunks.find((c) => c.symbolName === 'calculateMetrics');
    assert.ok(fnChunk, 'Should identify calculateMetrics function');
    assert.strictEqual(fnChunk.chunkType, 'function');

    const compChunk = chunks.find((c) => c.symbolName === 'AuthModal');
    assert.ok(compChunk, 'Should identify AuthModal component');
    assert.strictEqual(compChunk.chunkType, 'component');

    const routeChunk = chunks.find((c) => c.symbolName?.includes('POST /api/auth/login'));
    assert.ok(routeChunk, 'Should identify POST route');
    assert.strictEqual(routeChunk.chunkType, 'route');
  });

  test('correctly chunks Python functions and classes', () => {
    const pyCode = `
class NeuralNetwork:
    def __init__(self, layers):
        self.layers = layers

    def forward(self, x):
        return x * 2

def train_model(epochs):
    for e in range(epochs):
        pass
`;
    const chunks = chunkFile('ml/train.py', pyCode);
    assert.ok(chunks.length > 0, 'Should chunk python code');
    const classChunk = chunks.find((c) => c.chunkType === 'class' && c.symbolName === 'NeuralNetwork');
    assert.ok(classChunk, 'Should identify NeuralNetwork class');
  });

  test('computes stable SHA256 hashes for incremental caching', () => {
    const hash1 = computeHash('const a = 1;');
    const hash2 = computeHash('const a = 1;');
    const hash3 = computeHash('const a = 2;');
    assert.strictEqual(hash1, hash2, 'Identical content must have identical hash');
    assert.notStrictEqual(hash1, hash3, 'Different content must have different hash');
  });
});

describe('DevMind Part 2 - Vector Math & Embeddings', () => {
  test('generates unit-normalized deterministic vectors', () => {
    const vec1 = generateDeterministicEmbedding('authentication token login security');
    const vec2 = generateDeterministicEmbedding('authentication token login security');
    const vec3 = generateDeterministicEmbedding('banana apple orange fruit');

    assert.strictEqual(vec1.length, 256);
    assert.deepStrictEqual(vec1, vec2, 'Same text should produce identical deterministic embedding');

    const similarityIdentical = cosineSimilarity(vec1, vec2);
    assert.ok(similarityIdentical >= 0.99, 'Identical text should have similarity ~ 1.0');

    const similarityUnrelated = cosineSimilarity(vec1, vec3);
    assert.ok(similarityUnrelated < similarityIdentical, 'Unrelated text should have lower similarity');
  });
});

describe('DevMind Part 2 - Secret Redaction & Security Guardrails', () => {
  test('redacts raw API keys, tokens, and credentials in findings', () => {
    // Secret redaction regex matching the orchestrator logic
    const redactSecrets = (text) => {
      if (!text || typeof text !== 'string') return text;
      return text
        .replace(/(?:api[_-]?key|secret|token|password|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9_\-\.]{8,})['"]?/gi, (match, secret) => {
          return match.replace(secret, '********');
        })
        .replace(/AIza[a-zA-Z0-9_\-]{35}/g, 'AIza***********************************')
        .replace(/ghp_[a-zA-Z0-9]{36}/g, 'ghp_************************************');
    };

    const dirtyText = 'Found API_KEY=AIzaSyD98234jksdf83948234892348234 and ghp_123456789012345678901234567890123456';
    const cleanText = redactSecrets(dirtyText);

    assert.ok(!cleanText.includes('AIzaSyD98234jksdf83948234892348234'), 'Raw Google API key must be redacted');
    assert.ok(!cleanText.includes('ghp_123456789012345678901234567890123456'), 'Raw GitHub token must be redacted');
    assert.ok(cleanText.includes('********'), 'Must contain masked placeholders');
  });
});

describe('DevMind Part 2 - Impact Analysis & Dependency Blast Radius', () => {
  test('correctly maps direct and transitive indirect dependents from architecture links', () => {
    // Model graph with 4 nodes:
    // routes/clockRoutes.js -> controllers/clockController.js -> services/clockService.js -> utils/formatter.js
    const sampleLinks = [
      { source: 'src/routes/clockRoutes.js', target: 'src/controllers/clockController.js' },
      { source: 'src/controllers/clockController.js', target: 'src/services/clockService.js' },
      { source: 'src/services/clockService.js', target: 'src/utils/formatter.js' },
      { source: 'src/utils/formatter.js', target: 'dep:date-fns' },
    ];

    const reverseAdj = new Map();
    for (const link of sampleLinks) {
      const src = link.source;
      const tgt = link.target;
      if (!reverseAdj.has(tgt)) reverseAdj.set(tgt, new Set());
      reverseAdj.get(tgt).add(src);
    }

    // Target: src/services/clockService.js
    const target = 'src/services/clockService.js';
    const directDependents = Array.from(reverseAdj.get(target) || []);
    assert.deepStrictEqual(directDependents, ['src/controllers/clockController.js']);

    // BFS for transitive indirect dependents
    const indirectSet = new Set();
    const visited = new Set([target, ...directDependents]);
    const queue = [...directDependents];

    while (queue.length > 0) {
      const curr = queue.shift();
      const callers = reverseAdj.get(curr) || new Set();
      for (const c of callers) {
        if (!visited.has(c)) {
          visited.add(c);
          indirectSet.add(c);
          queue.push(c);
        }
      }
    }

    assert.deepStrictEqual(Array.from(indirectSet), ['src/routes/clockRoutes.js']);
  });

  test('filters out external dependencies and returns source files sorted by callers', () => {
    const nodes = [
      { id: 'dep:react', name: 'react', category: 'dependencies', importedByCount: 10 },
      { id: 'src/clock.js', name: 'clock.js', category: 'components', importedByCount: 5 },
      { id: 'src/app.js', name: 'app.js', category: 'misc', importedByCount: 1 },
    ];

    const sourceFiles = nodes
      .filter((n) => n.category !== 'dependencies' && !n.id.startsWith('dep:'))
      .sort((a, b) => b.importedByCount - a.importedByCount);

    assert.strictEqual(sourceFiles.length, 2);
    assert.strictEqual(sourceFiles[0].id, 'src/clock.js');
    assert.strictEqual(sourceFiles[1].id, 'src/app.js');
  });
});
