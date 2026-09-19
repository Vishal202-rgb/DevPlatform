const test = require('node:test');
const assert = require('node:assert/strict');
const env = require('../src/config/env');
const geminiService = require('../src/services/geminiService');
const ApiError = require('../src/utils/ApiError');

// Ensure API key is configured for tests
env.geminiApiKey = env.geminiApiKey || 'test-mock-api-key-12345';
env.geminiModel = 'gemini-2.5-flash';
env.geminiFallbackModel = 'gemini-1.5-flash';

const sampleMockAnalysisResponse = {
  data: {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            {
              text: JSON.stringify({
                issues: [
                  {
                    severity: 'high',
                    category: 'security',
                    file: 'src/auth.js',
                    line: 42,
                    description: 'Hardcoded secret token detected in auth handler.',
                    recommendation: 'Move the secret token to an environment variable.',
                    suggestedFix: 'const token = process.env.AUTH_SECRET;',
                  },
                ],
              }),
            },
          ],
        },
      },
    ],
  },
};

test('1. Successful Gemini analysis on primary model on first attempt', async () => {
  const originalPost = geminiService._geminiClient.post;
  let requestedPath = '';

  geminiService._geminiClient.post = async (path, _body) => {
    requestedPath = path;
    return sampleMockAnalysisResponse;
  };

  try {
    const files = [{ path: 'src/auth.js', content: 'const token = "secret";' }];
    const statusUpdates = [];
    const result = await geminiService.analyzeCode('test/repo', files, (msg) => statusUpdates.push(msg));

    assert.equal(Array.isArray(result.issues), true);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].severity, 'high');
    assert.equal(result.issues[0].category, 'security');
    assert.equal(result.issues[0].file, 'src/auth.js');
    assert.equal(result.modelUsed, 'gemini-2.5-flash');
    assert.equal(requestedPath.includes('gemini-2.5-flash'), true);
  } finally {
    geminiService._geminiClient.post = originalPost;
  }
});

test('2. Temporary 429 error triggers retry with exponential backoff and succeeds', async () => {
  const originalPost = geminiService._geminiClient.post;
  let attempts = 0;
  const statusUpdates = [];

  geminiService._geminiClient.post = async (path, _body) => {
    attempts++;
    if (attempts === 1) {
      const error = new Error('Resource exhausted');
      error.response = {
        status: 429,
        data: { error: { code: 429, message: 'Resource has been exhausted (rate limit).', status: 'RESOURCE_EXHAUSTED' } },
      };
      throw error;
    }
    return sampleMockAnalysisResponse;
  };

  try {
    const files = [{ path: 'src/auth.js', content: 'const token = "secret";' }];
    const result = await geminiService.analyzeCode('test/repo', files, (msg) => statusUpdates.push(msg));

    assert.equal(attempts, 2, 'Should succeed on attempt 2 after retry');
    assert.equal(result.issues.length, 1);
    assert.equal(result.modelUsed, 'gemini-2.5-flash');
    assert.equal(statusUpdates.includes('AI model is temporarily busy. Retrying...'), true);
  } finally {
    geminiService._geminiClient.post = originalPost;
  }
});

test('3. Temporary 503 / high-demand error on primary model falls back to fallback model', async () => {
  const originalPost = geminiService._geminiClient.post;
  const pathsCalled = [];
  const statusUpdates = [];

  geminiService._geminiClient.post = async (path, _body) => {
    pathsCalled.push(path);
    if (path.includes('gemini-2.5-flash')) {
      const error = new Error('High demand');
      error.response = {
        status: 503,
        data: {
          error: {
            code: 503,
            message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
            status: 'UNAVAILABLE',
          },
        },
      };
      throw error;
    }
    // Fallback model succeeds
    return sampleMockAnalysisResponse;
  };

  try {
    // Override retry delays with fast 1ms for test speed
    const { response, modelUsed } = await geminiService.callGeminiWithRetryAndFallback(
      (model) => ({ contents: [{ role: 'user', parts: [{ text: 'test' }] }] }),
      {
        retryDelays: [5, 10, 15],
        onStatusUpdate: (msg) => statusUpdates.push(msg),
      }
    );

    assert.equal(modelUsed, 'gemini-1.5-flash');
    assert.ok(response?.data?.candidates);
    assert.ok(pathsCalled.some((p) => p.includes('gemini-2.5-flash')));
    assert.ok(pathsCalled.some((p) => p.includes('gemini-1.5-flash')));
    assert.ok(statusUpdates.includes('Primary AI model unavailable. Trying fallback model...'));
  } finally {
    geminiService._geminiClient.post = originalPost;
  }
});

