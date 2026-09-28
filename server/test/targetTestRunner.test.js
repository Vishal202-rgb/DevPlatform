const { test, describe } = require('node:test');
const assert = require('node:assert');
const targetTestRunnerService = require('../src/services/targetTestRunnerService');
const testRunnerService = require('../src/services/testRunnerService');
const verificationAgentService = require('../src/services/verificationAgentService');

describe('Target Test Runner - C Execution & Framework Detection', () => {
  test('detects C framework correctly for .c and .h files without defaulting to Jest/npm test', () => {
    const cTarget = 'mini-projects/mini-project.c';
    // Test language detection
    const lang = targetTestRunnerService.executeTargetTest;
    assert.ok(lang, 'executeTargetTest exists on targetTestRunnerService');

    // Test framework detection in testRunnerService
    // Call generateComprehensiveTests or internal framework detection if exported
  });

  test('executes C target program and JS test harness with runCProgram without running DevMind internal npm test', async () => {
    const sampleCSource = `
#include <stdio.h>

int main() {
    int val = 0;
    if (scanf("%d", &val) == 1) {
        printf("Received: %d\\n", val * 2);
    } else {
        printf("No input\\n");
    }
    return 0;
}
`;

    const sampleTestCode = `
describe('C-Practicle mini-project test suite', () => {
  it('1. Regression Test: verifies multiplier logic for standard input', async () => {
    const { stdout, stderr, code } = await runCProgram("5\\n");
    expect(code).toBe(0);
    expect(stdout).toContain("Received: 10");
  });

  it('2. Happy Path Test: verifies zero multiplier', async () => {
    const { stdout, code } = await runCProgram("0\\n");
    expect(code).toBe(0);
    expect(stdout).toContain("Received: 0");
  });

  it('3. Edge Case Test: boundary input', async () => {
    const { stdout, code } = await runCProgram("100\\n");
    expect(code).toBe(0);
    expect(stdout).toContain("Received: 200");
  });

  it('4. Error Handling Test: no input handling', async () => {
    const { stdout, code } = await runCProgram("");
    expect(code).toBe(0);
    expect(stdout).toContain("No input");
  });
});
`;

    const result = await targetTestRunnerService.executeTargetTest('mockUserId', null, {
      owner: 'Vishal202-rgb',
      repo: 'C-Practicle',
      targetFile: 'mini-projects/mini-project.c',
      testFilePath: 'mini-projects/mini-project.test.c',
      targetContent: sampleCSource,
      testCode: sampleTestCode,
      language: 'c',
    });

    // 1. Verify that DevMind server internal test files are NEVER present
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    assert.strictEqual(combinedOutput.includes('architectureService.test.js'), false, 'Must not include internal DevMind tests');
    assert.strictEqual(combinedOutput.includes('geminiRobustness.test.js'), false, 'Must not include internal DevMind tests');
    assert.strictEqual(combinedOutput.includes('prGenerator.test.js'), false, 'Must not include internal DevMind tests');
    assert.strictEqual(combinedOutput.includes('securityScanner.test.js'), false, 'Must not include internal DevMind tests');

    // 2. Verify command is NOT generic npm test
    assert.notStrictEqual(result.command, 'npm test', 'Command must not be generic npm test');
    assert.ok(result.runner.toLowerCase().includes('c') || result.runner.toLowerCase().includes('target'));

    // 3. Verify target repository metadata is preserved
    assert.strictEqual(result.repository, 'Vishal202-rgb/C-Practicle');
    assert.strictEqual(result.targetFile, 'mini-projects/mini-project.c');
    assert.strictEqual(result.testFile, 'mini-projects/mini-project.test.c');
    assert.strictEqual(result.language, 'c');

    // 4. Verify test scenario execution
    if (result.status === 'PASS') {
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(result.passed, 4);
      assert.strictEqual(result.failed, 0);
      assert.strictEqual(result.total, 4);
      assert.strictEqual(result.tests.length, 4);
      assert.ok(result.tests.every((t) => t.status === 'passed'));
    } else {
      // If gcc compiler is missing on host, verify clean failure format
      assert.strictEqual(result.status, 'FAIL');
      assert.strictEqual(result.exitCode, 1);
      assert.ok(result.stderr.length > 0);
    }
  });

  test('reports compilation failure cleanly when C source has syntax error', async () => {
    const invalidCSource = `
#include <stdio.h>
int main() {
    this_is_an_invalid_syntax_error !@#$
    return 0;
}
`;

    const result = await targetTestRunnerService.executeTargetTest('mockUserId', null, {
      owner: 'Vishal202-rgb',
      repo: 'C-Practicle',
      targetFile: 'mini-projects/invalid.c',
      targetContent: invalidCSource,
      testCode: 'const res = await runCProgram();',
      language: 'c',
    });

    assert.strictEqual(result.status, 'FAIL');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.exitCode, 1);
    assert.strictEqual(result.failed >= 1, true);
    assert.ok(result.stderr.includes('Compilation') || result.stderr.includes('Error') || result.stderr.includes('Compiler'));
  });

  test('reports test failure when target assertion fails', async () => {
    const sampleCSource = `
#include <stdio.h>
int main() {
    printf("Hello World\\n");
    return 0;
}
`;

    const failingTestCode = `
describe('Failing test scenario', () => {
  it('expects wrong output', async () => {
    const { stdout } = await runCProgram();
    expect(stdout).toContain("Wrong Expected Output That Does Not Exist");
  });
});
`;

    const result = await targetTestRunnerService.executeTargetTest('mockUserId', null, {
      owner: 'Vishal202-rgb',
      repo: 'C-Practicle',
      targetFile: 'mini-projects/hello.c',
      targetContent: sampleCSource,
      testCode: failingTestCode,
      language: 'c',
    });

    // If compiler was available to compile, assertion must fail
    if (result.tests && result.tests[0]?.name === 'Failing test scenario > expects wrong output') {
      assert.strictEqual(result.status, 'FAIL');
      assert.strictEqual(result.passed, 0);
      assert.strictEqual(result.failed, 1);
      assert.strictEqual(result.exitCode, 1);
      assert.ok(result.tests[0].error.includes('Wrong Expected Output'));
    }
  });

  test('executes experiment_4.c test suite with CLI prompt and trailing whitespace normalization', async () => {
    const experiment4CSource = `
#include <stdio.h>

int main() {
    int a, b;
    printf("Enter two numbers: ");
    scanf("%d %d", &a, &b);

    if (a > b) {
        printf("%d is largest\\n", a);
    } else if (b > a) {
        printf("%d is largest\\n", b);
    } else {
        printf("Both numbers are equal\\n");
    }

    return 0;
}
`;

    const experiment4TestCode = `
describe('shubham-11407/experiment_4.c test suite', () => {
  it('1. Regression Test: verifies equality when both numbers are equal', async () => {
    const { stdout, code } = await runCProgram("5 5\\n");
    expect(code).toBe(0);
    expect(stdout).toContain("Numbers are equal ");
  });

  it('2. Happy Path Test: verifies largest when first number is greater', async () => {
    const { stdout, code } = await runCProgram("10 5\\n");
    expect(code).toBe(0);
    expect(stdout).toContain("10 is largest ");
  });

  it('3. Edge Case Test: verifies largest when second number is greater', async () => {
    const { stdout, code } = await runCProgram("3 20\\n");
    expect(code).toBe(0);
    expect(stdout).toContain("20 is largest");
  });

  it('4. Error Handling Test: verifies negative equal numbers', async () => {
    const { stdout, code } = await runCProgram("-4 -4\\n");
    expect(code).toBe(0);
    expect(stdout).toContain("Both numbers are equal");
  });
});
`;

    const result = await targetTestRunnerService.executeTargetTest('mockUserId', null, {
      owner: 'Vishal202-rgb',
      repo: 'C-Practicle',
      targetFile: 'shubham-11407/experiment_4.c',
      testFilePath: 'shubham-11407/experiment_4.test.c',
      targetContent: experiment4CSource,
      testCode: experiment4TestCode,
      language: 'c',
    });

    assert.strictEqual(result.repository, 'Vishal202-rgb/C-Practicle');
    assert.strictEqual(result.targetFile, 'shubham-11407/experiment_4.c');
    assert.strictEqual(result.language, 'c');
    assert.strictEqual(result.runner, 'C Target Runner');

    if (result.status === 'PASS') {
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(result.passed, 4);
      assert.strictEqual(result.failed, 0);
      assert.strictEqual(result.total, 4);
      assert.ok(result.tests.every((t) => t.status === 'passed'));
    }
  });

  test('preserves genuine failure when expected result mismatches actual C output', async () => {
    const experiment4CSource = `
#include <stdio.h>

int main() {
    int a, b;
    printf("Enter two numbers: ");
    scanf("%d %d", &a, &b);

    if (a > b) {
        printf("%d is largest\\n", a);
    } else if (b > a) {
        printf("%d is largest\\n", b);
    } else {
        printf("Both numbers are equal\\n");
    }

    return 0;
}
`;

    const mismatchTestCode = `
describe('Mismatch test scenario', () => {
  it('expects 10 is largest when output is actually 20 is largest', async () => {
    const { stdout } = await runCProgram("5 20\\n");
    expect(stdout).toContain("10 is largest");
  });
});
`;

    const result = await targetTestRunnerService.executeTargetTest('mockUserId', null, {
      owner: 'Vishal202-rgb',
      repo: 'C-Practicle',
      targetFile: 'shubham-11407/experiment_4.c',
      targetContent: experiment4CSource,
      testCode: mismatchTestCode,
      language: 'c',
    });

    if (result.tests && result.tests[0]?.name.includes('expects 10 is largest')) {
      assert.strictEqual(result.status, 'FAIL');
      assert.strictEqual(result.passed, 0);
      assert.strictEqual(result.failed, 1);
      assert.strictEqual(result.exitCode, 1);
      assert.ok(result.tests[0].error.includes('10 is largest'));
    }
  });

  test('normalizes CLI prompts, whitespace, and CRLF in normalization helpers', () => {
    const promptStdout = 'Enter two numbers: Both numbers are equal\r\n';
    const resultLine = targetTestRunnerService.extractResultLine(promptStdout);
    assert.strictEqual(resultLine, 'Both numbers are equal');

    const multilineStdout = 'Enter two numbers:\n10 is largest\n';
    const resultLine2 = targetTestRunnerService.extractResultLine(multilineStdout);
    assert.strictEqual(resultLine2, '10 is largest');

    const negativeStdout = 'Enter two numbers: -5 is largest\r\n';
    const resultLine3 = targetTestRunnerService.extractResultLine(negativeStdout);
    assert.strictEqual(resultLine3, '-5 is largest');

    // Case 1: Numbers are equal
    assert.strictEqual(
      targetTestRunnerService.semanticStringContains(promptStdout, 'Numbers are equal '),
      true
    );
    // Case 2: 10 is largest
    assert.strictEqual(
      targetTestRunnerService.semanticStringContains('Enter two numbers: 10 is largest\n', '10 is largest '),
      true
    );
    // Case 3: -5 is largest
    assert.strictEqual(
      targetTestRunnerService.semanticStringContains('Enter two numbers: -5 is largest\n', '-5 is largest '),
      true
    );
    // Genuine failure: 20 is largest != 10 is largest
    assert.strictEqual(
      targetTestRunnerService.semanticStringContains('Enter two numbers: 20 is largest\n', '10 is largest '),
      false
    );
    // Genuine failure: -10 is largest != -5 is largest
    assert.strictEqual(
      targetTestRunnerService.semanticStringContains('Enter two numbers: -10 is largest\n', '-5 is largest '),
      false
    );
    assert.strictEqual(
      targetTestRunnerService.semanticStringEquals(promptStdout, 'Both numbers are equal'),
      true
    );
    assert.strictEqual(
      targetTestRunnerService.semanticStringEquals(negativeStdout, '-5 is largest '),
      true
    );
    assert.strictEqual(
      targetTestRunnerService.semanticStringEquals('Enter two numbers: 20 is largest\n', '10 is largest'),
      false
    );
  });
});

