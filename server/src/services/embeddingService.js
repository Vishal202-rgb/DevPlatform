const axios = require('axios');
const crypto = require('crypto');
const env = require('../config/env');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
const EMBEDDING_DIMENSION = 256; // Standardized vector dimension for normalized fallback/projection

// In-memory cache for embeddings: sha256(text) -> [number]
const embeddingCache = new Map();

/**
 * Deterministic fallback embedding generation based on term frequency and token hashing.
 * Guarantees a unit-normalized vector of fixed dimensions so cosine similarity works
 * predictably even when Gemini embedding API is not configured or in offline/test environments.
 */
const generateDeterministicEmbedding = (text, dimensions = EMBEDDING_DIMENSION) => {
  const vec = new Array(dimensions).fill(0);
  if (!text || typeof text !== 'string') return vec;

  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (!tokens.length) return vec;

  for (const token of tokens) {
    const hash = crypto.createHash('sha256').update(token).digest();
    // Use first 4 bytes as unsigned int
    const bucket = hash.readUInt32BE(0) % dimensions;
    const sign = (hash[4] % 2 === 0) ? 1 : -1;
    vec[bucket] += sign * (1 + Math.log(1 + token.length));
  }

  // Normalize to unit vector L2 norm
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vec[i] = Number((vec[i] / norm).toFixed(6));
    }
  }

  return vec;
};

/**
 * Generate embedding for a single text string using Gemini Embedding API
 * with automatic caching and fallback.
 */
const getEmbedding = async (text) => {
  if (!text || typeof text !== 'string') {
    return generateDeterministicEmbedding('');
  }

  const cleanText = text.slice(0, 8000).trim();
  const cacheKey = crypto.createHash('sha256').update(cleanText).digest('hex');

  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }

  if (!env.geminiApiKey) {
    const fallback = generateDeterministicEmbedding(cleanText);
    embeddingCache.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const url = `${GEMINI_API_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${env.geminiApiKey}`;
    const response = await axios.post(
      url,
      {
        model: `models/${EMBEDDING_MODEL}`,
        content: {
          parts: [{ text: cleanText }],
        },
      },
      {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const values = response.data?.embedding?.values;
    if (Array.isArray(values) && values.length > 0) {
      embeddingCache.set(cacheKey, values);
      return values;
    }
  } catch (err) {
    // Graceful fallback on API error or rate limit
    // eslint-disable-next-line no-console
    console.warn(`[embeddingService] Gemini embedding call failed (${err.message}). Using fallback vector.`);
  }

  const fallback = generateDeterministicEmbedding(cleanText);
  embeddingCache.set(cacheKey, fallback);
  return fallback;
};

/**
 * Generate embeddings for multiple text strings in batches.
 */
const getBatchEmbeddings = async (texts, batchSize = 10) => {
  if (!Array.isArray(texts)) return [];

  const results = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map((t) => getEmbedding(t));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
};

/**
 * Calculates cosine similarity between two numeric vectors.
 */
const cosineSimilarity = (vecA, vecB) => {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

  const len = Math.min(vecA.length, vecB.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, similarity));
};

module.exports = {
  getEmbedding,
  getBatchEmbeddings,
  cosineSimilarity,
  generateDeterministicEmbedding,
};
