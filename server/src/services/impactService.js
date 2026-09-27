const ArchitectureGraph = require('../models/ArchitectureGraph');
const Repository = require('../models/Repository');
const architectureService = require('./architectureService');
const retrievalService = require('./retrievalService');
const geminiService = require('./geminiService');
const ApiError = require('../utils/ApiError');

class ImpactService {
  /**
   * Calculate blast radius and AI impact analysis for a specific target file or symbol.
   *
   * @param {string} repositoryId
   * @param {string} targetPath - Relative file path in repository
   * @param {string} [targetSymbol] - Optional function or class name
   * @param {string} userId
   */
  async analyzeImpact(repositoryId, targetPath, targetSymbol, userId) {
    if (!targetPath) {
      throw new ApiError(400, 'Target file path is required for impact analysis');
    }

    const repo = await Repository.findOne({ _id: repositoryId, user: userId });
    if (!repo) {
      throw new ApiError(404, 'Repository not found');
    }

    // 1. Fetch or generate ArchitectureGraph
    let archGraph = await ArchitectureGraph.findOne({ repository: repositoryId });
    if (!archGraph || !archGraph.nodes?.length) {
      try {
        archGraph = await architectureService.getOrGenerateGraph(repositoryId, userId);
      } catch (err) {
        archGraph = { nodes: [], links: [] };
      }
    }

    const nodes = archGraph?.nodes || [];
    const links = archGraph?.links || archGraph?.edges || [];

    // Normalize paths
    const normTarget = targetPath.replace(/\\/g, '/');
    const targetNode = nodes.find(
      (n) => (n.path && n.path.replace(/\\/g, '/') === normTarget) || (n.id && n.id.replace(/\\/g, '/') === normTarget)
    );
    const actualTargetId = targetNode ? targetNode.id : normTarget;

    // 2. Build reverse dependency graph (importers / callers)
    // Link: source -> target (source imports target)
    // So dependents of target are sources where link.target == target
    const reverseAdj = new Map(); // target -> Set of sources
    const directAdj = new Map(); // source -> Set of targets

    for (const link of links) {
      const src = (link.source?.id || link.source || '').replace(/\\/g, '/');
      const tgt = (link.target?.id || link.target || '').replace(/\\/g, '/');
      if (!src || !tgt) continue;

      if (!reverseAdj.has(tgt)) reverseAdj.set(tgt, new Set());
      reverseAdj.get(tgt).add(src);

      if (!directAdj.has(src)) directAdj.set(src, new Set());
      directAdj.get(src).add(tgt);
    }

    // 3. Find Direct Dependents
    const directSet = new Set([
      ...(reverseAdj.get(actualTargetId) || []),
      ...(reverseAdj.get(normTarget) || []),
    ]);
    directSet.delete(actualTargetId);
    directSet.delete(normTarget);

    const findNodeInfo = (p) => {
      const node = nodes.find(
        (n) => n.id === p || n.path === p || (n.path && n.path.replace(/\\/g, '/') === p)
      );
      return {
        path: node?.path || node?.id || p,
        label: node?.name || node?.path || p,
        category: node?.category || 'misc',
      };
    };

    const directDependents = Array.from(directSet).map((p) => ({
      ...findNodeInfo(p),
      isDirect: true,
    }));

    // 4. Find Indirect Dependents (Transitive BFS up to 6 levels)
    const indirectSet = new Set();
    const visited = new Set([actualTargetId, normTarget, ...directSet]);
    const queue = Array.from(directSet);

    let depth = 0;
    const MAX_DEPTH = 6;

    while (queue.length > 0 && depth < MAX_DEPTH) {
      const levelSize = queue.length;
      for (let i = 0; i < levelSize; i++) {
        const current = queue.shift();
        const callers = reverseAdj.get(current) || new Set();
        for (const c of callers) {
          if (!visited.has(c)) {
            visited.add(c);
            indirectSet.add(c);
            queue.push(c);
          }
        }
      }
      depth++;
    }

    const indirectDependents = Array.from(indirectSet).map((p) => ({
      ...findNodeInfo(p),
      isDirect: false,
    }));

    // 5. Identify Affected APIs and Routes
    const allAffectedPaths = [normTarget, ...Array.from(directSet), ...Array.from(indirectSet)];
    const affectedRoutes = [];
    const affectedTests = [];

    for (const p of allAffectedPaths) {
      const info = findNodeInfo(p);
      const isRoute =
        info.category === 'routes' ||
        info.category === 'controllers' ||
        p.includes('/routes/') ||
        p.includes('/api/') ||
        p.includes('controller');
      const isTest =
        info.category === 'test' ||
        p.includes('.test.') ||
        p.includes('.spec.') ||
        p.includes('__tests__') ||
        p.includes('/tests/');

      if (isRoute && !affectedRoutes.some((r) => r.path === info.path)) {
        affectedRoutes.push(info);
      }
      if (isTest && !affectedTests.some((t) => t.path === info.path)) {
        affectedTests.push(info);
      }
    }

    // 6. Calculate Blast Radius & Risk Level
    const totalAffectedCount = directDependents.length + indirectDependents.length;
    let riskScore = Math.min(100, Math.round(totalAffectedCount * 8 + affectedRoutes.length * 12));

    // Boost risk if it affects auth, database models, or security middleware
    const isSecuritySensitive =
      normTarget.includes('auth') ||
      normTarget.includes('user') ||
      normTarget.includes('db') ||
      normTarget.includes('security');
    if (isSecuritySensitive) {
      riskScore = Math.min(100, riskScore + 25);
    }

    let riskLevel = 'Low';
    if (riskScore >= 75) riskLevel = 'Critical';
    else if (riskScore >= 50) riskLevel = 'High';
    else if (riskScore >= 25) riskLevel = 'Medium';

    // 7. Symbol analysis notes
    let symbolNotice = '';
    if (targetSymbol) {
      symbolNotice = `Symbol-level dependency data is not available for this repository. Analyzing at file/module boundary for \`${targetPath}\`.`;
    }

    // 8. Retrieve RAG Context for Target & Generate AI Explanation
    const { formattedContext } = await retrievalService.retrieveContext({
      repositoryId,
      query: `${targetPath} ${targetSymbol || ''}`,
      filters: { filePath: targetPath },
      topK: 4,
    });

    let aiExplanation = '';
    try {
      const explanationPrompt = `Repository: ${repo.fullName}
Target Component: ${targetPath} ${targetSymbol ? `(Symbol: ${targetSymbol})` : ''}

Blast Radius Metrics:
- Directly Affected Files (${directDependents.length}): ${directDependents.map((d) => d.path).join(', ') || 'None'}
- Indirectly Affected Files (${indirectDependents.length}): ${indirectDependents.map((d) => d.path).join(', ') || 'None'}
- Affected API Endpoints / Controllers (${affectedRoutes.length}): ${affectedRoutes.map((r) => r.path).join(', ') || 'None'}
- Affected Test Suites (${affectedTests.length}): ${affectedTests.map((t) => t.path).join(', ') || 'None'}
- Calculated Risk: ${riskLevel} (${riskScore}/100)
${targetSymbol ? `- Note: ${symbolNotice}` : ''}

Target Code Snapshot:
${formattedContext || '(Code not directly retrieved from RAG)'}

Explain the architectural and operational impact of modifying this component:
1. Primary Responsibility: What this file does in the system.
2. Downstream Blast Radius: How changes propagate to dependent services, routes, and controllers.
3. Breaking Change Risks: What contract / signature changes could break other modules.
4. Recommended Testing Plan: Specific test files and manual test scenarios to execute before deployment.`;

      const { response } = await geminiService.callGeminiWithRetryAndFallback(
        () => ({
          systemInstruction: {
            role: 'system',
            parts: [
              {
                text: 'You are a principal software architect explaining code change impact and dependency blast radius for DevMind. Provide structured markdown with clear bullet points grounded strictly in the calculated dependencies.',
              },
            ],
          },
          contents: [{ role: 'user', parts: [{ text: explanationPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        })
      );

      const candidate = response.data?.candidates?.[0];
      aiExplanation = candidate?.content?.parts?.map((p) => p.text).join('') || '';
    } catch (aiErr) {
      aiExplanation = `Impact calculation complete: Modifying \`${targetPath}\` directly impacts ${directDependents.length} files and indirectly cascades to ${indirectDependents.length} downstream files across ${affectedRoutes.length} API handlers.`;
    }

    return {
      targetPath,
      targetSymbol: targetSymbol || null,
      symbolNotice: targetSymbol ? symbolNotice : null,
      directDependents,
      indirectDependents,
      affectedRoutes,
      affectedTests,
      riskScore,
      riskLevel,
      totalAffectedCount,
      aiExplanation,
      analyzedAt: new Date(),
    };
  }

  /**
   * Get list of all analyzable files and symbols in repository for impact selection.
   */
  async getAnalyzableFiles(repositoryId, userId) {
    const repo = await Repository.findOne({ _id: repositoryId, user: userId });
    if (!repo) {
      throw new ApiError(404, 'Repository not found');
    }

    let archGraph = await ArchitectureGraph.findOne({ repository: repositoryId });
    if (!archGraph || !archGraph.nodes?.length) {
      try {
        archGraph = await architectureService.getOrGenerateGraph(repositoryId, userId);
      } catch (err) {
        archGraph = { nodes: [], links: [] };
      }
    }

    const nodes = archGraph?.nodes || [];
    const links = archGraph?.links || archGraph?.edges || [];

    // Count in-degrees (callers/importers) from links
    const inDegreeMap = new Map();
    const outDegreeMap = new Map();

    for (const link of links) {
      const src = (link.source?.id || link.source || '').replace(/\\/g, '/');
      const tgt = (link.target?.id || link.target || '').replace(/\\/g, '/');
      if (!src || !tgt) continue;

      inDegreeMap.set(tgt, (inDegreeMap.get(tgt) || 0) + 1);
      outDegreeMap.set(src, (outDegreeMap.get(src) || 0) + 1);
    }

    // Filter out external libraries and return only repository source files
    const files = nodes
      .filter(
        (n) =>
          n.category !== 'dependencies' &&
          !n.id?.startsWith('dep:') &&
          !n.path?.startsWith('node_modules/')
      )
      .map((n) => {
        const filePath = n.path || n.id;
        const normPath = filePath.replace(/\\/g, '/');
        const inDeg = inDegreeMap.get(normPath) || inDegreeMap.get(n.id) || n.importedByCount || 0;
        const outDeg = outDegreeMap.get(normPath) || outDegreeMap.get(n.id) || n.importsCount || 0;

        return {
          path: filePath,
          label: n.name || filePath,
          category: n.category || 'misc',
          degree: inDeg + outDeg || n.val || 1,
          inDegree: inDeg,
          outDegree: outDeg,
        };
      });

    return files.sort((a, b) => b.inDegree - a.inDegree);
  }
}

module.exports = new ImpactService();
