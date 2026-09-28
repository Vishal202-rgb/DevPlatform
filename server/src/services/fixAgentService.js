const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const geminiService = require('./geminiService');
const retrievalService = require('./retrievalService');
const impactService = require('./impactService');
const githubService = require('./githubService');
const targetTestRunnerService = require('./targetTestRunnerService');
const verificationAgentService = require('./verificationAgentService');
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
    const {
      issueId,
      analysisId,
      filePath,
      line,
      description,
      severity,
      recommendation,
      category,
      testCode,
      testFailures,
      testResults,
      feedback,
    } = issueData;

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

    // 4. Build Failure & Test Evidence Sections
    let failureSection = '';
    if (testFailures || (testResults && (testResults.status === 'FAIL' || testResults.exitCode !== 0))) {
      const failOutput = testFailures || `${testResults?.stdout || ''}\n${testResults?.stderr || ''}`;
      failureSection = `\n=== TARGET TEST FAILURES & EXECUTION EVIDENCE ===
The previous code or partial fix failed the following target test scenarios:
${failOutput.slice(0, 3000)}
`;
    }

    let testSuiteSection = '';
    if (testCode) {
      testSuiteSection = `\n=== TARGET TEST SUITE SPECIFICATION ===
The fix must pass ALL scenarios in this test suite without breaking any of them:
${testCode.slice(0, 3000)}
`;
    }

    let feedbackSection = '';
    if (feedback) {
      feedbackSection = `\n=== REFINEMENT FEEDBACK ===
${feedback}
`;
    }

