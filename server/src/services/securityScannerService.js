const path = require('path');
const geminiService = require('./geminiService');
const { isAnalyzablePath } = require('../utils/fileFilters');

// ============================================================================
// 1. Strict Secret Redaction Utility
// ============================================================================
const redactSecrets = (text) => {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/(?:api[_-]?key|secret|jwt[_-]?secret|auth[_-]?token|access[_-]?token|private[_-]?key|password|passwd|db[_-]?pass)\s*[:=]\s*['"]?([a-zA-Z0-9_\-\.\/+=]{8,})['"]?/gi, (match, secret) => {
      // Retain placeholder keywords without masking if obviously a dummy placeholder
      if (/^(?:process\.env|os\.environ|System\.getenv|config|placeholder|dummy|test|example|change_me|undefined|null|true|false)$/i.test(secret)) {
        return match;
      }
      return match.replace(secret, '********');
    })
    .replace(/AIza[a-zA-Z0-9_\-]{20,40}/g, 'AIza***********************************')
    .replace(/ghp_[a-zA-Z0-9]{20,}/g, 'ghp_************************************')
    .replace(/github_pat_[a-zA-Z0-9_]{30,}/g, 'github_pat_********************************')
    .replace(/sk-[a-zA-Z0-9]{15,}/g, 'sk-********')
    .replace(/sk_live_[0-9a-zA-Z]{15,}/g, 'sk_live_********')
    .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA****************')
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, 'Bearer ********')
    .replace(/-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g, '-----BEGIN PRIVATE KEY-----\n[REDACTED_PRIVATE_KEY]\n-----END PRIVATE KEY-----');
};

// ============================================================================
// 2. Language Detection
// ============================================================================
const detectLanguage = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return 'other';
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.py':
      return 'python';
    case '.java':
      return 'java';
    case '.c':
    case '.cc':
    case '.cpp':
    case '.cxx':
    case '.h':
    case '.hpp':
      return 'c_cpp';
    case '.go':
      return 'go';
    case '.php':
      return 'php';
    case '.rb':
      return 'ruby';
    case '.html':
    case '.vue':
    case '.svelte':
      return 'html';
    case '.json':
      return 'json';
    case '.yml':
    case '.yaml':
      return 'yaml';
    case '.sh':
    case '.bash':
      return 'shell';
    default:
      return 'other';
  }
};

const JS_FAMILY = ['javascript', 'typescript', 'html'];
const C_FAMILY = ['c_cpp'];
const ALL_LANGUAGES = ['*'];

