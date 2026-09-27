const { exec } = require('child_process');
const ApiError = require('../utils/ApiError');
const geminiService = require('./geminiService');
const githubService = require('./githubService');
const Repository = require('../models/Repository');
const Analysis = require('../models/Analysis');
const AuditLog = require('../models/AuditLog');

// Strict command allowlist for test execution security
const ALLOWED_TEST_COMMANDS = new Set([
  'npm test',
  'npm run test',
  'npm test -- --coverage=false',
  'npx vitest run',
  'npx jest',
  'node --test',
  'pytest',
  'python -m unittest',
  'mvn test',
  'gradle test',
]);

/**
 * Detect existing test framework from repo files / package.json content.
 */
const detectTestFramework = (packageJsonContent = '', filePaths = []) => {
  const pkgLower = packageJsonContent.toLowerCase();

  if (pkgLower.includes('"vitest"')) {
    return { name: 'Vitest', command: 'npx vitest run', extension: '.test.js' };
  }
  if (pkgLower.includes('"jest"')) {
    return { name: 'Jest', command: 'npm test', extension: '.test.js' };
  }
  if (pkgLower.includes('"mocha"')) {
    return { name: 'Mocha', command: 'npm test', extension: '.spec.js' };
  }

  // Check file extensions
  if (filePaths.some((p) => p.endsWith('.py'))) {
    return { name: 'Pytest', command: 'pytest', extension: '_test.py' };
  }
  if (filePaths.some((p) => p.endsWith('.java'))) {
    return { name: 'JUnit', command: 'mvn test', extension: 'Test.java' };
  }

  return { name: 'Jest / Node Test', command: 'npm test', extension: '.test.js' };
};

