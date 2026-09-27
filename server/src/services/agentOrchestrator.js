const AgentRun = require('../models/AgentRun');
const Repository = require('../models/Repository');
const ArchitectureGraph = require('../models/ArchitectureGraph');
const retrievalService = require('./retrievalService');
const geminiService = require('./geminiService');
const architectureService = require('./architectureService');
const githubService = require('./githubService');
const CodeChunk = require('../models/CodeChunk');
const securityScannerService = require('./securityScannerService');
const { isAnalyzablePath } = require('../utils/fileFilters');
const ApiError = require('../utils/ApiError');

// Strict Secret Redaction utility
const redactSecrets = (text) => securityScannerService.redactSecrets(text);

const AGENT_SCHEMAS = {
  type: 'OBJECT',
  properties: {
    findings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          severity: { type: 'STRING', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          confidence: { type: 'NUMBER', description: 'Confidence score between 0.0 and 1.0' },
          filePath: { type: 'STRING', description: 'Exact relative file path in repository' },
          startLine: { type: 'INTEGER' },
          endLine: { type: 'INTEGER' },
          evidence: { type: 'STRING', description: 'Exact line citations and snippet code evidence' },
          recommendation: { type: 'STRING' },
          suggestedFix: { type: 'STRING' },
        },
        required: ['title', 'description', 'severity', 'confidence', 'filePath', 'evidence', 'recommendation'],
      },
    },
  },
  required: ['findings'],
};

class AgentOrchestrator {
  /**
   * Run multi-agent intelligence analysis on a repository.
   *
   * @param {string} repositoryId
   * @param {string} userId
   * @param {Object} options - { agents: ['bug', 'security', 'architecture', 'test', 'performance'], files: [] }
   */
  async runAgents(repositoryId, userId, options = {}) {
    const startTime = Date.now();
    const requestedAgents = options.agents || ['bug', 'security', 'architecture', 'test', 'performance'];

    const repo = await Repository.findOne({ _id: repositoryId, user: userId });
    if (!repo) {
      throw new ApiError(404, 'Repository not found');
    }

    // Initialize agent run record
    const agentRun = await AgentRun.create({
      repository: repositoryId,
      user: userId,
      status: 'running',
      agentsExecuted: requestedAgents,
      findings: [],
    });

    try {
      // 1. Gather repository context (AST chunks + Architecture Graph)
      let archGraph = await ArchitectureGraph.findOne({ repository: repositoryId });
      if (!archGraph) {
        try {
          archGraph = await architectureService.getOrGenerateGraph(repositoryId, userId);
        } catch (err) {
          // Continue if architecture generation fails
        }
      }

      const allFindings = [];
      let securityMetadata = null;

      // Execute each requested agent sequentially or in targeted batches
      for (const agentType of requestedAgents) {
        try {
          const result = await this.executeSingleAgent(agentType, repo, archGraph, userId, options);
          if (agentType === 'security' && result && typeof result === 'object' && !Array.isArray(result) && result.findings) {
            allFindings.push(...result.findings);
            securityMetadata = {
              filesScanned: result.filesScanned || 0,
              rulesEvaluated: result.rulesEvaluated || 0,
              securityScore: result.securityScore !== undefined ? result.securityScore : 100,
            };
          } else if (Array.isArray(result)) {
            allFindings.push(...result);
          }
        } catch (agentErr) {
          // eslint-disable-next-line no-console
          console.error(`[AgentOrchestrator] Error running agent ${agentType}:`, agentErr);
        }
      }

      // Redact all sensitive tokens / secrets from descriptions, evidence, and suggestions
      const sanitizedFindings = allFindings.map((f) => ({
        agent: f.agent,
        title: redactSecrets(f.title),
        description: redactSecrets(f.description || f.explanation || ''),
        severity: ['critical', 'high', 'medium', 'low', 'info'].includes(f.severity) ? f.severity : 'medium',
        confidence: typeof f.confidence === 'number' ? Math.max(0.1, Math.min(1.0, f.confidence)) : 0.85,
        filePath: f.filePath,
        startLine: f.startLine || f.lineNumber || null,
        endLine: f.endLine || f.lineNumber || null,
        evidence: redactSecrets(f.evidence || ''),
        recommendation: redactSecrets(f.recommendation || ''),
        suggestedFix: redactSecrets(f.suggestedFix || ''),
      }));

      const securityFindings = sanitizedFindings.filter((f) => f.agent === 'security');
      const calculatedScore = securityScannerService.computeSecurityScore(securityFindings);

      // Compute summary metrics
      const summary = {
        totalFindings: sanitizedFindings.length,
        critical: sanitizedFindings.filter((f) => f.severity === 'critical').length,
        high: sanitizedFindings.filter((f) => f.severity === 'high').length,
        medium: sanitizedFindings.filter((f) => f.severity === 'medium').length,
        low: sanitizedFindings.filter((f) => f.severity === 'low').length,
        byAgent: {
          bug: sanitizedFindings.filter((f) => f.agent === 'bug').length,
          security: securityFindings.length,
          architecture: sanitizedFindings.filter((f) => f.agent === 'architecture').length,
          test: sanitizedFindings.filter((f) => f.agent === 'test').length,
          performance: sanitizedFindings.filter((f) => f.agent === 'performance').length,
        },
        filesScanned: securityMetadata ? securityMetadata.filesScanned : 0,
        rulesEvaluated: securityMetadata ? securityMetadata.rulesEvaluated : 0,
        securityScore: securityMetadata?.securityScore !== undefined ? securityMetadata.securityScore : calculatedScore,
      };

      // Save completed run
      agentRun.status = 'completed';
      agentRun.findings = sanitizedFindings;
      agentRun.summary = summary;
      agentRun.durationMs = Date.now() - startTime;
      await agentRun.save();

      return agentRun;
    } catch (err) {
      agentRun.status = 'failed';
      agentRun.error = err.message;
      agentRun.durationMs = Date.now() - startTime;
      await agentRun.save();
      throw err;
    }
  }