// ============================================================================
// 3. Deterministic Security Rules Matrix
// ============================================================================
const SECURITY_RULES = [
  // --- 1. Hardcoded API Keys & Tokens (Universal) ---
  {
    id: 'SEC-SECRET-APIKEY',
    title: 'Exposed Hardcoded API Key or Token',
    category: 'secret-leak',
    severity: 'critical',
    languages: ALL_LANGUAGES,
    confidence: 0.98,
    match: (line) => {
      if (/AIza[0-9A-Za-z_-]{20,40}/.test(line)) return true;
      if (/ghp_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{30,}/.test(line)) return true;
      if (/sk-[a-zA-Z0-9]{15,}|sk_live_[0-9a-zA-Z]{15,}/.test(line)) return true;
      if (/AKIA[0-9A-Z]{16}/.test(line)) return true;
      if (/(?:api_key|apikey|secret_key|auth_token|access_token)\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{12,}['"]/i.test(line)) {
        if (/your[_-]?api[_-]?key|dummy|placeholder|example|xxxxxx|<[^>]+>/i.test(line)) return false;
        return true;
      }
      return false;
    },
    explanation: 'Detected an exposed hardcoded API key or access token directly in source code. Credentials committed to version control can be harvested and exploited.',
    recommendation: 'Store credentials in environment variables or a secure secret management vault (e.g., .env or AWS Secrets Manager). Never commit raw API keys.',
  },

  // --- 2. Hardcoded Passwords (Universal) ---
  {
    id: 'SEC-SECRET-PASSWORD',
    title: 'Hardcoded Password in Source Code',
    category: 'secret-leak',
    severity: 'high',
    languages: ALL_LANGUAGES,
    confidence: 0.95,
    match: (line) => {
      if (/(?:password|passwd|db_pass|user_password|admin_pass)\s*[:=]\s*['"][^'"\s]{6,}['"]/i.test(line)) {
        if (/process\.env|os\.environ|System\.getenv|dummy|test|password123|change_me|example|placeholder/i.test(line)) {
          return false;
        }
        return true;
      }
      return false;
    },
    explanation: 'A plaintext password appears to be hardcoded in the source file. Anyone with repository access can obtain these credentials.',
    recommendation: 'Load sensitive passwords from environment variables or secure key vaults at runtime.',
  },

  // --- 3. Private Keys in Source Code (Universal) ---
  {
    id: 'SEC-SECRET-PRIVKEY',
    title: 'Private Key Header in Source Code',
    category: 'secret-leak',
    severity: 'critical',
    languages: ALL_LANGUAGES,
    confidence: 0.99,
    match: (line) => /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/.test(line),
    explanation: 'An asymmetric private cryptographic key was found committed inside the repository source code.',
    recommendation: 'Revoke and rotate the exposed private key immediately. Store private keys in a secure secret manager or encrypted store outside the repository.',
  },

  // --- 4. Unsafe eval() Usage (JS/TS, Python, PHP, Ruby) ---
  {
    id: 'SEC-INJECT-EVAL',
    title: 'Unsafe Dynamic Code Execution (eval)',
    category: 'code-injection',
    severity: 'critical',
    languages: ['javascript', 'typescript', 'python', 'php', 'ruby'],
    confidence: 0.96,
    match: (line) => {
      if (/^\s*(?:\/\/|\/\*|\*|#)/.test(line)) return false;
      return /\beval\s*\([^)]+\)/.test(line);
    },
    explanation: 'Using eval() to execute arbitrary code or user-controllable input enables Remote Code Execution (RCE) and full application compromise.',
    recommendation: 'Refactor code to avoid eval(). Use structured JSON parsers (JSON.parse), safe lookup tables, or dedicated expression evaluators.',
  },

  // --- 5. Function Constructor Code Injection (JS/TS) ---
  {
    id: 'SEC-INJECT-FUNCTION',
    title: 'Dynamic Function Constructor Code Execution',
    category: 'code-injection',
    severity: 'high',
    languages: ['javascript', 'typescript'],
    confidence: 0.94,
    match: (line) => {
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return false;
      return /\bnew\s+Function\s*\([^)]*\)/.test(line) || /(?<![a-zA-Z0-9_.])Function\s*\(\s*['"][^'"]*['"]\s*,\s*['"][^'"]*['"]\s*\)/.test(line);
    },
    explanation: 'Instantiating functions with the Function constructor (new Function) compiles dynamic string code at runtime, similar to eval().',
    recommendation: 'Replace dynamic Function constructor calls with static function definitions or safe parsing logic.',
  },

  // --- 6. child_process.exec Command Execution (JS/TS) ---
  {
    id: 'SEC-CMD-EXEC-JS',
    title: 'Unsafe Shell Command Execution (child_process.exec)',
    category: 'command-injection',
    severity: 'critical',
    languages: ['javascript', 'typescript'],
    confidence: 0.95,
    match: (line) => {
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return false;
      return /(?:child_process\s*\.\s*(?:exec|execSync)|require\(['"]child_process['"]\)\.(?:exec|execSync)|\bexec\s*\(|\bexecSync\s*\()/.test(line);
    },
    explanation: 'child_process.exec spawns a shell to execute commands. If arguments contain unsanitized input, attackers can inject arbitrary shell commands.',
    recommendation: 'Use child_process.execFile or child_process.spawn with an array of arguments rather than a concatenated shell string.',
  },

  // --- 7. Shell Command Execution (Python, Java, PHP, C/C++) ---
  {
    id: 'SEC-CMD-SHELL',
    title: 'Unsafe System Command Invocation',
    category: 'command-injection',
    severity: 'critical',
    languages: ['python', 'java', 'php', 'c_cpp', 'go'],
    confidence: 0.95,
    match: (line, _content, lang) => {
      if (/^\s*(?:\/\/|\/\*|\*|#)/.test(line)) return false;
      if (lang === 'python') {
        return /os\.system\s*\(/.test(line) || /subprocess\.(?:Popen|call|run|check_output)\s*\([^)]*shell\s*=\s*True/i.test(line);
      }
      if (lang === 'java') {
        return /Runtime\.getRuntime\(\)\.exec\s*\(/.test(line) || /new\s+ProcessBuilder\s*\(/.test(line);
      }
      if (lang === 'php') {
        return /(?:shell_exec|passthru|exec|system|popen)\s*\(/.test(line);
      }
      if (lang === 'c_cpp') {
        return /\bsystem\s*\([^)]+\)/.test(line);
      }
      return false;
    },
    explanation: 'Directly invoking shell commands or system utilities risks Command Injection if any arguments derive from untrusted input.',
    recommendation: 'Avoid shell execution where possible. When needed, pass arguments as strict arrays without shell interpolation (shell=False).',
  },

  // --- 8. SQL String Concatenation (JS/TS, Python, Java, C/C++, PHP, Go) ---
  {
    id: 'SEC-INJECT-SQL',
    title: 'SQL Query String Concatenation',
    category: 'sql-injection',
    severity: 'high',
    languages: ['javascript', 'typescript', 'python', 'java', 'c_cpp', 'php', 'go'],
    confidence: 0.94,
    match: (line, _content, lang) => {
      if (/^\s*(?:\/\/|\/\*|\*|#)/.test(line)) return false;

      const hasSqlKeyword = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP\s+TABLE|WHERE)\b/i.test(line);
      if (!hasSqlKeyword) return false;

      if (lang === 'javascript' || lang === 'typescript') {
        // String concatenation with + : e.g. "SELECT ... " + id
        if (/\+\s*[a-zA-Z0-9_.$]+/.test(line) && /["']/.test(line)) {
          return true;
        }
        // Template literal interpolation: `${var}` inside SQL statement
        if (/`[^`]*\$\{[a-zA-Z0-9_.$]+\}[^`]*`/.test(line) || (line.includes('`') && /\$\{[a-zA-Z0-9_.$]+\}/.test(line))) {
          return true;
        }
      }

      if (lang === 'python') {
        // f-string: f"SELECT ... {var}" or % formatting or + concatenation
        if (/f["'].*?\{[a-zA-Z0-9_.]+\}/.test(line)) return true;
        if (/["'].*?%\s*[a-zA-Z0-9_.]+/.test(line)) return true;
        if (/\+\s*[a-zA-Z0-9_.]+/.test(line) && /["']/.test(line)) return true;
      }

      if (lang === 'java' || lang === 'c_cpp' || lang === 'php' || lang === 'go') {
        if (/\+\s*[a-zA-Z0-9_.]+/.test(line) && /["']/.test(line)) {
          return true;
        }
      }

      return false;
    },
    explanation: 'Constructing SQL queries via string concatenation or interpolation allows attackers to manipulate query logic via SQL Injection.',
    recommendation: 'Use parameterized queries / prepared statements (e.g., query("SELECT * FROM users WHERE id = ?", [id])) or an ORM.',
  },

  // --- 9. React dangerouslySetInnerHTML (JS/TS/HTML) ---
  {
    id: 'SEC-XSS-DANGEROUS-HTML',
    title: 'Unsafe dangerouslySetInnerHTML Usage',
    category: 'xss',
    severity: 'high',
    languages: JS_FAMILY,
    confidence: 0.95,
    match: (line) => {
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return false;
      return /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:/.test(line);
    },
    explanation: 'dangerouslySetInnerHTML bypasses React\'s built-in XSS protections. Rendering untrusted HTML exposes the application to Cross-Site Scripting (XSS).',
    recommendation: 'Sanitize HTML content using DOMPurify before rendering, or use standard React text interpolation.',
  },

  // --- 10. DOM innerHTML / outerHTML Assignment (JS/TS/HTML) ---
  {
    id: 'SEC-XSS-INNERHTML',
    title: 'Unsafe innerHTML / outerHTML Assignment',
    category: 'xss',
    severity: 'medium',
    languages: JS_FAMILY,
    confidence: 0.92,
    match: (line) => {
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return false;
      return /\.(?:innerHTML|outerHTML)\s*=\s*(?![`'"](?:<[a-z0-9]+>)?\s*[`'"]\s*;)/i.test(line) || /document\.write(?:ln)?\s*\(/.test(line);
    },
    explanation: 'Direct assignment to element.innerHTML or document.write can introduce DOM-based Cross-Site Scripting vulnerabilities if the content includes user input.',
    recommendation: 'Use element.textContent, element.innerText, or sanitize markup with DOMPurify before setting innerHTML.',
  },

  // --- 11. Unsafe URL / Open Redirect / javascript: protocol ---
  {
    id: 'SEC-URL-OPEN-REDIRECT',
    title: 'Unsafe URL Construction / Open Redirect Risk',
    category: 'open-redirect',
    severity: 'medium',
    languages: JS_FAMILY,
    confidence: 0.90,
    match: (line) => {
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return false;
      if (/href\s*=\s*['"]javascript:\s*/i.test(line)) return true;
      if (/(?:window\.)?location(?:\.href)?\s*=\s*(?:req\.|params\.|query\.|userInput|location\.search)/.test(line)) return true;
      return false;
    },
    explanation: 'Directly navigating to untrusted URLs or executing javascript: pseudo-protocols can allow open redirects or script injection.',
    recommendation: 'Validate and allowlist redirect destinations against trusted internal domains before setting window.location.',
  },

  // --- 12. Path Traversal Patterns (JS/TS, Python) ---
  {
    id: 'SEC-FILE-PATH-TRAVERSAL',
    title: 'Potential Path Traversal File Access',
    category: 'path-traversal',
    severity: 'high',
    languages: ['javascript', 'typescript', 'python'],
    confidence: 0.91,
    match: (line, _content, lang) => {
      if (/^\s*(?:\/\/|\/\*|\*|#)/.test(line)) return false;
      if (lang === 'javascript' || lang === 'typescript') {
        return /(?:fs\.(?:readFile|readFileSync|createReadStream|unlink|writeFile)|path\.join)\s*\([^)]*(?:req\.(?:params|query|body)|userInput)/.test(line);
      }
      if (lang === 'python') {
        return /(?:open|os\.path\.join)\s*\([^)]*(?:request\.(?:args|form|values)|userInput)/.test(line);
      }
      return false;
    },
    explanation: 'Accessing filesystem paths constructed from untrusted parameters without normalization allows path traversal (e.g. ../../etc/passwd).',
    recommendation: 'Sanitize file paths using path.normalize() and verify that the target path resolves within an allowed base directory.',
  },

  // --- 13. Insecure Plain HTTP URL for Sensitive Endpoints (Universal) ---
  {
    id: 'SEC-TRANSPORT-HTTP-SENSITIVE',
    title: 'Insecure Plaintext HTTP for Sensitive Endpoint',
    category: 'insecure-transport',
    severity: 'medium',
    languages: ALL_LANGUAGES,
    confidence: 0.88,
    match: (line) => {
      if (/^\s*(?:\/\/|\/\*|\*|#)/.test(line)) return false;
      // Exclude localhost / dev servers / schema definitions
      if (/localhost|127\.0\.0\.1|0\.0\.0\.0|schemas\.xmlsoap\.org|www\.w3\.org|example\.com/i.test(line)) return false;
      return /http:\/\/(?:api\.|auth\.|login\.|oauth\.|token\.|payment|checkout)[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}/i.test(line);
    },
    explanation: 'Using unencrypted HTTP for sensitive authentication, payment, or API endpoints exposes credentials and data to Man-In-The-Middle (MITM) interception.',
    recommendation: 'Enforce HTTPS (TLS/SSL) for all network communication with external APIs and services.',
  },

  // --- 14. Weak Cryptographic Algorithms (JS/TS, Python, Java, C/C++) ---
  {
    id: 'SEC-CRYPTO-WEAK-HASH',
    title: 'Use of Weak Cryptographic Algorithm (MD5 / SHA1 / DES / RC4)',
    category: 'weak-cryptography',
    severity: 'medium',
    languages: ['javascript', 'typescript', 'python', 'java', 'c_cpp'],
    confidence: 0.95,
    match: (line, _content, lang) => {
      if (/^\s*(?:\/\/|\/\*|\*|#)/.test(line)) return false;
      if (lang === 'javascript' || lang === 'typescript') {
        return /crypto\.createHash\s*\(\s*['"](?:md5|sha1|des|rc4)['"]\s*\)/i.test(line) || /CryptoJS\.(?:MD5|SHA1|DES|RC4)/i.test(line);
      }
      if (lang === 'python') {
        return /hashlib\.(?:md5|sha1)\s*\(/.test(line) || /Crypto\.Cipher\.(?:DES|ARC4)/.test(line);
      }
      if (lang === 'java') {
        return /MessageDigest\.getInstance\s*\(\s*['"](?:MD5|SHA-1|DES)['"]\s*\)/i.test(line);
      }
      return false;
    },
    explanation: 'Legacy algorithms like MD5, SHA-1, DES, and RC4 are cryptographically broken and vulnerable to collision and decryption attacks.',
    recommendation: 'Upgrade to modern secure cryptographic primitives: SHA-256/SHA-512 for hashing and AES-256-GCM for symmetric encryption.',
  },

  // --- 15. Insecure CORS Configuration (JS/TS, Python, Java) ---
  {
    id: 'SEC-CONFIG-INSECURE-CORS',
    title: 'Insecure Permissive CORS Configuration',
    category: 'insecure-cors',
    severity: 'high',
    languages: ['javascript', 'typescript', 'python', 'java'],
    confidence: 0.94,
    match: (line) => {
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return false;
      return /cors\s*\(\s*\{[^}]*origin\s*:\s*(?:true|['"]\*['"])[^}]*credentials\s*:\s*true/i.test(line) ||
             /Access-Control-Allow-Origin['"]\s*,\s*['"]\*['"].*Access-Control-Allow-Credentials['"]\s*,\s*['"]true['"]/i.test(line);
    },
    explanation: 'Wildcard CORS origins combined with credentials (cookies/auth headers) allow arbitrary third-party websites to make authenticated cross-origin requests.',
    recommendation: 'Explicitly specify trusted origin domains instead of wildcard true/* when enabling credentials.',
  },

  // --- 16. Disabled Authentication / Security Bypass Checks (Universal) ---
  {
    id: 'SEC-AUTH-BYPASS-FLAG',
    title: 'Disabled Authentication or Security Bypass Flag',
    category: 'auth-bypass',
    severity: 'high',
    languages: ALL_LANGUAGES,
    confidence: 0.93,
    match: (line) => {
      return /(?:skipAuth|authDisabled|disableAuth|bypassAuth|allowAnonymous)\s*[:=]\s*true\b/i.test(line) ||
             /\bauthenticate\s*=\s*false\b/i.test(line);
    },
    explanation: 'Detected an explicit flag or configuration disabling authentication or bypassing security guards.',
    recommendation: 'Ensure authentication and authorization middleware is strictly enabled in production environments.',
  },

  // --- 17. C/C++ Memory Safety / Dangerous Buffer Functions (C/C++) ---
  {
    id: 'SEC-C-MEMORY-UNSAFE-FN',
    title: 'Unsafe C/C++ Buffer Manipulation Function',
    category: 'memory-safety',
    severity: 'high',
    languages: C_FAMILY,
    confidence: 0.97,
    match: (line) => {
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return false;
      return /\b(?:strcpy|strcat|gets|sprintf)\s*\(/.test(line);
    },
    explanation: 'Functions such as strcpy(), strcat(), gets(), and sprintf() do not perform boundary checks on destination buffers, leading to Buffer Overflows.',
    recommendation: 'Replace unsafe C functions with bounded alternatives: strncpy(), strncat(), fgets(), snprintf(), or C++ std::string.',
  },
];

// ============================================================================
// 4. Dynamic Security Score Calculator
// ============================================================================
const computeSecurityScore = (findings) => {
  if (!Array.isArray(findings) || findings.length === 0) {
    return 100;
  }

  const SEVERITY_DEDUCTIONS = {
    critical: 25,
    high: 12,
    medium: 5,
    low: 2,
    info: 0,
  };

  const totalDeduction = findings.reduce((acc, f) => {
    const sev = (f.severity || 'medium').toLowerCase();
    return acc + (SEVERITY_DEDUCTIONS[sev] || 5);
  }, 0);

  return Math.max(10, Math.min(100, Math.round(100 - totalDeduction)));
};

// ============================================================================
// 5. Core Deterministic File Scanner
// ============================================================================
class SecurityScannerService {
  /**
   * Scan an array of source files with deterministic language-aware security rules.
   *
   * @param {Array<{path: string, content: string}>} files
   * @param {Object} options
   * @returns {Object} Scan results with findings, metrics, and score
   */
  scanFiles(files = [], options = {}) {
    const startTime = Date.now();
    const analyzableFiles = files.filter((f) => f && f.path && isAnalyzablePath(f.path));
    const skippedCount = files.length - analyzableFiles.length;

    const detectedLanguages = new Set();
    const findings = [];
    let totalRulesEvaluated = 0;

    for (const file of analyzableFiles) {
      const filePath = file.path.replace(/\\/g, '/');
      const content = file.content || '';
      const language = detectLanguage(filePath);
      detectedLanguages.add(language);

      const lines = content.split(/\r?\n/);

      // Filter rules applicable to this language
      const applicableRules = SECURITY_RULES.filter((rule) => {
        return (
          rule.languages.includes('*') ||
          rule.languages.includes(language)
        );
      });

      totalRulesEvaluated += applicableRules.length;

      // Scan line-by-line
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        const lineNum = lineIdx + 1;

        for (const rule of applicableRules) {
          try {
            const isMatch = rule.match(line, content, language);
            if (isMatch) {
              const rawEvidence = line.trim();
              const redactedEvidence = redactSecrets(rawEvidence);

              findings.push({
                ruleId: rule.id,
                agent: 'security',
                title: rule.title,
                category: rule.category,
                severity: rule.severity,
                filePath,
                startLine: lineNum,
                endLine: lineNum,
                lineNumber: lineNum,
                evidence: redactedEvidence,
                explanation: rule.explanation,
                recommendation: rule.recommendation,
                confidence: rule.confidence,
                suggestedFix: '',
              });
            }
          } catch (_err) {
            // Guard individual rule evaluation errors
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const securityScore = computeSecurityScore(findings);

    // Summary counts
    const summary = {
      total: findings.length,
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
      filesScanned: analyzableFiles.length,
      rulesEvaluated: totalRulesEvaluated,
    };

    // Internal debug log without exposing raw code or secrets
    if (options.repoName) {
      // eslint-disable-next-line no-console
      console.log(
        `[SecurityScanner] Scanned repo: ${options.repoName} | Files: ${analyzableFiles.length} | Skipped: ${skippedCount} | Rules: ${totalRulesEvaluated} | Findings: ${findings.length} | Score: ${securityScore} | Duration: ${durationMs}ms`
      );
    }

    return {
      filesScanned: analyzableFiles.length,
      supportedFiles: analyzableFiles.map((f) => f.path),
      skippedFiles: skippedCount,
      languagesDetected: Array.from(detectedLanguages),
      rulesEvaluated: totalRulesEvaluated,
      findings,
      summary,
      securityScore,
      durationMs,
    };
  }

  /**
   * AI-Assisted Security Review with Gemini
   * Refines findings, reduces false positives, and provides contextual explanations.
   */
  async reviewFindingsWithAI(findings = [], filesMap = new Map()) {
    if (!findings.length) return findings;

    // Send up to 10 findings to avoid exceeding token limits
    const findingsToReview = findings.slice(0, 10);

    const findingsContext = findingsToReview.map((f, index) => {
      const fileContent = filesMap.get(f.filePath) || '';
      const lines = fileContent.split(/\r?\n/);
      const start = Math.max(0, (f.startLine || 1) - 4);
      const end = Math.min(lines.length, (f.startLine || 1) + 4);
      const snippet = lines.slice(start, end).join('\n');

      return `Finding #${index + 1}:
Title: ${f.title}
File: ${f.filePath} (Line: ${f.startLine})
Category: ${f.category}
Reported Severity: ${f.severity}
Evidence: ${f.evidence}
Surrounding Code:
${snippet}
---`;
    }).join('\n\n');

    const prompt = `You are the Lead Security Architect reviewing deterministic static analysis findings.
For each finding below:
1. Validate if it is a genuine security vulnerability or a safe construct / test mock (reduce false positives).
2. If genuine, explain the real-world attack impact and provide tailored remediation.
3. If not verifiable with high certainty, set confidence to 0.4 or lower.
4. Strictly do NOT invent non-existent file paths or imaginary code.

Findings to review:
${findingsContext}`;

    try {
      const { response } = await geminiService.callGeminiWithRetryAndFallback(
        () => ({
          systemInstruction: {
            role: 'system',
            parts: [
              {
                text: 'You are an elite application security engineer. Refine deterministic security findings. Output strictly valid JSON matching the schema.',
              },
            ],
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 3000,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                reviews: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      findingIndex: { type: 'INTEGER', description: '1-indexed finding number' },
                      isValid: { type: 'BOOLEAN' },
                      adjustedSeverity: { type: 'STRING', enum: ['critical', 'high', 'medium', 'low', 'info'] },
                      explanation: { type: 'STRING' },
                      recommendation: { type: 'STRING' },
                      confidence: { type: 'NUMBER' },
                    },
                    required: ['findingIndex', 'isValid', 'adjustedSeverity', 'explanation', 'recommendation', 'confidence'],
                  },
                },
              },
              required: ['reviews'],
            },
          },
        })
      );

      const candidate = response.data?.candidates?.[0];
      const rawText = candidate?.content?.parts?.map((p) => p.text).join('') || '';
      if (!rawText.trim()) return findings;

      const parsed = JSON.parse(rawText);
      const reviews = Array.isArray(parsed.reviews) ? parsed.reviews : [];

      // Merge AI reviews back into deterministic findings
      return findings.map((f, i) => {
        const review = reviews.find((r) => r.findingIndex === i + 1);
        if (!review) return f;

        // If AI confirmed false positive with low validity, reduce confidence
        if (!review.isValid) {
          return {
            ...f,
            confidence: Math.min(f.confidence || 0.5, 0.3),
            explanation: `[AI Note: Potential false positive] ${review.explanation || f.explanation}`,
          };
        }

        return {
          ...f,
          severity: review.adjustedSeverity || f.severity,
          explanation: redactSecrets(review.explanation || f.explanation),
          recommendation: redactSecrets(review.recommendation || f.recommendation),
          confidence: typeof review.confidence === 'number' ? review.confidence : f.confidence,
        };
      });
    } catch (_err) {
      // Graceful fallback to deterministic findings on any AI error/timeout
      return findings;
    }
  }
}

const scannerInstance = new SecurityScannerService();
scannerInstance.redactSecrets = redactSecrets;
scannerInstance.detectLanguage = detectLanguage;
scannerInstance.SECURITY_RULES = SECURITY_RULES;
scannerInstance.computeSecurityScore = computeSecurityScore;

module.exports = scannerInstance;
