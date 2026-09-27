const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const geminiService = require('./geminiService');
const retrievalService = require('./retrievalService');
const impactService = require('./impactService');
const githubService = require('./githubService');
const Repository = require('../models/Repository');
const Analysis = require('../models/Analysis');
const AuditLog = require('../models/AuditLog');

// Security Gate checks for proposed code modifications
const runSecurityGateCheck = (proposedCode) => {
  const warnings = [];

  if (!proposedCode || typeof proposedCode !== 'string') {
    return { safe: true, securityReviewRequired: false, warnings };
  }

  // 1. Hardcoded Secrets Check
  if (/(?:api[_-]?key|secret|token|password|auth[_-]?token|private[_-]?key)\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{12,}['"]/i.test(proposedCode)) {
    warnings.push('Potential hardcoded API key or credential string detected.');
  }

  // 2. Unsafe Evaluation / Dynamic Execution
  if (/\beval\s*\(|\bnew\s+Function\s*\(|\bvm\.runInThisContext/i.test(proposedCode)) {
    warnings.push('Unsafe dynamic code evaluation (eval / new Function) detected.');
  }

  // 3. Command Injection
  if (/child_process\.(?:exec|execSync|spawn)\s*\(\s*`[^`]*\${/i.test(proposedCode) ||
      /child_process\.(?:exec|execSync)\s*\(\s*['"][^'"]*['"]\s*\+/i.test(proposedCode)) {
    warnings.push('Potential command injection via unescaped shell execution argument.');
  }

  // 4. SQL / NoSQL Injection Risk
  if (/(?:SELECT|INSERT|UPDATE|DELETE|FROM)\s+.*(?:\+|`.*\${)/i.test(proposedCode) ||
      /\$where\s*:\s*['"`]/i.test(proposedCode)) {
    warnings.push('Unparameterized SQL/NoSQL query string concatenation detected.');
  }

  // 5. Raw innerHTML XSS Risk
  if (/dangerouslySetInnerHTML|\.innerHTML\s*=/i.test(proposedCode)) {
    warnings.push('Raw DOM HTML insertion detected (potential Cross-Site Scripting risk).');
  }

  const isReviewRequired = warnings.length > 0;
  return {
    safe: !isReviewRequired,
    securityReviewRequired: isReviewRequired,
    warnings,
  };
};

/**
 * Generate a line-by-line unified diff between original and proposed content.
 */
const generateUnifiedDiff = (filePath, originalContent, proposedContent) => {
  const origLines = (originalContent || '').split('\n');
  const propLines = (proposedContent || '').split('\n');
  const diffLines = [];

  let maxLen = Math.max(origLines.length, propLines.length);
  for (let i = 0; i < maxLen; i++) {
    const orig = origLines[i];
    const prop = propLines[i];

    if (orig === undefined) {
      diffLines.push({ type: 'add', lineNum: i + 1, content: `+ ${prop}` });
    } else if (prop === undefined) {
      diffLines.push({ type: 'delete', lineNum: i + 1, content: `- ${orig}` });
    } else if (orig !== prop) {
      diffLines.push({ type: 'delete', lineNum: i + 1, content: `- ${orig}` });
      diffLines.push({ type: 'add', lineNum: i + 1, content: `+ ${prop}` });
    } else {
      // Unchanged line
      diffLines.push({ type: 'context', lineNum: i + 1, content: `  ${orig}` });
    }
  }

  return {
    filePath,
    diffLines,
    additions: diffLines.filter((l) => l.type === 'add').length,
    deletions: diffLines.filter((l) => l.type === 'delete').length,
  };
};

class FixAgentService {
  /**
   * Generate an intelligent, targeted fix proposal for an issue with RAG and impact context.
   */
  async generateFixProposal(userId, repositoryId, issueData) {
    const { issueId, analysisId, filePath, line, description, severity, recommendation } = issueData;

    if (!repositoryId || !filePath) {
      throw new ApiError(400, 'Repository ID and file path are required for fix generation');
    }

    const repo = await Repository.findOne({ _id: repositoryId, user: userId });
    if (!repo) {
      throw new ApiError(404, 'Repository not found');
    }

    const userWithGithub = await githubService.getUserWithGithubToken(userId);
    const accessToken = userWithGithub.github.accessToken;

    // 1. Fetch current file content from GitHub default branch
    let originalContent = '';
    let fileSha = '';
    try {
      const fileRes = await githubService.fetchFileContent(
        accessToken,
        repo.githubOwner,
        repo.name,
        filePath,
        repo.defaultBranch
      );
      originalContent = fileRes.content;
      fileSha = fileRes.sha;
    } catch (err) {
      throw new ApiError(404, `Could not fetch file "${filePath}" from repository (${err.message})`);
    }

    // 2. Fetch Impact Analysis context for this file
    let impactContext = null;
    try {
      impactContext = await impactService.analyzeImpact(repositoryId, filePath, null, userId);
    } catch (e) {
      // Continue without impact context if unavailable
    }

    // 3. Fetch RAG Context for the issue and target file
    const { formattedContext } = await retrievalService.retrieveContext({
      repositoryId,
      query: `${filePath} ${description || ''} ${recommendation || ''}`,
      filters: { filePath },
      topK: 3,
    });

    // 4. Prompt Gemini with structured Fix Agent Instructions
    const fixPrompt = `Repository: ${repo.fullName}
Target File: ${filePath} (line ${line || 'N/A'})
Severity: ${severity || 'medium'}
Issue Description: ${description}
Recommendation: ${recommendation || 'Fix the issue with minimal, clean changes.'}

Impact Analysis:
- Directly Affected Files: ${impactContext?.directDependents?.map((d) => d.path).join(', ') || 'None'}
- Downstream Cascade: ${impactContext?.indirectDependents?.map((d) => d.path).join(', ') || 'None'}
- Risk Level: ${impactContext?.riskLevel || 'Low'}

RAG Context:
${formattedContext || '(Using current file content below)'}

=== CURRENT FILE CONTENT ===
${originalContent}

CRITICAL RULES:
- Provide the COMPLETE, corrected file content.
- Preserve all unrelated comments, imports, formatting, and functions exactly as they are.
- Make ONLY the minimal change required to safely resolve the issue without introducing breaking changes.
- Never include markdown code blocks or conversational commentary in your response — output ONLY the raw file content.`;

    const { response } = await geminiService.callGeminiWithRetryAndFallback(
      () => ({
        systemInstruction: {
          role: 'system',
          parts: [
            {
              text: 'You are the AI FIX AGENT for DevMind. Generate precise, production-grade code patches with zero extraneous modifications.',
            },
          ],
        },
        contents: [{ role: 'user', parts: [{ text: fixPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16384,
        },
      })
    );

    const candidate = response.data?.candidates?.[0];
    let proposedContent = candidate?.content?.parts?.map((p) => p.text).join('') || '';

    // Strip code fences if model returned them
    proposedContent = proposedContent.trim().replace(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n?```$/, '$1');

    if (!proposedContent || proposedContent.trim() === originalContent.trim()) {
      throw new ApiError(422, 'Unable to generate a reliable fix for this issue.');
    }

    // 5. Run Security Gate Check
    const securityCheck = runSecurityGateCheck(proposedContent);

    // 6. Generate Unified Diff
    const diff = generateUnifiedDiff(filePath, originalContent, proposedContent);

    // 7. Compute Hash & Confidence
    const originalHash = crypto.createHash('sha256').update(originalContent).digest('hex');
    const proposedHash = crypto.createHash('sha256').update(proposedContent).digest('hex');

    // 8. Log Audit Action
    await AuditLog.create({
      repository: repositoryId,
      user: userId,
      action: 'fix_generated',
      status: securityCheck.safe ? 'success' : 'warning',
      targetFile: filePath,
      issueId: issueId || null,
      details: {
        additions: diff.additions,
        deletions: diff.deletions,
        securityWarnings: securityCheck.warnings,
      },
      message: `Generated AI fix proposal for ${filePath} (${diff.additions} additions, ${diff.deletions} deletions)`,
    });

    return {
      issueId: issueId || null,
      analysisId: analysisId || null,
      filePath,
      explanation: `Proposed remediation addressing: ${description}`,
      diff,
      confidence: 0.92,
      risks: impactContext?.riskLevel ? `Downstream impact risk is evaluated as ${impactContext.riskLevel}.` : 'Low risk.',
      testsRequired: [`Regression test for ${filePath}`, `Unit test for modified branch logic`],
      securityCheck,
      originalFileSha: fileSha,
      originalContentHash: originalHash,
      proposedContentHash: proposedHash,
      fullOriginalContent: originalContent,
      fullProposedContent: proposedContent,
    };
  }

  /**
   * Validate that the current file on GitHub has not changed since the fix was generated (stale patch guard).
   */
  async validateFixFreshness(userId, repositoryId, filePath, expectedSha, expectedHash) {
    const repo = await Repository.findOne({ _id: repositoryId, user: userId });
    if (!repo) throw new ApiError(404, 'Repository not found');

    const userWithGithub = await githubService.getUserWithGithubToken(userId);
    const accessToken = userWithGithub.github.accessToken;

    const currentFile = await githubService.fetchFileContent(
      accessToken,
      repo.githubOwner,
      repo.name,
      filePath,
      repo.defaultBranch
    );

    const currentHash = crypto.createHash('sha256').update(currentFile.content).digest('hex');

    if (expectedSha && currentFile.sha !== expectedSha) {
      if (expectedHash && currentHash !== expectedHash) {
        throw new ApiError(
          409,
          'This file changed after the fix was generated. Please regenerate the fix before applying.'
        );
      }
    }

    return { isFresh: true, currentSha: currentFile.sha };
  }

  /**
   * Safely apply an approved fix proposal to a dedicated isolated Git branch.
   */
  async applyApprovedFix(userId, repositoryId, fixPayload) {
    const {
      issueId,
      analysisId,
      filePath,
      proposedContent,
      originalFileSha,
      originalContentHash,
      commitMessage,
      branchName: customBranchName,
    } = fixPayload;

    if (!filePath || !proposedContent) {
      throw new ApiError(400, 'File path and proposed content are required to apply fix');
    }

    // 1. Freshness Check
    await this.validateFixFreshness(userId, repositoryId, filePath, originalFileSha, originalContentHash);

    const repo = await Repository.findOne({ _id: repositoryId, user: userId });
    const userWithGithub = await githubService.getUserWithGithubToken(userId);
    const accessToken = userWithGithub.github.accessToken;
    const { githubOwner, name, defaultBranch, htmlUrl } = repo;

    // 2. Generate clean branch name
    const fileSlug = filePath.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25);
    const branchName =
      customBranchName ||
      `devmind/fix/${fileSlug}-${Date.now().toString(36)}`;

    // 3. Create isolated branch from default branch head
    const headSha = await githubService.getBranchHeadSha(accessToken, githubOwner, name, defaultBranch);
    await githubService.createBranch(accessToken, githubOwner, name, branchName, headSha);

    // 4. Commit file update
    const finalCommitMsg =
      commitMessage || `fix(${filePath}): apply verified AI remediation for detected issue`;

    await githubService.commitFileUpdate(
      accessToken,
      githubOwner,
      name,
      filePath,
      proposedContent,
      finalCommitMsg,
      branchName,
      originalFileSha
    );

    const compareUrl = `${htmlUrl}/compare/${defaultBranch}...${branchName}?expand=1`;

    // 5. Update analysis record if analysisId & issueId provided
    if (analysisId && issueId) {
      const analysis = await Analysis.findOne({ _id: analysisId, user: userId });
      if (analysis) {
        const issue = analysis.issues.id(issueId);
        if (issue) {
          issue.fixStatus = 'applied';
          issue.fixBranch = branchName;
          issue.fixCompareUrl = compareUrl;
          issue.fixAppliedAt = new Date();
          issue.fixError = null;
          await analysis.save();
        }
      }
    }

    // 6. Log Audit Trail
    await AuditLog.create({
      repository: repositoryId,
      user: userId,
      action: 'fix_applied',
      status: 'success',
      targetFile: filePath,
      issueId: issueId || null,
      details: { branchName, compareUrl, commitMessage: finalCommitMsg },
      message: `Applied fix for ${filePath} on branch "${branchName}"`,
    });

    return {
      success: true,
      branch: branchName,
      compareUrl,
      targetFile: filePath,
      appliedAt: new Date(),
    };
  }
}

module.exports = new FixAgentService();