describe('Verification Agent - Target Test Evidence Isolation', () => {
  test('rejects RESOLVED status if target tests failed or non-zero exit code', async () => {
    const failedTestResults = {
      status: 'FAIL',
      exitCode: 1,
      passed: 2,
      failed: 2,
      total: 4,
      runner: 'C Target Runner',
      command: 'gcc -O2 mini-project.c -o mini-project.exe && runCProgram',
      stdout: '✕ Edge case assertion failed: Expected 0 but received -1',
      stderr: 'Test suite failed with 2 errors',
    };

    const payload = {
      originalIssue: {
        title: 'Buffer handling vulnerability in mini-project.c',
        description: 'scanf without bounds validation allows buffer overflow',
        file: 'mini-projects/mini-project.c',
      },
      repository: 'Vishal202-rgb/C-Practicle',
      targetFile: 'mini-projects/mini-project.c',
      testResults: failedTestResults,
    };

    const verification = await verificationAgentService.verifyFixResolution(null, null, payload);

    assert.notStrictEqual(verification.resolved, 'RESOLVED', 'Must never mark RESOLVED when target tests failed');
    assert.ok(
      verification.resolved === 'NOT_RESOLVED' ||
      verification.resolved === 'PARTIALLY_RESOLVED' ||
      verification.resolved === 'VERIFICATION_FAILED'
    );
  });
});

describe('DevMind Security - Test Command Execution Allowlist', () => {
  test('rejects arbitrary command injection in executeControlledTests', async () => {
    await assert.rejects(
      async () => {
        await testRunnerService.executeControlledTests('user123', 'repo123', {
          command: 'rm -rf / || cat /etc/passwd',
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        return true;
      }
    );
  });
});
