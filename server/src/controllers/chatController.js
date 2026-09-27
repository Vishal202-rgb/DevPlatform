const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository');
const ArchitectureGraph = require('../models/ArchitectureGraph');
const Analysis = require('../models/Analysis');
const retrievalService = require('../services/retrievalService');
const geminiService = require('../services/geminiService');
const githubService = require('../services/githubService');
const vectorStore = require('../services/vectorStore');
const { isAnalyzablePath } = require('../utils/fileFilters');

const chatWithRepository = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { message, mode = 'codebase', history = [] } = req.body;

  if (!message || !message.trim()) {
    throw new ApiError(400, 'Message is required');
  }

  const repo = await Repository.findOne({ _id: repositoryId, user: req.user.id });
  if (!repo) {
    throw new ApiError(404, 'Repository not found');
  }

  // 1. Check if vector chunks exist for this repository
  const stats = await vectorStore.getRepositoryStats(repo._id);
  const extraContext = {};

  // 2. Fetch mode-specific context augmentations
  if (mode === 'architecture') {
    const archGraph = await ArchitectureGraph.findOne({ repository: repo._id }).lean();
    if (archGraph) {
      extraContext.architectureGraphSummary = `Architecture Graph Nodes: ${archGraph.nodes.length}, Edges: ${archGraph.edges.length}\nCategories: ${JSON.stringify(archGraph.metrics?.categoryBreakdown || {})}\nCycles: ${archGraph.metrics?.cyclicDependencies?.length || 0}\nBottlenecks: ${archGraph.metrics?.dependencyBottlenecks?.map((b) => b.path).join(', ') || 'None'}`;
    }
  } else if (mode === 'debugging') {
    const latestAnalysis = await Analysis.findOne({ repository: repo._id, status: 'completed' })
      .sort({ createdAt: -1 })
      .select('summary issues')
      .lean();
    if (latestAnalysis && latestAnalysis.issues?.length) {
      extraContext.recentIssuesSummary = latestAnalysis.issues
        .slice(0, 5)
        .map((iss) => `[${iss.severity.toUpperCase()}] ${iss.file}:${iss.line || 1} - ${iss.description}`)
        .join('\n');
    }
  }

  let evidence = [];
  let formattedContext = '';

  if (stats.totalChunks > 0) {
    // 3A. RAG Knowledge Base Retrieval Pipeline
    const ragResult = await retrievalService.retrieveModeContext({
      repositoryId: repo._id,
      query: message,
      mode,
      extraContext,
    });

    evidence = ragResult.evidence;
    formattedContext = ragResult.formattedContext;
  } else {
    // 3B. Safe Fallback: GitHub tree search if RAG is not yet indexed
    try {
      const userWithGithub = await githubService.getUserWithGithubToken(req.user.id);
      const accessToken = userWithGithub.github.accessToken;

      const tree = await githubService.fetchRepositoryTree(
        accessToken,
        repo.githubOwner,
        repo.name,
        repo.defaultBranch
      );

      const treePaths = tree
        .filter((entry) => entry.type === 'blob' && isAnalyzablePath(entry.path))
        .map((entry) => entry.path);

      let relevantPaths = [];
      if (treePaths.length > 0) {
        relevantPaths = await geminiService.findRelevantFiles(repo.fullName, treePaths, message);
      }

      const files = [];
      let totalChars = 0;
      const MAX_TOTAL_CHARS = 120_000;

      for (const path of relevantPaths.slice(0, 6)) {
        const entry = tree.find((e) => e.path === path);
        if (!entry || totalChars >= MAX_TOTAL_CHARS) continue;

        const content = await githubService.fetchBlobContent(
          accessToken,
          repo.githubOwner,
          repo.name,
          entry.sha
        );
        if (!content) continue;

        const remaining = MAX_TOTAL_CHARS - totalChars;
        const truncated = content.length > remaining;
        const finalContent = truncated ? content.slice(0, remaining) : content;

        files.push({ path: entry.path, content: finalContent, truncated });
        totalChars += finalContent.length;

        evidence.push({
          filePath: entry.path,
          startLine: 1,
          endLine: finalContent.split('\n').length,
          symbolName: null,
          chunkType: 'module',
          relevanceScore: 0.85,
        });
      }

      formattedContext = files
        .map((f) => `=== FILE: ${f.path} ===\n${f.content}${f.truncated ? '\n... (truncated)' : ''}`)
        .join('\n\n');
    } catch (fallbackErr) {
      // If GitHub fetch fails, proceed with general context
    }
  }

  // 4. Generate answer via Gemini with mode-specific instructions
  const response = await geminiService.chatWithRAG(
    repo.fullName,
    formattedContext,
    message,
    mode,
    history
  );

  res.status(200).json({
    success: true,
    data: {
      reply: response.reply,
      evidence,
      mode,
      evidenceCount: evidence.length,
    },
  });
});

module.exports = {
  chatWithRepository,
};