test('4. Invalid API key error fails immediately without retrying', async () => {
  const originalPost = geminiService._geminiClient.post;
  let attempts = 0;
  const statusUpdates = [];

  geminiService._geminiClient.post = async (_path, _body) => {
    attempts++;
    const error = new Error('Bad request');
    error.response = {
      status: 400,
      data: { error: { code: 400, message: 'API_KEY_INVALID: API key not valid.', status: 'INVALID_ARGUMENT' } },
    };
    throw error;
  };

  try {
    await geminiService.callGeminiWithRetryAndFallback(
      (model) => ({ contents: [{ role: 'user', parts: [{ text: 'test' }] }] }),
      {
        retryDelays: [5, 10, 15],
        onStatusUpdate: (msg) => statusUpdates.push(msg),
      }
    );
    assert.fail('Should have thrown an error');
  } catch (err) {
    assert.equal(attempts, 1, 'Should NOT retry permanent error');
    assert.equal(statusUpdates.length, 0, 'Should not emit retry or fallback status');
    assert.equal(err.statusCode, 400);
    assert.ok(err.message.includes('Gemini API key is invalid'));
  } finally {
    geminiService._geminiClient.post = originalPost;
  }
});

test('5. All models unavailable throws proper transient 503 error', async () => {
  const originalPost = geminiService._geminiClient.post;
  let totalAttempts = 0;

  geminiService._geminiClient.post = async (_path, _body) => {
    totalAttempts++;
    const error = new Error('High demand');
    error.response = {
      status: 503,
      data: {
        error: {
          code: 503,
          message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
          status: 'UNAVAILABLE',
        },
      },
    };
    throw error;
  };

  try {
    await geminiService.callGeminiWithRetryAndFallback(
      (model) => ({ contents: [{ role: 'user', parts: [{ text: 'test' }] }] }),
      {
        retryDelays: [5, 10, 15],
      }
    );
    assert.fail('Should have thrown an error');
  } catch (err) {
    // 2 models * 4 attempts each = 8 total attempts
    assert.equal(totalAttempts, 8);
    assert.equal(err.statusCode, 503);
    assert.equal(
      err.message,
      'AI analysis is temporarily unavailable. Please try again in a few moments.'
    );
  } finally {
    geminiService._geminiClient.post = originalPost;
  }
});

test('6. API key sanitization protects credentials', () => {
  const rawMsg = 'Error at https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyA1234567890abcdefghijklmnopqrstuvwx - failed';
  const clean = geminiService.sanitizeErrorMessage(rawMsg);
  assert.equal(clean.includes('AIzaSyA1234567890abcdefghijklmnopqrstuvwx'), false);
  assert.equal(clean.includes('key=[REDACTED]'), true);
});

