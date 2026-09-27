const CodeChunk = require('../models/CodeChunk');
const { cosineSimilarity } = require('./embeddingService');

/**
 * Vector Store abstraction for indexing and querying semantic code chunks.
 */
class VectorStore {
  /**
   * Persist a batch of code chunks with their vector embeddings into storage.
   */
  async saveChunks(repositoryId, chunks) {
    if (!chunks || !chunks.length) return [];

    const documents = chunks.map((c) => ({
      repository: repositoryId,
      filePath: c.filePath,
      fileHash: c.fileHash,
      language: c.language,
      symbolName: c.symbolName || null,
      chunkType: c.chunkType || 'block',
      startLine: c.startLine,
      endLine: c.endLine,
      content: c.content,
      embedding: c.embedding || [],
      charCount: c.charCount || c.content.length,
    }));

    return CodeChunk.insertMany(documents);
  }

  /**
   * Delete existing chunks for a specific file in a repository.
   */
  async deleteFileChunks(repositoryId, filePath) {
    return CodeChunk.deleteMany({ repository: repositoryId, filePath });
  }

  /**
   * Delete all chunks for a repository.
   */
  async deleteRepositoryChunks(repositoryId) {
    return CodeChunk.deleteMany({ repository: repositoryId });
  }

  /**
   * Get all stored file paths and their latest hashes for incremental indexing.
   */
  async getIndexedFileHashes(repositoryId) {
    const chunks = await CodeChunk.find({ repository: repositoryId })
      .select('filePath fileHash')
      .lean();

    const map = new Map();
    for (const c of chunks) {
      if (!map.has(c.filePath)) {
        map.set(c.filePath, c.fileHash);
      }
    }
    return map;
  }

  /**
   * Perform semantic vector search across chunks for a repository.
   *
   * @param {string|ObjectId} repositoryId
   * @param {Array<number>} queryEmbedding
   * @param {Object} options - { topK, minScore, filters: { filePath, language, symbolName, chunkType } }
   */
  async searchSimilar(repositoryId, queryEmbedding, options = {}) {
    const {
      topK = 8,
      minScore = 0.15,
      filters = {},
    } = options;

    const mongoFilter = { repository: repositoryId };

    if (filters.filePath) {
      if (typeof filters.filePath === 'string') {
        mongoFilter.filePath = filters.filePath;
      } else if (Array.isArray(filters.filePath)) {
        mongoFilter.filePath = { $in: filters.filePath };
      }
    }

    if (filters.language) {
      mongoFilter.language = filters.language;
    }

    if (filters.chunkType) {
      if (Array.isArray(filters.chunkType)) {
        mongoFilter.chunkType = { $in: filters.chunkType };
      } else {
        mongoFilter.chunkType = filters.chunkType;
      }
    }

    if (filters.symbolName) {
      mongoFilter.symbolName = new RegExp(filters.symbolName, 'i');
    }

    const candidateChunks = await CodeChunk.find(mongoFilter)
      .select('filePath language symbolName chunkType startLine endLine content embedding charCount')
      .lean();

    if (!candidateChunks.length) {
      return [];
    }

    // Compute cosine similarity against query embedding
    const scoredChunks = candidateChunks
      .map((chunk) => {
        const score = cosineSimilarity(queryEmbedding, chunk.embedding);
        return {
          _id: chunk._id,
          filePath: chunk.filePath,
          language: chunk.language,
          symbolName: chunk.symbolName,
          chunkType: chunk.chunkType,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          content: chunk.content,
          charCount: chunk.charCount,
          relevanceScore: Number(score.toFixed(4)),
        };
      })
      .filter((chunk) => chunk.relevanceScore >= minScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topK);

    return scoredChunks;
  }

  /**
   * Retrieve statistics on chunks indexed for a repository.
   */
  async getRepositoryStats(repositoryId) {
    const totalChunks = await CodeChunk.countDocuments({ repository: repositoryId });
    const distinctFiles = await CodeChunk.distinct('filePath', { repository: repositoryId });
    const distinctLanguages = await CodeChunk.distinct('language', { repository: repositoryId });

    return {
      totalChunks,
      totalFiles: distinctFiles.length,
      languages: distinctLanguages,
      files: distinctFiles,
    };
  }
}

module.exports = new VectorStore();