  /**
   * Execute a single specialized AI agent.
   */
  async executeSingleAgent(agentType, repo, archGraph, userId, options = {}) {
    switch (agentType) {
      case 'bug':
        return this.runBugAgent(repo, userId, options);
      case 'security':
        return this.runSecurityAgent(repo, userId, options);
      case 'architecture':
        return this.runArchitectureAgent(repo, archGraph, options);
      case 'test':
        return this.runTestAgent(repo, userId, options);
      case 'performance':
        return this.runPerformanceAgent(repo, userId, options);
      default:
        return [];
    }
  }

  /**
   * 1. BUG AGENT: Detects null/undefined, race conditions, async/await, unhandled errors, logic bugs.
   */
  async runBugAgent(repo, userId) {
    const { formattedContext } = await retrievalService.retrieveContext({
      repositoryId: repo._id,
      query: 'async await error handling try catch null undefined edge case race condition state validation',
      topK: 8,
    });

    if (!formattedContext) return [];

    const prompt = `Repository: ${repo.fullName}
You are the BUG DETECTION AGENT in DevMind.
Analyze the provided code chunks for:
- Null / undefined reference risks
- Incorrect conditional logic and boundary off-by-one errors
- Broken async/await handling, unhandled Promise rejections, missing await
- Missing error handling and empty catch blocks
- Race conditions in state or asynchronous workflows
- Logical inconsistencies in domain operations

CRITICAL RULES:
- Ground all findings strictly on the code provided below.
- Do not speculate or report hypothetical bugs without verifiable line-level evidence.
- If you find no definitive bugs in the context, return an empty findings list.

Code Context:
${formattedContext}`;

    const rawFindings = await this.callAgentGemini(prompt, 'BUG AGENT');
    return rawFindings.map((f) => ({ ...f, agent: 'bug' }));
  }

