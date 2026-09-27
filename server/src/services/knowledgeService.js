const Repository = require('../models/Repository');
const githubService = require('./githubService');
const { isAnalyzablePath } = require('../utils/fileFilters');
const { chunkFile, computeHash } = require('./chunkingService');
const { getBatchEmbeddings } = require('./embeddingService');
const vectorStore = require('./vectorStore');
const ApiError = require('../utils/ApiError');

class KnowledgeService {
  /**
   * Index or incrementally re-index a repository into the RAG Knowledge Base.
   *
   * @param {string} repositoryId
   * @param {string} userId
   * @param {Function} [onProgress]
   */
  async indexRepository(repositoryId, userId, onProgress = () => {}) {
    const repo = await Repository.findOne({ _id: repositoryId, user: userId });
    if (!repo) {
      throw new ApiError(404, 'Repository not found');
    }

    // Set indexing status
    repo.knowledgeIndex = {
      ...repo.knowledgeIndex,
      status: 'indexing',
      error: null,
    };
    await repo.save();

    onProgress({ step: 'discovering', message: 'Discovering repository source tree...' });

    try {
      const userWithGithub = await githubService.getUserWithGithubToken(userId);
      const accessToken = userWithGithub.github.accessToken;

      // 1. Fetch file tree
      const tree = await githubService.fetchRepositoryTree(
        accessToken,
        repo.githubOwner,
        repo.name,
        repo.defaultBranch
      );

      // 2. Filter analyzable paths (excludes node_modules, lockfiles, .env, binaries, etc.)
      const analyzableBlobs = tree.filter(
        (entry) => entry.type === 'blob' && isAnalyzablePath(entry.path)
      );

      if (!analyzableBlobs.length) {
        repo.knowledgeIndex = {
          status: 'indexed',
          lastIndexedAt: new Date(),
          chunkCount: 0,
          fileCount: 0,
          error: null,
        };
        await repo.save();
        return {
          totalFiles: 0,
          totalChunks: 0,
          indexedFiles: 0,
          skippedUnchanged: 0,
        };
      }

      onProgress({
        step: 'filtering',
        message: `Found ${analyzableBlobs.length} source files. Checking cache for changes...`,
      });

      // 3. Get existing indexed hashes for incremental indexing
      const existingHashes = await vectorStore.getIndexedFileHashes(repo._id);

      let indexedFilesCount = 0;
      let skippedUnchangedCount = 0;
      const allNewChunks = [];

      // Limit max files processed in single pass for performance / memory safety
      const maxFilesToProcess = Math.min(analyzableBlobs.length, 120);

      for (let i = 0; i < maxFilesToProcess; i++) {
        const entry = analyzableBlobs[i];
        onProgress({
          step: 'fetching',
          message: `Processing (${i + 1}/${maxFilesToProcess}): ${entry.path}`,
        });

        // Fetch blob content
        const content = await githubService.fetchBlobContent(
          accessToken,
          repo.githubOwner,
          repo.name,
          entry.sha
        );

        if (!content || typeof content !== 'string') continue;

        const currentHash = computeHash(content);
        const previousHash = existingHashes.get(entry.path);

        // Incremental check: Skip file if hash is identical and chunks exist
        if (previousHash && previousHash === currentHash) {
          skippedUnchangedCount++;
          continue;
        }

        // Delete old chunks for this modified file
        if (previousHash) {
          await vectorStore.deleteFileChunks(repo._id, entry.path);
        }

        // 4. Logical AST/Symbol Chunking
        const fileChunks = chunkFile(entry.path, content);
        if (fileChunks.length > 0) {
          allNewChunks.push(...fileChunks);
          indexedFilesCount++;
        }
      }

      onProgress({
        step: 'embedding',
        message: `Generating vector embeddings for ${allNewChunks.length} logical code chunks...`,
      });

      // 5. Generate Vector Embeddings in batches
      if (allNewChunks.length > 0) {
        const textsToEmbed = allNewChunks.map(
          (c) => `${c.filePath} ${c.symbolName || ''}\n${c.content}`
        );

        const embeddings = await getBatchEmbeddings(textsToEmbed, 15);
        for (let j = 0; j < allNewChunks.length; j++) {
          allNewChunks[j].embedding = embeddings[j];
        }

        // 6. Save to Vector Store (CodeChunk collection)
        await vectorStore.saveChunks(repo._id, allNewChunks);
      }

      // 7. Update repository stats
      const stats = await vectorStore.getRepositoryStats(repo._id);

      repo.knowledgeIndex = {
        status: 'indexed',
        lastIndexedAt: new Date(),
        chunkCount: stats.totalChunks,
        fileCount: stats.totalFiles,
        error: null,
      };
      await repo.save();

      onProgress({
        step: 'completed',
        message: `Knowledge base indexing complete. ${stats.totalChunks} chunks indexed across ${stats.totalFiles} files.`,
      });

      return {
        totalFiles: stats.totalFiles,
        totalChunks: stats.totalChunks,
        indexedFiles: indexedFilesCount,
        skippedUnchanged: skippedUnchangedCount,
        languages: stats.languages,
      };
    } catch (err) {
      repo.knowledgeIndex = {
        ...repo.knowledgeIndex,
        status: 'failed',
        error: err.message,
      };
      await repo.save();
      throw err;
    }
  }

  /**
   * Get the current knowledge base status for a repository.
   */
  async getStatus(repositoryId, userId) {
    const repo = await Repository.findOne({ _id: repositoryId, user: userId });
    if (!repo) {
      throw new ApiError(404, 'Repository not found');
    }

    const stats = await vectorStore.getRepositoryStats(repositoryId);

    return {
      status: repo.knowledgeIndex?.status || 'not_indexed',
      lastIndexedAt: repo.knowledgeIndex?.lastIndexedAt || null,
      chunkCount: stats.totalChunks || repo.knowledgeIndex?.chunkCount || 0,
      fileCount: stats.totalFiles || repo.knowledgeIndex?.fileCount || 0,
      languages: stats.languages || [],
      error: repo.knowledgeIndex?.error || null,
    };
  }
}

module.exports = new KnowledgeService();