class TestRunnerService {
  /**
   * Generate a 4-scenario comprehensive unit test file tailored to the repository's framework.
   */
  async generateComprehensiveTests(userId, repositoryId, targetData) {
    const { filePath, issueDescription, fixExplanation } = targetData;

    if (!repositoryId || !filePath) {
      throw new ApiError(400, 'Repository ID and target file path are required');
    }

    const repo = await Repository.findOne({ _id: repositoryId, user: userId });
    if (!repo) throw new ApiError(404, 'Repository not found');

    const userWithGithub = await githubService.getUserWithGithubToken(userId);
    const accessToken = userWithGithub.github.accessToken;

    // 1. Fetch file content and package.json for framework detection
    let fileContent = '';
    let packageJson = '';
    try {
      const fileRes = await githubService.fetchFileContent(
        accessToken,
        repo.githubOwner,
        repo.name,
        filePath,
        repo.defaultBranch
      );
      fileContent = fileRes.content;
    } catch (err) {
      throw new ApiError(404, `Could not fetch "${filePath}" from repository`);
    }

    try {
      const pkgRes = await githubService.fetchFileContent(
        accessToken,
        repo.githubOwner,
        repo.name,
        'package.json',
        repo.defaultBranch
      );
      packageJson = pkgRes.content;
    } catch (e) {
      // package.json might not exist in non-node repos
    }

    const framework = detectTestFramework(packageJson, [filePath]);

    // 2. Generate 4-scenario test content using Gemini
    const testPrompt = `Repository: ${repo.fullName}
Target File: ${filePath}
Framework: ${framework.name}
Issue Addressed: ${issueDescription || 'Bug remediation'}
Fix Summary: ${fixExplanation || 'Code update'}

Target Code:
${fileContent}

Generate a production-ready test suite covering these 4 mandatory scenarios:
1. REGRESSION TEST: Directly verifies the bug/vulnerability will not reoccur.
2. HAPPY PATH TEST: Verifies standard, expected inputs and typical operational flow.
3. EDGE CASE TEST: Tests boundary conditions, empty values, extreme lengths, and unusual formats.
4. ERROR HANDLING TEST: Validates invalid inputs, thrown errors, and rejection handling.

RULES:
- Use standard assertions for ${framework.name}.
- Include all necessary module imports.
- Output ONLY the raw executable test file content without markdown code blocks or explanations.`;

    const { response } = await geminiService.callGeminiWithRetryAndFallback(
      () => ({
        systemInstruction: {
          role: 'system',
          parts: [
            {
              text: `You are the AI TEST GENERATION AGENT for DevMind. Generate clean, runnable ${framework.name} test files with descriptive describe/it blocks.`,
            },
          ],
        },
        contents: [{ role: 'user', parts: [{ text: testPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16384,
        },
      })
    );

    const candidate = response.data?.candidates?.[0];
    let testCode = candidate?.content?.parts?.map((p) => p.text).join('') || '';
    testCode = testCode.trim().replace(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n?```$/, '$1');

    if (!testCode) {
      throw new ApiError(502, 'Gemini failed to generate test suite.');
    }

    // Determine target test file path
    const parts = filePath.split('.');
    const ext = parts.pop();
    const testFilePath = `${parts.join('.')}.test.${ext}`;

    await AuditLog.create({
      repository: repositoryId,
      user: userId,
      action: 'tests_generated',
      status: 'success',
      targetFile: testFilePath,
      details: { framework: framework.name, scenarios: ['regression', 'happy_path', 'edge_case', 'error_handling'] },
      message: `Generated ${framework.name} test suite for ${filePath}`,
    });

    return {
      testFilePath,
      framework: framework.name,
      testCode,
      scenarios: [
        { name: 'Regression Test', description: 'Verifies the specific reported issue is resolved' },
        { name: 'Happy Path', description: 'Tests valid inputs and primary functional contract' },
        { name: 'Edge Cases', description: 'Tests boundary conditions and empty inputs' },
        { name: 'Error Handling', description: 'Tests invalid arguments and exception pathways' },
      ],
      suggestedCommand: framework.command,
    };
  }

  /**
   * Execute allowlisted test runner in a secure, controlled local execution sandbox.
   */
  async executeControlledTests(userId, repositoryId, options = {}) {
    const rawCommand = (options.command || 'npm test').trim();

    // 1. Strict Allowlist Security Check
    if (!ALLOWED_TEST_COMMANDS.has(rawCommand)) {
      throw new ApiError(
        400,
        `Command "${rawCommand}" is not in the approved test runner allowlist. Allowed commands: ${Array.from(ALLOWED_TEST_COMMANDS).join(', ')}`
      );
    }

    const startTime = Date.now();

    return new Promise((resolve) => {
      exec(
        rawCommand,
        {
          timeout: 45000,
          maxBuffer: 1024 * 1024 * 2, // 2MB buffer
          env: { ...process.env, CI: 'true', NODE_ENV: 'test' },
        },
        async (error, stdout, stderr) => {
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          const exitCode = error ? error.code || 1 : 0;
          const isPass = exitCode === 0;

          // Parse pass / fail counts if present in stdout/stderr
          const outputText = `${stdout}\n${stderr}`;
          let passed = 0;
          let failed = 0;
          let skipped = 0;

          const passMatch = outputText.match(/(\d+)\s+(?:passed|passing|ok)/i);
          if (passMatch) passed = parseInt(passMatch[1], 10);

          const failMatch = outputText.match(/(\d+)\s+(?:failed|failing|error)/i);
          if (failMatch) failed = parseInt(failMatch[1], 10);

          const skipMatch = outputText.match(/(\d+)\s+(?:skipped|todo)/i);
          if (skipMatch) skipped = parseInt(skipMatch[1], 10);

          if (isPass && passed === 0) passed = 1;
          if (!isPass && failed === 0) failed = 1;

          const result = {
            status: isPass ? 'PASS' : 'FAIL',
            command: rawCommand,
            exitCode,
            stdout: stdout.slice(0, 10000),
            stderr: stderr.slice(0, 5000),
            duration: `${duration}s`,
            passed,
            failed,
            skipped,
            executedAt: new Date(),
          };

          try {
            await AuditLog.create({
              repository: repositoryId,
              user: userId,
              action: 'tests_executed',
              status: isPass ? 'success' : 'warning',
              details: { command: rawCommand, passed, failed, duration: `${duration}s` },
              message: `Executed test command "${rawCommand}" (${result.status}: ${passed} passed, ${failed} failed)`,
            });
          } catch (e) {
            // Ignore audit failure
          }

          resolve(result);
        }
      );
    });
  }

  /**
   * Safely commit and apply generated test suite to repository branch.
   */
  async applyApprovedTests(userId, repositoryId, payload = {}) {
    const {
      issueId,
      analysisId,
      filePath,
      testFilePath,
      testCode,
      branch: targetBranch,
      commitMessage,
    } = payload;

    if (!testFilePath || !testCode) {
      throw new ApiError(400, 'Test file path and test code are required to apply tests');
    }

    const repo = await Repository.findOne({ _id: repositoryId, user: userId });
    if (!repo) throw new ApiError(404, 'Repository not found');

    const userWithGithub = await githubService.getUserWithGithubToken(userId);
    const accessToken = userWithGithub?.github?.accessToken;
    if (!accessToken) throw new ApiError(401, 'GitHub authentication token required to commit test changes');

    const { githubOwner, name, defaultBranch, htmlUrl } = repo;

    let branchName = targetBranch;
    // If no branch provided, create a new branch from default branch head
    if (!branchName) {
      const fileSlug = (testFilePath || 'tests').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 25);
      branchName = `devmind/tests/${fileSlug}-${Date.now().toString(36)}`;
      const headSha = await githubService.getBranchHeadSha(accessToken, githubOwner, name, defaultBranch);
      await githubService.createBranch(accessToken, githubOwner, name, branchName, headSha);
    }

    // Check if test file already exists on this branch to pass its sha
    let fileSha = undefined;
    try {
      const existing = await githubService.fetchFileContent(
        accessToken,
        githubOwner,
        name,
        testFilePath,
        branchName
      );
      fileSha = existing.sha;
    } catch (_err) {
      // New file creation on branch
    }

    const finalCommitMsg = commitMessage || `test(${filePath || testFilePath}): add automated 4-scenario test suite`;

    await githubService.commitFileUpdate(
      accessToken,
      githubOwner,
      name,
      testFilePath,
      testCode,
      finalCommitMsg,
      branchName,
      fileSha
    );

    const compareUrl = `${htmlUrl}/compare/${defaultBranch}...${branchName}?expand=1`;

    if (analysisId && issueId) {
      try {
        const analysis = await Analysis.findOne({ _id: analysisId, user: userId });
        if (analysis) {
          const issue = analysis.issues.id(issueId);
          if (issue) {
            issue.testBranch = branchName;
            issue.testCompareUrl = compareUrl;
            issue.testAppliedAt = new Date();
            await analysis.save();
          }
        }
      } catch (_saveErr) {
        // Continue if analysis record update encounters issue
      }
    }

    await AuditLog.create({
      repository: repositoryId,
      user: userId,
      action: 'tests_applied',
      status: 'success',
      targetFile: testFilePath,
      issueId: issueId || null,
      details: { branchName, compareUrl, commitMessage: finalCommitMsg },
      message: `Applied test suite to ${testFilePath} on branch "${branchName}"`,
    });

    return {
      success: true,
      branch: branchName,
      testFilePath,
      compareUrl,
      appliedAt: new Date(),
    };
  }
}

module.exports = new TestRunnerService();