  /**
   * 2. SECURITY AGENT: Real repository source file analyzer using deterministic rules + Gemini AI review.
   */
  async runSecurityAgent(repo, userId, options = {}) {
    let files = options.files || [];

    // 1. If files are not directly provided in options, fetch actual repository source files from GitHub
    if (!files.length && userId) {
      try {
        const userWithGithub = await githubService.getUserWithGithubToken(userId);
        const accessToken = userWithGithub?.github?.accessToken;
        if (accessToken && repo.githubOwner && repo.name && repo.defaultBranch) {
          const result = await githubService.fetchSourceFiles(
            accessToken,
            repo.githubOwner,
            repo.name,
            repo.defaultBranch
          );
          files = result?.files || [];
        }
      } catch (ghErr) {
        // Fall back to database code chunks if GitHub token is unavailable/expired
      }
    }

    // 2. Fallback to indexed repository CodeChunks if GitHub retrieval returned no files
    if (!files.length && repo._id) {
      try {
        const chunks = await CodeChunk.find({ repository: repo._id }).lean();
        if (chunks && chunks.length > 0) {
          const fileChunksMap = new Map();
          for (const chunk of chunks) {
            if (!fileChunksMap.has(chunk.filePath)) {
              fileChunksMap.set(chunk.filePath, []);
            }
            fileChunksMap.get(chunk.filePath).push(chunk);
          }

          for (const [filePath, chunkList] of fileChunksMap.entries()) {
            chunkList.sort((a, b) => (a.startLine || 0) - (b.startLine || 0));
            const reconstructedContent = chunkList.map((c) => c.content).join('\n\n');
            files.push({ path: filePath, content: reconstructedContent });
          }
        }
      } catch (_chunkErr) {
        // Continue
      }
    }

    // If zero files could be retrieved, return clean zero-count result without claiming unverified scan
    if (!files.length) {
      return {
        findings: [],
        filesScanned: 0,
        rulesEvaluated: 0,
        securityScore: 100,
        supportedFiles: [],
        skippedFiles: 0,
        durationMs: 0,
      };
    }

    // 3. Deterministic Language-Aware Rule Scanning
    const scanResult = securityScannerService.scanFiles(files, { repoName: repo.fullName });

    // 4. AI-Powered Security Review & False Positive Reduction
    const filesMap = new Map(files.map((f) => [f.path, f.content]));
    let reviewedFindings = scanResult.findings;

    if (scanResult.findings.length > 0) {
      try {
        reviewedFindings = await securityScannerService.reviewFindingsWithAI(scanResult.findings, filesMap);
      } catch (_aiErr) {
        // Keep deterministic findings on AI failure
      }
    }

    // Recompute score after AI review
    const finalScore = securityScannerService.computeSecurityScore(reviewedFindings);

    return {
      findings: reviewedFindings,
      filesScanned: scanResult.filesScanned,
      rulesEvaluated: scanResult.rulesEvaluated,
      securityScore: finalScore,
      supportedFiles: scanResult.supportedFiles,
      skippedFiles: scanResult.skippedFiles,
      durationMs: scanResult.durationMs,
    };
  }

  /**
   * 3. ARCHITECTURE AGENT: Uses ArchitectureGraph to analyze cycles, coupling, oversized modules, and bottlenecks.
   */
  async runArchitectureAgent(repo, archGraph) {
    if (!archGraph || !archGraph.nodes || !archGraph.nodes.length) {
      return [];
    }

    const graphSummary = {
      totalNodes: archGraph.nodes.length,
      totalEdges: archGraph.edges.length,
      cyclicDependencies: archGraph.metrics?.cyclicDependencies || [],
      bottlenecks: archGraph.metrics?.dependencyBottlenecks || [],
      categories: archGraph.metrics?.categoryBreakdown || {},
      nodesSample: archGraph.nodes.slice(0, 30).map((n) => ({
        path: n.path,
        category: n.category,
        degree: n.degree,
        inDegree: n.inDegree,
        outDegree: n.outDegree,
      })),
    };

    const prompt = `Repository: ${repo.fullName}
You are the ARCHITECTURE AGENT in DevMind.
Analyze the repository's verified Architecture Graph and structure for:
- Circular dependencies between modules
- Highly coupled modules / god components
- Dependency bottlenecks (modules with excessive dependents or dependencies)
- Separation of concerns violations (e.g., database queries directly in presentation components or route handlers)
- Architecture anti-patterns

Graph Data:
${JSON.stringify(graphSummary, null, 2)}`;

    const rawFindings = await this.callAgentGemini(prompt, 'ARCHITECTURE AGENT');
    return rawFindings.map((f) => ({ ...f, agent: 'architecture' }));
  }

