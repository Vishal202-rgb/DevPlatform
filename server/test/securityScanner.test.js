const { test, describe } = require('node:test');
const assert = require('node:assert');
const securityScannerService = require('../src/services/securityScannerService');

describe('Security Intelligence Agent - Deterministic Rule Verification', () => {
  test('detects exposed hardcoded API keys and secrets with high confidence and redaction', () => {
    const files = [
      {
        path: 'src/config/auth.js',
        content: `
          const GOOGLE_KEY = "AIzaSyD98234jksdf83948234892348234";
          const GITHUB_TOKEN = "ghp_123456789012345678901234567890123456";
          const OPENAI_KEY = "sk-1234567890abcdef1234567890abcdef";
          const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
        `,
      },
    ];

    const result = securityScannerService.scanFiles(files);
    assert.strictEqual(result.filesScanned, 1);
    assert.ok(result.rulesEvaluated > 0);
    assert.ok(result.findings.length >= 4, 'Should detect all 4 hardcoded credentials');

    for (const f of result.findings) {
      assert.strictEqual(f.category, 'secret-leak');
      assert.strictEqual(f.severity, 'critical');
      assert.ok(f.startLine > 0);
      assert.ok(f.filePath === 'src/config/auth.js');
      assert.ok(!f.evidence.includes('AIzaSyD98234jksdf83948234892348234'), 'Raw Google key must be redacted');
      assert.ok(!f.evidence.includes('ghp_123456789012345678901234567890123456'), 'Raw GitHub token must be redacted');
    }
  });

  test('detects private cryptographic keys in repository source code', () => {
    const files = [
      {
        path: 'certs/server.key',
        content: `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y3+...
-----END RSA PRIVATE KEY-----
        `,
      },
    ];

    const result = securityScannerService.scanFiles(files);
    assert.ok(result.findings.some((f) => f.ruleId === 'SEC-SECRET-PRIVKEY'));
    assert.ok(result.findings.some((f) => f.severity === 'critical'));
  });

  test('detects unsafe dynamic code execution: eval() and new Function() in JavaScript', () => {
    const files = [
      {
        path: 'src/helpers/calculator.js',
        content: `
          function computeExpression(userInput) {
            return eval(userInput);
          }
          const dynamicFn = new Function('a', 'b', 'return a + b');
        `,
      },
    ];

    const result = securityScannerService.scanFiles(files);
    const evalFinding = result.findings.find((f) => f.ruleId === 'SEC-INJECT-EVAL');
    const funcFinding = result.findings.find((f) => f.ruleId === 'SEC-INJECT-FUNCTION');

    assert.ok(evalFinding, 'Must detect eval() call');
    assert.strictEqual(evalFinding.severity, 'critical');
    assert.strictEqual(evalFinding.category, 'code-injection');
    assert.strictEqual(evalFinding.startLine, 3);
    assert.ok(evalFinding.evidence.includes('eval(userInput)'));

    assert.ok(funcFinding, 'Must detect new Function() constructor');
    assert.strictEqual(funcFinding.severity, 'high');
  });

  test('detects command injection risks: child_process.exec, os.system, and C system()', () => {
    const jsFiles = [
      {
        path: 'server/terminal.js',
        content: `
          const { exec } = require('child_process');
          function runCommand(userCmd) {
            exec("ping " + userCmd);
          }
        `,
      },
    ];

    const pyFiles = [
      {
        path: 'scripts/deploy.py',
        content: `
          import os
          def deploy(target):
              os.system("deploy.sh " + target)
        `,
      },
    ];

    const cFiles = [
      {
        path: 'native/launcher.c',
        content: `
          #include <stdlib.h>
          int main(int argc, char** argv) {
              system(argv[1]);
              return 0;
          }
        `,
      },
    ];

    const jsResult = securityScannerService.scanFiles(jsFiles);
    assert.ok(jsResult.findings.some((f) => f.ruleId === 'SEC-CMD-EXEC-JS'), 'Must detect JS child_process.exec');

    const pyResult = securityScannerService.scanFiles(pyFiles);
    assert.ok(pyResult.findings.some((f) => f.ruleId === 'SEC-CMD-SHELL'), 'Must detect Python os.system');

    const cResult = securityScannerService.scanFiles(cFiles);
    assert.ok(cResult.findings.some((f) => f.ruleId === 'SEC-CMD-SHELL'), 'Must detect C system() call');
  });

  test('detects SQL injection via string concatenation across multiple languages', () => {
    const files = [
      {
        path: 'src/db/userQuery.js',
        content: `
          function getUser(id) {
            const sql = "SELECT * FROM users WHERE id = " + id;
            return db.query(sql);
          }
        `,
      },
      {
        path: 'src/db/accountQuery.py',
        content: `
          def get_account(username):
              query = f"SELECT * FROM accounts WHERE name = '{username}'"
              return db.execute(query)
        `,
      },
    ];

    const result = securityScannerService.scanFiles(files);
    const sqlFindings = result.findings.filter((f) => f.category === 'sql-injection');
    assert.strictEqual(sqlFindings.length, 2, 'Should detect SQL string concatenation in both JS and Python');
    assert.strictEqual(sqlFindings[0].severity, 'high');
  });

  test('detects XSS vulnerabilities: dangerouslySetInnerHTML and innerHTML', () => {
    const files = [
      {
        path: 'src/components/UserPost.jsx',
        content: `
          export const UserPost = ({ rawHtml }) => {
            return <div dangerouslySetInnerHTML={{ __html: rawHtml }} />;
          };
        `,
      },
      {
        path: 'src/public/app.js',
        content: `
          function updateNotice(msg) {
            document.getElementById('notice').innerHTML = msg;
          }
        `,
      },
    ];

    const result = securityScannerService.scanFiles(files);
    assert.ok(result.findings.some((f) => f.ruleId === 'SEC-XSS-DANGEROUS-HTML'), 'Must detect dangerouslySetInnerHTML');
    assert.ok(result.findings.some((f) => f.ruleId === 'SEC-XSS-INNERHTML'), 'Must detect innerHTML assignment');
  });

  test('detects weak cryptography (MD5 / SHA1) in security-sensitive contexts', () => {
    const files = [
      {
        path: 'src/utils/hasher.js',
        content: `
          const crypto = require('crypto');
          function hashToken(token) {
            return crypto.createHash('md5').update(token).digest('hex');
          }
        `,
      },
    ];

    const result = securityScannerService.scanFiles(files);
    assert.ok(result.findings.some((f) => f.ruleId === 'SEC-CRYPTO-WEAK-HASH'), 'Must detect MD5 usage');
  });

  test('detects insecure CORS with wildcard origin and credentials', () => {
    const files = [
      {
        path: 'src/middleware/cors.js',
        content: `
          const cors = require('cors');
          app.use(cors({ origin: true, credentials: true }));
        `,
      },
    ];

    const result = securityScannerService.scanFiles(files);
    assert.ok(result.findings.some((f) => f.ruleId === 'SEC-CONFIG-INSECURE-CORS'));
  });

  test('detects C/C++ memory safety buffer overflow risks: strcpy, gets, sprintf', () => {
    const files = [
      {
        path: 'src/parser.c',
        content: `
          #include <string.h>
          #include <stdio.h>
          void parse(char* input) {
            char buffer[64];
            strcpy(buffer, input);
            gets(buffer);
            sprintf(buffer, "%s", input);
          }
        `,
      },
    ];

    const result = securityScannerService.scanFiles(files);
    const memoryFindings = result.findings.filter((f) => f.category === 'memory-safety');
    assert.strictEqual(memoryFindings.length, 3, 'Must detect strcpy, gets, and sprintf in C code');
    assert.strictEqual(memoryFindings[0].severity, 'high');
  });
});

