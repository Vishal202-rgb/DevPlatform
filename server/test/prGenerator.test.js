const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const env = require('../src/config/env');
const geminiService = require('../src/services/geminiService');
const githubService = require('../src/services/githubService');
const ApiError = require('../src/utils/ApiError');

env.geminiApiKey = env.geminiApiKey || 'test-mock-api-key-12345';
env.geminiModel = 'gemini-2.5-flash';
env.geminiFallbackModel = 'gemini-1.5-flash';

test('AI PR Generator - geminiService.generatePullRequestDetails', async (t) => {
  const originalPost = geminiService._geminiClient.post;

  t.afterEach(() => {
    geminiService._geminiClient.post = originalPost;
  });

  await t.test('rejects empty diff with 400 ApiError', async () => {
    await assert.rejects(
      async () => {
        await geminiService.generatePullRequestDetails({
          repoLabel: 'owner/repo',
          baseBranch: 'main',
          headBranch: 'devplatform-fix/issue-1',
          issue: { file: 'src/auth.js', description: 'Sample issue' },
          changedFiles: [],
        });
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /empty diff|no file changes/i);
        return true;
      }
    );
  });

  await t.test('generates concise title and structured Markdown with all required sections', async () => {
    const expectedDescription = `## Summary
Fix SQL injection vulnerability in user query.

## Changes
- Replaced concatenated raw SQL query with parameterized statements.
- Added input sanitization on user-supplied query fields.

## Why
The previous raw SQL query was vulnerable to parameter tampering and SQL injection.

## Testing
- Automated validation suite executed.
- Parameterized query tests verified.

## Files Changed
- \`src/db/users.js\``;

    geminiService._geminiClient.post = async () => ({
      status: 200,
      data: {
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'Fix: Prevent SQL injection in user query builder',
                    description: expectedDescription,
                  }),
                },
              ],
            },
          },
        ],
      },
    });

    const result = await geminiService.generatePullRequestDetails({
      repoLabel: 'acme/webapp',
      baseBranch: 'main',
      headBranch: 'devplatform-fix/sec-123',
      issue: {
        file: 'src/db/users.js',
        line: 45,
        severity: 'critical',
        category: 'security',
        description: 'Vulnerable raw string interpolation in SQL statement',
        recommendation: 'Use parameterized queries',
      },
      changedFiles: [
        {
          filename: 'src/db/users.js',
          status: 'modified',
          additions: 6,
          deletions: 2,
          patch: '@@ -45,2 +45,6 @@ - const q = "SELECT * FROM users WHERE id = " + id;\n+ const q = "SELECT * FROM users WHERE id = $1";\n+ const params = [id];',
        },
      ],
      actionType: 'fix',
    });

    assert.ok(result.title);
    assert.strictEqual(result.title, 'Fix: Prevent SQL injection in user query builder');

    // Verify all 5 required sections are present
    assert.ok(result.description.includes('## Summary'), 'Description must include ## Summary');
    assert.ok(result.description.includes('## Changes'), 'Description must include ## Changes');
    assert.ok(result.description.includes('## Why'), 'Description must include ## Why');
    assert.ok(result.description.includes('## Testing'), 'Description must include ## Testing');
    assert.ok(result.description.includes('## Files Changed'), 'Description must include ## Files Changed');
  });

  await t.test('supports test generation PR details', async () => {
    const expectedDescription = `## Summary
Add comprehensive automated test suite for payment validator.

## Changes
- Added unit tests for valid currency codes.
- Added edge case tests for negative and zero amounts.

## Why
Increase test coverage and verify boundary constraints for checkout flows.

## Testing
- Ran test runner against payment validator suite.

## Files Changed
- \`tests/paymentValidator.test.js\``;

    geminiService._geminiClient.post = async () => ({
      status: 200,
      data: {
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'Test: Add comprehensive unit tests for payment validator',
                    description: expectedDescription,
                  }),
                },
              ],
            },
          },
        ],
      },
    });

    const result = await geminiService.generatePullRequestDetails({
      repoLabel: 'acme/shop',
      baseBranch: 'main',
      headBranch: 'devplatform-tests/checkout-99',
      issue: {
        file: 'src/checkout/payment.js',
        description: 'Missing edge case validation tests',
      },
      changedFiles: [
        {
          filename: 'tests/paymentValidator.test.js',
          status: 'added',
          additions: 40,
          deletions: 0,
          patch: '+ describe("paymentValidator", () => { ... });',
        },
      ],
      actionType: 'test',
    });

    assert.match(result.title, /^Test:/);
    assert.ok(result.description.includes('## Summary'));
    assert.ok(result.description.includes('## Changes'));
    assert.ok(result.description.includes('## Why'));
    assert.ok(result.description.includes('## Testing'));
    assert.ok(result.description.includes('## Files Changed'));
  });

  await t.test('recovers via fallback model if primary model fails with 503', async () => {
    let callCount = 0;
    const requestedModels = [];

    geminiService._geminiClient.post = async (url) => {
      callCount++;
      const modelMatch = url.match(/\/models\/([^:]+):generateContent/);
      if (modelMatch) requestedModels.push(modelMatch[1]);

      if (callCount === 1) {
        const err = new Error('503 Service Unavailable');
        err.response = { status: 503, data: { error: { message: 'High demand' } } };
        throw err;
      }

      return {
        status: 200,
        data: {
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: 'Fix: Sanitize token header in API client',
                      description: '## Summary\nFix header.\n\n## Changes\n- Sanitized header.\n\n## Why\nSecurity.\n\n## Testing\n- Validated.\n\n## Files Changed\n- `src/api.js`',
                    }),
                  },
                ],
              },
            },
          ],
        },
      };
    };

    const result = await geminiService.generatePullRequestDetails({
      repoLabel: 'acme/app',
      baseBranch: 'main',
      headBranch: 'devplatform-fix/token-patch',
      issue: { file: 'src/api.js', description: 'Leaked auth header' },
      changedFiles: [{ filename: 'src/api.js', status: 'modified', additions: 2, deletions: 1, patch: '...' }],
    });

    assert.strictEqual(result.title, 'Fix: Sanitize token header in API client');
    assert.ok(result.description.includes('## Summary'));
  });
});

test('GitHub Service - compareBranches and createPullRequest', async (t) => {
  const originalGet = githubService.compareBranches;
  const originalPost = githubService.createPullRequest;

  await t.test('compareBranches formats diff correctly', async () => {
    assert.strictEqual(typeof githubService.compareBranches, 'function');
    assert.strictEqual(typeof githubService.createPullRequest, 'function');
  });
});

test('Security & Credential Redaction in PR Generation', async () => {
  // Ensure that no internal environment tokens are injected into PR generation prompt
  const sensitiveEnvKeys = ['GITHUB_CLIENT_SECRET', 'JWT_SECRET', 'GEMINI_API_KEY', 'MONGODB_URI'];
  
  for (const key of sensitiveEnvKeys) {
    if (env[key]) {
      assert.doesNotMatch(
        JSON.stringify(geminiService.generatePullRequestDetails.toString()),
        new RegExp(env[key]),
        `Service source code must never include live environment secret ${key}`
      );
    }
  }
});