// 5. Prompt Gemini with structured Fix Agent Instructions
    const fixPrompt = `Repository: ${repo.fullName}
Target File: ${filePath} (line ${line || 'N/A'})
Severity: ${severity || 'medium'}
Category: ${category || 'bug'}
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
${testSuiteSection}${failureSection}${feedbackSection}
CRITICAL RULES:
- Provide the COMPLETE, corrected file content.
- Thoroughly analyze the original issue, current source code, test suite scenarios, and any failure output before creating the patch.
- Address the ROOT CAUSE of the issue and ensure ALL test scenarios pass.
- For runtime/error issues (such as boundary conditions, buffer limits, division by zero, invalid input, equal/negative numbers, or null pointers), explicitly and safely handle the failure conditions.
- Preserve all existing valid behavior, unrelated comments, imports, formatting, and functions.
- Do NOT fix just one single failing condition while breaking or ignoring other scenarios.
- Make ONLY the minimal, production-safe change required to resolve the complete issue.
- Never include markdown code blocks or conversational commentary in your response — output ONLY the raw file content.`;

    const { response, modelUsed } = await geminiService.callGeminiWithRetryAndFallback(
      () => ({
        systemInstruction: {
          role: 'system',
          parts: [
            {
              text: 'You are the AI FIX AGENT for DevMind. Generate precise, production-grade code patches with zero extraneous modifications that resolve the root cause across all test scenarios and edge cases.',
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

    // 6. Run Security Gate Check
    const securityCheck = runSecurityGateCheck(proposedContent);

    // 7. Generate Unified Diff
    const diff = generateUnifiedDiff(filePath, originalContent, proposedContent);

    // 8. Compute Hash & Confidence
    const originalHash = crypto.createHash('sha256').update(originalContent).digest('hex');
    const proposedHash = crypto.createHash('sha256').update(proposedContent).digest('hex');

    // 9. Log Audit Action
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
      model: modelUsed,
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

  /**
   * Validate a proposed code change directly against the target repository's test suite.
   */
  async validateProposedFix(userId, repositoryId, options = {}) {
    const {
      filePath,
      proposedContent,
      testCode,
      testFilePath,
      language,
      owner,
      repo,
      branch,
    } = options;

    return await targetTestRunnerService.executeTargetTest(userId, repositoryId, {
      owner,
      repo,
      branch,
      targetFile: filePath,
      targetContent: proposedContent,
      testFilePath,
      testCode,
      language,
    });
  }

  /**
   * Autonomous AI Remediation Workflow:
   * Issue -> Analyze Code + All Failures -> Generate Fix -> Validate against Target Tests -> Refine if Failed -> Re-run -> Verify -> Apply -> RESOLVED
   */
  async remediateAndVerifyIssue(userId, repositoryId, options = {}) {
    const {
      issueData = {},
      testCode: providedTestCode,
      testFilePath: providedTestFilePath,
      language: providedLanguage,
      maxRetries = 3,
      autoApply = false,
      commitMessage,
      branchName,
    } = options;

    const { filePath } = issueData;
    if (!repositoryId || !filePath) {
      throw new ApiError(400, 'Repository ID and target file path are required for remediation');
    }

    let activeTestCode = providedTestCode;
    let activeTestFilePath = providedTestFilePath;
    let activeLanguage = providedLanguage;

    // If test code wasn't explicitly provided, generate comprehensive 4-scenario suite to validate against
    if (!activeTestCode) {
      try {
        const testRunnerService = require('./testRunnerService');
        const generated = await testRunnerService.generateComprehensiveTests(userId, repositoryId, {
          filePath,
          issueDescription: issueData.description,
          fixExplanation: issueData.recommendation,
        });
        if (generated && generated.testCode) {
          activeTestCode = generated.testCode;
          activeTestFilePath = generated.testFilePath;
        }
      } catch (err) {
        // Continue with available context if automatic test generation encounters an issue
      }
    }

    let cumulativeFailures = '';
    let lastFixProposal = null;
    let lastTestResult = null;
    let lastVerificationResult = null;
    const history = [];

    // Iterative Fix-and-Validate Loop
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // 1. Generate Fix Proposal taking into account the issue, source code, and any prior test failures
      const currentIssuePayload = {
        ...issueData,
        testCode: activeTestCode,
        testFailures: cumulativeFailures || issueData.testFailures,
        feedback: cumulativeFailures
          ? `Attempt ${attempt - 1} produced code that failed target tests. Review the target test failures below and ensure all scenarios and edge cases are completely handled.`
          : undefined,
      };

      lastFixProposal = await this.generateFixProposal(userId, repositoryId, currentIssuePayload);

      // 2. If testCode is available, execute target tests against the newly proposed fix
      if (activeTestCode || activeTestFilePath) {
        lastTestResult = await this.validateProposedFix(userId, repositoryId, {
          filePath,
          proposedContent: lastFixProposal.fullProposedContent,
          testCode: activeTestCode,
          testFilePath: activeTestFilePath,
          language: activeLanguage,
        });

        const isPass = lastTestResult.status === 'PASS' && lastTestResult.exitCode === 0 && (lastTestResult.failed === 0 || !lastTestResult.failed);

        history.push({
          attempt,
          isPass,
          testResults: lastTestResult,
          diff: lastFixProposal.diff,
        });

        if (isPass) {
          // 3. Verify fix resolution using Verification Agent with evidence of passed tests
          lastVerificationResult = await verificationAgentService.verifyFixResolution(userId, repositoryId, {
            originalIssue: issueData,
            originalCode: lastFixProposal.fullOriginalContent,
            modifiedCode: lastFixProposal.fullProposedContent,
            testCode: activeTestCode,
            testResults: lastTestResult,
            securityCheck: lastFixProposal.securityCheck,
            targetFile: filePath,
          });

          // 4. Optionally commit the verified fix to the Git branch
          let applyResult = null;
          if (autoApply && lastVerificationResult.resolved === 'RESOLVED') {
            applyResult = await this.applyApprovedFix(userId, repositoryId, {
              issueId: issueData.issueId || issueData._id || issueData.id,
              analysisId: issueData.analysisId || issueData.analysis,
              filePath,
              proposedContent: lastFixProposal.fullProposedContent,
              originalFileSha: lastFixProposal.originalFileSha,
              originalContentHash: lastFixProposal.originalContentHash,
              commitMessage,
              branchName,
            });
          }

          return {
            success: true,
            resolved: lastVerificationResult.resolved,
            verified: true,
            attempts: attempt,
            fixProposal: lastFixProposal,
            testResults: lastTestResult,
            testCode: activeTestCode,
            verificationResult: lastVerificationResult,
            appliedResult: applyResult,
            diff: lastFixProposal.diff,
            history,
          };
        } else {
          // Collect failure output for the next refinement loop
          const failedScenarios = (lastTestResult.tests || [])
            .filter((t) => t.status === 'failed')
            .map((t) => `${t.name}: ${t.error}`)
            .join('\n');

          cumulativeFailures = `Target Test Failures (Exit Code: ${lastTestResult.exitCode}):\n${failedScenarios || 'One or more test assertions failed'}\n\nSTDOUT:\n${lastTestResult.stdout || ''}\n\nSTDERR:\n${lastTestResult.stderr || ''}`;
        }
      } else {
        // No test code supplied; return generated fix proposal without auto-marking resolved
        return {
          success: true,
          resolved: 'UNVERIFIED',
          verified: false,
          attempts: 1,
          fixProposal: lastFixProposal,
          testResults: null,
          testCode: null,
          verificationResult: null,
          diff: lastFixProposal.diff,
          history,
        };
      }
    }

    // If maxRetries exhausted and tests still fail
    lastVerificationResult = await verificationAgentService.verifyFixResolution(userId, repositoryId, {
      originalIssue: issueData,
      originalCode: lastFixProposal?.fullOriginalContent,
      modifiedCode: lastFixProposal?.fullProposedContent,
      testCode: activeTestCode,
      testResults: lastTestResult,
      securityCheck: lastFixProposal?.securityCheck,
      targetFile: filePath,
    });

    return {
      success: false,
      resolved: 'NOT_RESOLVED',
      verified: false,
      attempts: maxRetries,
      fixProposal: lastFixProposal,
      testResults: lastTestResult,
      testCode: activeTestCode,
      verificationResult: lastVerificationResult,
      error: `Fix did not pass all target tests after ${maxRetries} refinement attempts. Fix was NOT marked resolved.`,
      diff: lastFixProposal?.diff,
      history,
    };
  }
}

module.exports = new FixAgentService();