describe('Security Intelligence Agent - Language Scoping & False Positive Prevention', () => {
  test('does NOT apply JavaScript-specific rules to C/C++ or Python source files', () => {
    const cCode = [
      {
        path: 'native/math.c',
        content: `
          int calculate() {
            int eval = 10;
            return eval * 2;
          }
        `,
      },
    ];

    const result = securityScannerService.scanFiles(cCode);
    assert.strictEqual(result.findings.length, 0, 'C variable named eval must not trigger JS eval vulnerability');
  });

  test('safe parameterized SQL queries do NOT trigger false positives', () => {
    const safeFiles = [
      {
        path: 'src/db/safeQueries.js',
        content: `
          const query = "SELECT * FROM users WHERE id = ?";
          db.execute(query, [userId]);
          const query2 = "SELECT id, email, created_at FROM accounts WHERE status = $1";
          db.query(query2, ['active']);
        `,
      },
    ];

    const result = securityScannerService.scanFiles(safeFiles);
    const sqlFindings = result.findings.filter((f) => f.category === 'sql-injection');
    assert.strictEqual(sqlFindings.length, 0, 'Parameterized queries must not produce SQL injection findings');
  });

  test('safe environment variable lookups do NOT trigger false positive secret leaks', () => {
    const safeConfig = [
      {
        path: 'src/config/env.js',
        content: `
          const apiKey = process.env.API_KEY;
          const jwtSecret = process.env.JWT_SECRET || 'development_placeholder';
          const dbPass = process.env.DB_PASSWORD;
        `,
      },
    ];

    const result = securityScannerService.scanFiles(safeConfig);
    const secretFindings = result.findings.filter((f) => f.category === 'secret-leak');
    assert.strictEqual(secretFindings.length, 0, 'process.env lookups must not be flagged as hardcoded secrets');
  });

  test('safe cryptographic algorithms (SHA-256) do NOT trigger weak crypto warnings', () => {
    const safeCrypto = [
      {
        path: 'src/utils/crypto.js',
        content: `
          const crypto = require('crypto');
          const hash = crypto.createHash('sha256').update(data).digest('hex');
          const hash512 = crypto.createHash('sha512').update(data).digest('hex');
        `,
      },
    ];

    const result = securityScannerService.scanFiles(safeCrypto);
    assert.strictEqual(result.findings.length, 0, 'SHA-256 and SHA-512 must not be flagged as weak cryptography');
  });
});