test('7. Transient Gemini error detector accurately classifies transient vs permanent', () => {
  // 429
  assert.equal(geminiService.isTransientGeminiError({ response: { status: 429, data: {} } }), true);

  // 503
  assert.equal(geminiService.isTransientGeminiError({ response: { status: 503, data: {} } }), true);

  // High demand message in 500 or other status
  assert.equal(
    geminiService.isTransientGeminiError({
      response: {
        status: 500,
        data: { error: { message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.' } },
      },
    }),
    true
  );

  // Invalid key (permanent)
  assert.equal(
    geminiService.isTransientGeminiError({
      response: {
        status: 400,
        data: { error: { message: 'API_KEY_INVALID: API key not valid.' } },
      },
    }),
    false
  );

  // 401 / 403 (permanent)
  assert.equal(geminiService.isTransientGeminiError({ response: { status: 401, data: {} } }), false);
  assert.equal(geminiService.isTransientGeminiError({ response: { status: 403, data: {} } }), false);
});

test('8. Concurrency guard rejects simultaneous requests on same repository with 409', async () => {
  const analysisService = require('../src/services/analysisService');
  const repoId = 'repo-simultaneous-test-123';

  // Mark repository as actively analyzing
  analysisService.activeAnalysisJobs.set(repoId, {
    stage: 'analyzing',
    message: 'AI code analysis in progress...',
    startedAt: Date.now(),
  });

  try {
    // Attempting to run analysis on the same repository should throw 409
    await analysisService.runAnalysis('user-1', repoId);
    assert.fail('Should have rejected simultaneous analysis');
  } catch (err) {
    assert.equal(err.statusCode, 409);
    assert.equal(err.message, 'An analysis is already running for this repository. Please wait for it to finish.');
  } finally {
    analysisService.activeAnalysisJobs.delete(repoId);
  }
});

test('9. Analysis status polling returns active stage and message', () => {
  const analysisService = require('../src/services/analysisService');
  const repoId = 'repo-status-test-456';

  // Idle state
  assert.equal(analysisService.getAnalysisStatus(repoId), null);

  // Active state
  analysisService.activeAnalysisJobs.set(repoId, {
    stage: 'retrying',
    message: 'AI model is temporarily busy. Retrying...',
    startedAt: Date.now(),
  });

  const status = analysisService.getAnalysisStatus(repoId);
  assert.ok(status);
  assert.equal(status.stage, 'retrying');
  assert.equal(status.message, 'AI model is temporarily busy. Retrying...');

  // Fallback state
  analysisService.activeAnalysisJobs.set(repoId, {
    stage: 'fallback',
    message: 'Primary AI model unavailable. Trying fallback model...',
    startedAt: Date.now(),
  });

  const fallbackStatus = analysisService.getAnalysisStatus(repoId);
  assert.equal(fallbackStatus.stage, 'fallback');
  assert.equal(fallbackStatus.message, 'Primary AI model unavailable. Trying fallback model...');

  analysisService.activeAnalysisJobs.delete(repoId);
});

test('10. Score computation and issue summarization match established formulas', () => {
  const analysisService = require('../src/services/analysisService');

  const issues = [
    { severity: 'critical' },
    { severity: 'high' },
    { severity: 'medium' },
    { severity: 'low' },
  ];

  const summary = analysisService.summarize(issues);
  assert.deepEqual(summary, {
    critical: 1,
    high: 1,
    medium: 1,
    low: 1,
    totalIssues: 4,
  });

  // Deduction: 15 (critical) + 8 (high) + 4 (medium) + 1 (low) = 28. Score = 100 - 28 = 72.
  const score = analysisService.computeScore(issues);
  assert.equal(score, 72);
});

test('11. Failed analysis does NOT create fake/incomplete analysis record in database', async () => {
  const Analysis = require('../src/models/Analysis');
  const Repository = require('../src/models/Repository');
  const githubService = require('../src/services/githubService');
  const analysisService = require('../src/services/analysisService');

  let createCalled = false;
  const originalCreate = Analysis.create;
  const originalFindOne = Repository.findOne;
  const originalGetUser = githubService.getUserWithGithubToken;
  const originalFetchFiles = githubService.fetchSourceFiles;
  const originalAnalyze = geminiService.analyzeCode;

  Analysis.create = async () => {
    createCalled = true;
    return {};
  };

  Repository.findOne = async () => ({
    _id: 'fake-repo-id',
    fullName: 'owner/repo',
    githubOwner: 'owner',
    name: 'repo',
    defaultBranch: 'main',
    save: async () => {},
  });

  githubService.getUserWithGithubToken = async () => ({
    github: { accessToken: 'fake-token' },
  });

  githubService.fetchSourceFiles = async () => ({
    files: [{ path: 'index.js', content: 'console.log("hello");' }],
    totalFilesInTree: 1,
  });

  // Simulate Gemini failing
  geminiService.analyzeCode = async () => {
    throw new ApiError(503, 'AI analysis is temporarily unavailable. Please try again in a few moments.');
  };

  try {
    await analysisService.runAnalysis('fake-user-id', 'fake-repo-id');
    assert.fail('Should have thrown on Gemini failure');
  } catch (err) {
    assert.equal(err.statusCode, 503);
    assert.equal(createCalled, false, 'Analysis.create MUST NOT be called when analysis fails');
  } finally {
    Analysis.create = originalCreate;
    Repository.findOne = originalFindOne;
    githubService.getUserWithGithubToken = originalGetUser;
    githubService.fetchSourceFiles = originalFetchFiles;
    geminiService.analyzeCode = originalAnalyze;
  }
});


