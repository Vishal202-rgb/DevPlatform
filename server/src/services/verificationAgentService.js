const geminiService = require('./geminiService');
const AuditLog = require('../models/AuditLog');

const VERIFICATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    resolved: {
      type: 'STRING',
      enum: ['RESOLVED', 'PARTIALLY_RESOLVED', 'NOT_RESOLVED', 'VERIFICATION_FAILED', 'VERIFICATION_UNAVAILABLE'],
    },
    confidence: { type: 'NUMBER' },
    reasoning: { type: 'STRING' },
    remainingRisks: { type: 'STRING' },
    recommendation: { type: 'STRING' },
  },
  required: ['resolved', 'confidence', 'reasoning', 'remainingRisks', 'recommendation'],
};

class VerificationAgentService {
  /**
   * Run the Verification Agent to critically assess whether a code modification actually resolves an issue.
   * Uses ONLY target repository test execution evidence.
   */
  async verifyFixResolution(userId, repositoryId, verificationPayload) {
    const {
      originalIssue,
      originalCode,
      modifiedCode,
      testCode,
      testResults,
      impactContext,
      securityCheck,
      repository,
      targetFile,
    } = verificationPayload;

    const repoName = repository || originalIssue?.repository?.fullName || originalIssue?.repository?.name || 'Target Repository';
    const fileName = targetFile || originalIssue?.file || 'Target File';

    const testSummary = testResults
      ? `Target Repository: ${repoName}
Target File: ${fileName}
Runner: ${testResults.runner || 'Target Test Runner'}
Command: ${testResults.command || 'N/A'}
Exit Code: ${testResults.exitCode !== undefined ? testResults.exitCode : 'N/A'}
Status: ${testResults.status || 'NOT_RUN'}
Passed: ${testResults.passed || 0}, Failed: ${testResults.failed || 0}, Total: ${testResults.total || (testResults.passed || 0) + (testResults.failed || 0)}
Output:
${(testResults.stdout || testResults.stderr || '').slice(0, 3000)}`
      : 'No target test execution results available.';

    const verificationPrompt = `You are the VERIFICATION AGENT for DevMind.
Critically evaluate the proposed fix, the generated tests, and target test execution results.

TARGET REPOSITORY CONTEXT:
Repository: ${repoName}
Target File: ${fileName}

ORIGINAL ISSUE:
Title: ${originalIssue?.title || originalIssue?.description || 'Issue'}
Severity: ${originalIssue?.severity || 'medium'}
Description: ${originalIssue?.description || ''}

ORIGINAL CODE:
${(originalCode || '').slice(0, 4000)}

MODIFIED CODE:
${(modifiedCode || '').slice(0, 4000)}

GENERATED TESTS:
${(testCode || '').slice(0, 2500)}

TARGET TEST EXECUTION EVIDENCE:
${testSummary}

SECURITY GATE STATUS:
${securityCheck ? `Safe: ${securityCheck.safe}, Warnings: ${JSON.stringify(securityCheck.warnings || [])}` : 'Security check not provided'}

CRITICAL VERIFICATION RULES:
- Base your assessment ONLY on the target repository test evidence provided above.
- Never accept internal platform tests (e.g. server/test/*.test.js) as evidence for external repositories.
- If target tests failed, exitCode is non-zero, or compilation failed, mark "NOT_RESOLVED" or "VERIFICATION_FAILED".
- If target tests were not run or test results are missing, choose "VERIFICATION_UNAVAILABLE" or "NOT_RESOLVED".
- Do NOT declare "RESOLVED" simply because an HTTP endpoint succeeded. Inspect the code changes and test execution output.
- Return structured JSON conforming to the schema.`;

    const isTestPass = testResults?.status === 'PASS' && testResults?.exitCode === 0;
    let verificationResult = {
      resolved: isTestPass ? 'RESOLVED' : (testResults ? 'NOT_RESOLVED' : 'VERIFICATION_UNAVAILABLE'),
      confidence: isTestPass ? 0.9 : 0.7,
      reasoning: isTestPass
        ? `Verified target test suite execution passed for ${fileName}.`
        : `Target tests failed or have not been executed successfully for ${fileName}.`,
      remainingRisks: 'Verify behavior across edge cases in staging environment.',
      recommendation: isTestPass ? 'Proceed with pull request creation.' : 'Resolve test failures before proceeding.',
    };

    try {
      const { response } = await geminiService.callGeminiWithRetryAndFallback(
        () => ({
          systemInstruction: {
            role: 'system',
            parts: [
              {
                text: 'You are a rigorous code verification agent in DevMind. Return structured JSON strictly conforming to the schema.',
              },
            ],
          },
          contents: [{ role: 'user', parts: [{ text: verificationPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            responseSchema: VERIFICATION_SCHEMA,
          },
        })
      );

      const candidate = response.data?.candidates?.[0];
      const rawText = candidate?.content?.parts?.map((p) => p.text).join('') || '';
      if (rawText.trim()) {
        verificationResult = JSON.parse(rawText);
      }
    } catch (err) {
      // Graceful fallback to target test results
      if (!isTestPass) {
        verificationResult.resolved = 'NOT_RESOLVED';
        verificationResult.reasoning = 'Automated target test suite execution failed.';
      }
    }

    // Safety guard: Never allow RESOLVED if target tests failed
    if (!isTestPass && verificationResult.resolved === 'RESOLVED') {
      verificationResult.resolved = 'NOT_RESOLVED';
      verificationResult.reasoning = `Target test suite failed with exit code ${testResults?.exitCode || 1}. Fix cannot be marked as resolved.`;
    }

    if (repositoryId && userId) {
      try {
        await AuditLog.create({
          repository: repositoryId,
          user: userId,
          action: 'verification_completed',
          status: verificationResult.resolved === 'RESOLVED' ? 'success' : 'warning',
          targetFile: fileName,
          details: verificationResult,
          message: `Fix verification status: ${verificationResult.resolved} (Confidence: ${Math.round((verificationResult.confidence || 0.85) * 100)}%)`,
        });
      } catch (e) {}
    }

    return verificationResult;
  }

  /**
   * Diagnose failing test execution and recommend concrete adjustments.
   */
  async diagnoseTestFailure(payload) {
    const { originalIssue, modifiedCode, testOutput } = payload;

    const diagnosisPrompt = `You are the DIAGNOSIS AGENT in DevMind.
A code fix failed during target test execution. Analyze the failure and provide root cause diagnosis.

Issue: ${originalIssue?.description || 'Code issue'}
Modified Code:
${(modifiedCode || '').slice(0, 3000)}

Test Output & Stack Trace:
${(testOutput || '').slice(0, 3000)}

Provide:
1. Root Cause Analysis: Exactly why the test failed.
2. Code Adjustment Recommendation: Concrete changes to fix the error.`;

    try {
      const { response } = await geminiService.callGeminiWithRetryAndFallback(
        () => ({
          systemInstruction: {
            role: 'system',
            parts: [{ text: 'You are an expert runtime debugging and diagnosis agent.' }],
          },
          contents: [{ role: 'user', parts: [{ text: diagnosisPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        })
      );

      const candidate = response.data?.candidates?.[0];
      return {
        diagnosis: candidate?.content?.parts?.map((p) => p.text).join('') || 'Test execution encountered an error.',
      };
    } catch (err) {
      return { diagnosis: `Diagnosis unavailable: ${err.message}` };
    }
  }

  /**
   * Compute comprehensive PR Readiness Scorecard.
   */
  calculatePrReadiness({ hasCodeChanges, testsStatus, securitySafe, hasImpactAnalysis, verificationResolved }) {
    const checklist = [
      { name: 'Code Modifications', ready: Boolean(hasCodeChanges), detail: 'Targeted changes reviewed in diff' },
      { name: 'Unit & Regression Tests', ready: testsStatus === 'PASS', detail: testsStatus === 'PASS' ? 'Target test suite passed' : 'Target tests pending or unexecuted' },
      { name: 'Security Gate Clearance', ready: Boolean(securitySafe), detail: securitySafe ? 'Zero high-risk constructs or exposed secrets' : 'Security review flagged warnings' },
      { name: 'Impact Blast Radius', ready: Boolean(hasImpactAnalysis), detail: hasImpactAnalysis ? 'Downstream dependencies calculated' : 'Impact analysis not computed' },
      { name: 'AI Verification Status', ready: verificationResolved === 'RESOLVED', detail: verificationResolved === 'RESOLVED' ? 'Verified resolved' : 'Verification pending' },
    ];

    const readyCount = checklist.filter((item) => item.ready).length;
    const score = Math.round((readyCount / checklist.length) * 100);

    return {
      score,
      isReady: score >= 80,
      checklist,
    };
  }
}

module.exports = new VerificationAgentService();
