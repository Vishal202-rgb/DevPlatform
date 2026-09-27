const { getEmbedding } = require('./embeddingService');
const vectorStore = require('./vectorStore');

/**
 * Semantic retrieval service for querying repository knowledge base with structured evidence.
 */
class RetrievalService {
  /**
   * Retrieve most relevant code chunks for a user query with evidence citations.
   *
   * @param {Object} params
   * @param {string} params.repositoryId
   * @param {string} params.query
   * @param {Object} [params.filters] - { filePath, language, symbolName, chunkType }
   * @param {number} [params.topK=6]
   * @param {number} [params.minScore=0.15]
   */
  async retrieveContext({ repositoryId, query, filters = {}, topK = 6, minScore = 0.15 }) {
    if (!repositoryId || !query) {
      return { chunks: [], evidence: [], formattedContext: '' };
    }

    // 1. Generate embedding for query
    const queryEmbedding = await getEmbedding(query);

    // 2. Perform vector search in VectorStore
    const chunks = await vectorStore.searchSimilar(repositoryId, queryEmbedding, {
      topK,
      minScore,
      filters,
    });

    if (!chunks.length) {
      return {
        chunks: [],
        evidence: [],
        formattedContext: '',
      };
    }

    // 3. Format structured evidence
    const evidence = chunks.map((c) => ({
      filePath: c.filePath,
      startLine: c.startLine,
      endLine: c.endLine,
      symbolName: c.symbolName,
      chunkType: c.chunkType,
      language: c.language,
      relevanceScore: c.relevanceScore,
    }));

    // 4. Construct formatted context string for LLM injection
    const formattedContext = chunks
      .map((c) => {
        const symbolLabel = c.symbolName ? ` [Symbol: ${c.symbolName}]` : '';
        return `=== FILE: ${c.filePath} (Lines ${c.startLine}-${c.endLine})${symbolLabel} ===\n${c.content}`;
      })
      .join('\n\n');

    return {
      chunks,
      evidence,
      formattedContext,
    };
  }

  /**
   * Context builder specifically tailored for specialized modes (e.g. security, architecture, debugging).
   */
  async retrieveModeContext({ repositoryId, query, mode = 'codebase', extraContext = {} }) {
    let filters = {};

    if (mode === 'security') {
      filters.chunkType = ['route', 'function', 'module', 'block'];
    } else if (mode === 'debugging') {
      filters.chunkType = ['function', 'class', 'component', 'route', 'block'];
    }

    const { chunks, evidence, formattedContext } = await this.retrieveContext({
      repositoryId,
      query,
      filters,
      topK: mode === 'architecture' ? 4 : 6,
    });

    let enrichedContext = formattedContext;

    // Inject Architecture Graph context if mode is architecture or if available
    if (extraContext.architectureGraphSummary) {
      enrichedContext = `=== ARCHITECTURE GRAPH SUMMARY ===\n${extraContext.architectureGraphSummary}\n\n${enrichedContext}`;
    }

    // Inject Recent Issues context if in debugging mode
    if (extraContext.recentIssuesSummary) {
      enrichedContext = `=== RECENT ISSUES CONTEXT ===\n${extraContext.recentIssuesSummary}\n\n${enrichedContext}`;
    }

    return {
      chunks,
      evidence,
      formattedContext: enrichedContext,
    };
  }
}

module.exports = new RetrievalService();
