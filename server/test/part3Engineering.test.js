const { test, describe } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const testRunnerService = require('../src/services/testRunnerService');
const verificationAgentService = require('../src/services/verificationAgentService');
const AuditLog = require('../src/models/AuditLog');

describe('DevMind Part 3 - Security Gate & Code Fix Checks', () => {
  // Test Security Gate regex rules
  const runSecurityGate = (code) => {
    const warnings = [];
    if (/(?:api[_-]?key|secret|token|password|auth[_-]?token|private[_-]?key)\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{12,}['"]/i.test(code)) {
      warnings.push('Potential hardcoded API key or credential string detected.');
    }
    if (/\beval\s*\(|\bnew\s+Function\s*\(|\bvm\.runInThisContext/i.test(code)) {
      warnings.push('Unsafe dynamic code evaluation (eval / new Function) detected.');
    }
    if (/child_process\.(?:exec|execSync|spawn)\s*\(\s*`[^`]*\${/i.test(code)) {
      warnings.push('Potential command injection via unescaped shell execution argument.');
    }
    return {
      safe: warnings.length === 0,
      securityReviewRequired: warnings.length > 0,
      warnings,
    };
  };

  test('blocks unsafe eval and dynamic execution in proposed fixes', () => {
    const dangerousCode = 'const result = eval(userSuppliedInput);';
    const check = runSecurityGate(dangerousCode);
    assert.strictEqual(check.safe, false);
    assert.strictEqual(check.securityReviewRequired, true);
    assert.ok(check.warnings.some((w) => w.includes('eval')));
  });

  test('blocks command injection patterns', () => {
    const dangerousCode = 'child_process.exec(`rm -rf ${userDir}`);';
    const check = runSecurityGate(dangerousCode);
    assert.strictEqual(check.safe, false);
    assert.ok(check.warnings.some((w) => w.includes('command injection')));
  });

  test('passes clean, sanitized code without warnings', () => {
    const safeCode = `
      function validateUserInput(input) {
        if (!input || typeof input !== 'string') return false;
        return input.trim().length > 0;
      }
    `;
    const check = runSecurityGate(safeCode);
    assert.strictEqual(check.safe, true);
    assert.strictEqual(check.warnings.length, 0);
  });
});

describe('DevMind Part 3 - Test Execution Allowlist & Verification', () => {
  test('rejects arbitrary unallowed shell execution commands with 400 ApiError', async () => {
    await assert.rejects(
      async () => {
        await testRunnerService.executeControlledTests('user123', 'repo123', {
          command: 'rm -rf / || cat /etc/passwd',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('not in the approved test runner allowlist'));
        return true;
      }
    );
  });

  test('computes accurate PR readiness scorecard across 5 checkpoints', () => {
    const fullReady = verificationAgentService.calculatePrReadiness({
      hasCodeChanges: true,
      testsStatus: 'PASS',
      securitySafe: true,
      hasImpactAnalysis: true,
      verificationResolved: 'RESOLVED',
    });

    assert.strictEqual(fullReady.score, 100);
    assert.strictEqual(fullReady.isReady, true);
    assert.strictEqual(fullReady.checklist.length, 5);
    assert.ok(fullReady.checklist.every((c) => c.ready));

    const partialReady = verificationAgentService.calculatePrReadiness({
      hasCodeChanges: true,
      testsStatus: 'FAIL',
      securitySafe: true,
      hasImpactAnalysis: false,
      verificationResolved: 'NOT_RESOLVED',
    });

    assert.strictEqual(partialReady.score, 40);
    assert.strictEqual(partialReady.isReady, false);
  });

  test('applyApprovedTests rejects missing testCode with 400 ApiError', async () => {
    await assert.rejects(
      async () => {
        await testRunnerService.applyApprovedTests('user123', 'repo123', {
          testFilePath: 'tests/example.test.js',
          testCode: '',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('test code are required'));
        return true;
      }
    );
  });

  test('applyApprovedTests rejects missing testFilePath with 400 ApiError', async () => {
    await assert.rejects(
      async () => {
        await testRunnerService.applyApprovedTests('user123', 'repo123', {
          testFilePath: '',
          testCode: 'describe("sample", () => {});',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('Test file path and test code are required'));
        return true;
      }
    );
  });
});

describe('DevMind Part 3 - AuditLog Action Enum Validation', () => {
  const sampleUserId = new mongoose.Types.ObjectId();
  const sampleRepoId = new mongoose.Types.ObjectId();

  const allowedActions = [
    'fix_generated',
    'impact_analyzed',
    'tests_generated',
    'tests_applied',
    'tests_executed',
    'verification_completed',
    'fix_applied',
    'pr_created',
    'rollback_performed',
  ];

  for (const action of allowedActions) {
    test(`validates successfully for allowed action "${action}"`, () => {
      const doc = new AuditLog({
        repository: sampleRepoId,
        user: sampleUserId,
        action,
        status: 'success',
        targetFile: 'src/example.js',
        message: `Action ${action} performed`,
      });

      const error = doc.validateSync();
      assert.strictEqual(error, undefined, `Expected action "${action}" to pass schema validation`);
    });
  }

  test('validates specifically that tests_applied passes without schema validation error', () => {
    const doc = new AuditLog({
      repository: sampleRepoId,
      user: sampleUserId,
      action: 'tests_applied',
      status: 'success',
      targetFile: 'src/utils/math.test.js',
      details: { branchName: 'devmind/tests/math', commitMessage: 'test: add test suite' },
      message: 'Applied test suite to src/utils/math.test.js',
    });

    const error = doc.validateSync();
    assert.strictEqual(error, undefined);
    assert.strictEqual(doc.action, 'tests_applied');
  });

  test('rejects invalid action with Mongoose ValidationError', () => {
    const doc = new AuditLog({
      repository: sampleRepoId,
      user: sampleUserId,
      action: 'invalid_action_name',
      status: 'success',
    });

    const error = doc.validateSync();
    assert.ok(error, 'Expected validation error for invalid action');
    assert.ok(error.errors.action, 'Expected error on action field');
    assert.strictEqual(error.errors.action.kind, 'enum');
  });
});

describe('DevMind AI Remediation Workflow - End-to-End Fix & Target Validation', () => {
  const fixAgentService = require('../src/services/fixAgentService');

  test('validateProposedFix runs target tests against proposed code in isolated sandbox', async () => {
    const sampleCSource = `
#include <stdio.h>
int main() {
    printf("Fixed output\\n");
    return 0;
}
`;
    const sampleTest = `
describe('fix verification', () => {
  it('checks fixed output', async () => {
    const { stdout, code } = await runCProgram();
    expect(code).toBe(0);
    expect(stdout).toContain("Fixed output");
  });
});
`;
    const testResult = await fixAgentService.validateProposedFix('user123', null, {
      filePath: 'src/example.c',
      proposedContent: sampleCSource,
      testCode: sampleTest,
      language: 'c',
    });

    assert.strictEqual(testResult.status, 'PASS');
    assert.strictEqual(testResult.exitCode, 0);
    assert.strictEqual(testResult.passed, 1);
  });

  test('validateProposedFix reports failure when proposed code fails target test', async () => {
    const buggyCSource = `
#include <stdio.h>
int main() {
    printf("Buggy output\\n");
    return 0;
}
`;
    const strictTest = `
describe('strict test', () => {
  it('expects correct output', async () => {
    const { stdout } = await runCProgram();
    expect(stdout).toContain("Fixed output");
  });
});
`;
    const testResult = await fixAgentService.validateProposedFix('user123', null, {
      filePath: 'src/example.c',
      proposedContent: buggyCSource,
      testCode: strictTest,
      language: 'c',
    });

    assert.strictEqual(testResult.status, 'FAIL');
    assert.strictEqual(testResult.exitCode, 1);
    assert.strictEqual(testResult.failed, 1);
  });

  test('verification rejects RESOLVED if target test output contains failure evidence', async () => {
    const payload = {
      originalIssue: {
        title: 'Buffer overflow risk in input parser',
        description: 'Missing input validation allows segmentation fault on negative numbers',
        file: 'src/parser.c',
      },
      targetFile: 'src/parser.c',
      testResults: {
        status: 'FAIL',
        exitCode: 1,
        passed: 1,
        failed: 1,
        total: 2,
        runner: 'C Target Runner',
        stdout: '✕ Scenario failed: -5 is largest was not returned',
        stderr: 'Assertion failed',
      },
    };

    const verification = await verificationAgentService.verifyFixResolution(null, null, payload);
    assert.notStrictEqual(verification.resolved, 'RESOLVED');
    assert.ok(verification.resolved === 'NOT_RESOLVED' || verification.resolved === 'VERIFICATION_FAILED');
  });
});