describe('Security Intelligence Agent - Dynamic Score Calculation', () => {
  test('clean repository legitimately receives 100/100 with accurate filesScanned metadata', () => {
    const cleanRepo = [
      {
        path: 'src/index.js',
        content: 'console.log("Hello Secure World");',
      },
      {
        path: 'src/math.js',
        content: 'export const add = (a, b) => a + b;',
      },
    ];

    const result = securityScannerService.scanFiles(cleanRepo);
    assert.strictEqual(result.findings.length, 0);
    assert.strictEqual(result.securityScore, 100);
    assert.strictEqual(result.filesScanned, 2);
    assert.ok(result.rulesEvaluated > 0);
  });

  test('vulnerable repository dynamically reduces score proportional to finding severities', () => {
    const vulnerableRepo = [
      {
        path: 'src/auth.js',
        content: `
          const token = "ghp_123456789012345678901234567890123456"; // Critical (-25)
          const sql = "SELECT * FROM users WHERE name = " + user; // High (-12)
          element.innerHTML = userBio; // Medium (-5)
        `,
      },
    ];

    const result = securityScannerService.scanFiles(vulnerableRepo);
    assert.ok(result.findings.length >= 3);
    assert.ok(result.securityScore < 100, 'Security score must be below 100 for vulnerable codebase');
    assert.ok(result.securityScore <= 60, `Score (${result.securityScore}) must reflect critical + high + medium deductions`);
  });
});

describe('Security Intelligence Agent - Repository Test (Vishal202-rgb/C-Practicle)', () => {
  test('scans C-Practicle repository source files without inventing false positives', () => {
    // Standard academic C programming exercises (bubble sort, binary search, matrix multiplication, factorial)
    const cPracticleFiles = [
      {
        path: 'bubble_sort.c',
        content: `
          #include <stdio.h>
          void bubbleSort(int arr[], int n) {
              for (int i = 0; i < n - 1; i++) {
                  for (int j = 0; j < n - i - 1; j++) {
                      if (arr[j] > arr[j + 1]) {
                          int temp = arr[j];
                          arr[j] = arr[j + 1];
                          arr[j + 1] = temp;
                      }
                  }
              }
          }
          int main() {
              int arr[] = {64, 34, 25, 12, 22, 11, 90};
              int n = sizeof(arr)/sizeof(arr[0]);
              bubbleSort(arr, n);
              printf("Sorted array: \\n");
              return 0;
          }
        `,
      },
      {
        path: 'matrix_multiplication.c',
        content: `
          #include <stdio.h>
          int main() {
              int a[10][10], b[10][10], mult[10][10], r1, c1, r2, c2;
              printf("Enter rows and columns: ");
              return 0;
          }
        `,
      },
      {
        path: 'factorial.c',
        content: `
          #include <stdio.h>
          long long factorial(int n) {
              if (n == 0 || n == 1) return 1;
              return n * factorial(n - 1);
          }
        `,
      },
    ];

    const result = securityScannerService.scanFiles(cPracticleFiles, { repoName: 'Vishal202-rgb/C-Practicle' });

    assert.strictEqual(result.filesScanned, 3, 'Scans all 3 C source files');
    assert.deepStrictEqual(result.languagesDetected, ['c_cpp'], 'Detects C/C++ language');
    assert.ok(result.rulesEvaluated > 0, 'Evaluates applicable security rules');
    assert.strictEqual(result.findings.length, 0, 'Clean C practicals code should yield 0 findings');
    assert.strictEqual(result.securityScore, 100, 'Score is 100/100 because code is clean');
  });
});