  /**
   * 4. TEST AGENT: Evaluates test gaps, missing boundary tests, and critical untested business logic.
   */
  async runTestAgent(repo, userId) {
    const { formattedContext } = await retrievalService.retrieveContext({
      repositoryId: repo._id,
      query: 'test spec describe it expect assert mock controller service handler',
      topK: 6,
    });

    if (!formattedContext) return [];

    const prompt = `Repository: ${repo.fullName}
You are the TEST AUTOMATION AGENT in DevMind.
Analyze the code and identify:
- Critical business logic and service methods lacking test coverage
- Uncovered boundary and error condition scenarios
- Test quality issues (e.g., tests without assertions, missing mocks for external network/DB calls)
- Recommended test cases with concrete assertions

Code Context:
${formattedContext}`;

    const rawFindings = await this.callAgentGemini(prompt, 'TEST AGENT');
    return rawFindings.map((f) => ({ ...f, agent: 'test' }));
  }

  /**
   * 5. PERFORMANCE AGENT: Identifies N+1 queries, memory leaks, blocking loops, redundant operations.
   */
  async runPerformanceAgent(repo, userId) {
    const { formattedContext } = await retrievalService.retrieveContext({
      repositoryId: repo._id,
      query: 'find query loop async await map filter reduce memo cache heavy computation performance',
      topK: 6,
    });

    if (!formattedContext) return [];

    const prompt = `Repository: ${repo.fullName}
You are the PERFORMANCE AGENT in DevMind.
Analyze the code for:
- N+1 database queries inside loops or request handlers
- Synchronous blocking operations in asynchronous request handlers
- Memory leaks (unbounded caches, listeners not cleaned up)
- Redundant re-computations or expensive operations without caching
- Unnecessary large payload transfers

Code Context:
${formattedContext}`;

    const rawFindings = await this.callAgentGemini(prompt, 'PERFORMANCE AGENT');
    return rawFindings.map((f) => ({ ...f, agent: 'performance' }));
  }

  /**
   * Internal helper to query Gemini with structured output schema.
   */
  async callAgentGemini(prompt, agentName) {
    try {
      const { response } = await geminiService.callGeminiWithRetryAndFallback(
        () => ({
          systemInstruction: {
            role: 'system',
            parts: [
              {
                text: `You are a specialized software engineering AI agent (${agentName}) for DevMind.
Strictly adhere to the provided JSON schema. Ground every finding in actual code evidence with line numbers.`,
              },
            ],
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            responseSchema: AGENT_SCHEMAS,
          },
        })
      );

      const candidate = response.data?.candidates?.[0];
      const rawText = candidate?.content?.parts?.map((p) => p.text).join('') || '';
      if (!rawText.trim()) return [];

      const parsed = JSON.parse(rawText);
      return Array.isArray(parsed.findings) ? parsed.findings : [];
    } catch (err) {
      // Return empty array on parse or API failure to prevent agent orchestrator crash
      return [];
    }
  }

  /**
   * Get past agent runs for a repository.
   */
  async getAgentRuns(repositoryId, limit = 10) {
    return AgentRun.find({ repository: repositoryId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get a single agent run by ID.
   */
  async getAgentRunById(runId) {
    return AgentRun.findById(runId).lean();
  }
}

module.exports = new AgentOrchestrator();
