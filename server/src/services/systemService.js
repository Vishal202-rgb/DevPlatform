const mongoose = require('mongoose');
const env = require('../config/env');

// Models Google has deprecated/restricted for new users - warn instead of
// silently letting Gemini calls fail with a confusing 400 later.
const KNOWN_DEPRECATED_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

const PLACEHOLDER_JWT_SECRETS = ['replace_with_a_long_random_secret', 'your_jwt_secret', 'secret'];

const check = (id, label, status, message, hint) => ({ id, label, status, message, hint: hint || null });

/**
 * Show only the host portion of a MongoDB connection string - never the
 * username/password, even in an authenticated-only diagnostics page.
 */
const maskMongoUri = (uri) => {
  if (!uri) return null;
  try {
    const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//, '');
    const afterAt = withoutProtocol.includes('@') ? withoutProtocol.split('@')[1] : withoutProtocol;
    return afterAt.split('/')[0].split('?')[0];
  } catch (err) {
    return '(unable to parse)';
  }
};

const getUrlHost = (value) => {
  try {
    return new URL(value).host.toLowerCase();
  } catch (err) {
    return null;
  }
};

/**
 * Run a set of lightweight, read-only checks aimed at the class of
 * deployment misconfigurations that don't crash the server outright but
 * cause confusing runtime failures - mismatched callback URLs, wrong
 * frontend origin, deprecated model names, weak secrets, etc.
 *
 * This intentionally can't catch failures that prevent the server from
 * booting at all (e.g. a completely unreachable MONGO_URI) - if this page
 * loaded at all, the app already started successfully.
 */
const runHealthChecks = (req) => {
  const checks = [];

  // --- Required environment variables present at all ---
  const requiredVars = [
    ['MONGO_URI', env.mongoUri],
    ['JWT_SECRET', env.jwtSecret],
    ['GITHUB_CLIENT_ID', env.githubClientId],
    ['GITHUB_CLIENT_SECRET', env.githubClientSecret],
    ['GITHUB_CALLBACK_URL', env.githubCallbackUrl],
    ['CLIENT_URL', env.clientUrl],
    ['GEMINI_API_KEY', env.geminiApiKey],
  ];
  for (const [name, value] of requiredVars) {
    checks.push(
      value
        ? check(`env_${name}`, name, 'ok', 'Set')
        : check(
            `env_${name}`,
            name,
            'error',
            'Missing from environment variables',
            `Add ${name} in your hosting provider's environment variable settings, then redeploy.`
          )
    );
  }

  // --- JWT_SECRET strength ---
  if (env.jwtSecret) {
    const isPlaceholder = PLACEHOLDER_JWT_SECRETS.includes(env.jwtSecret.trim());
    const tooShort = env.jwtSecret.length < 32;
    if (isPlaceholder) {
      checks.push(
        check(
          'jwt_secret_strength',
          'JWT_SECRET strength',
          'error',
          'Still set to a placeholder value',
          'Generate a real secret: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        )
      );
    } else if (tooShort) {
      checks.push(
        check(
          'jwt_secret_strength',
          'JWT_SECRET strength',
          'warning',
          `Only ${env.jwtSecret.length} characters - recommend 32+`,
          'Generate a longer secret for production use.'
        )
      );
    } else {
      checks.push(check('jwt_secret_strength', 'JWT_SECRET strength', 'ok', 'Looks sufficiently long and random'));
    }
  }

  // --- GITHUB_CALLBACK_URL shape + host match ---
  if (env.githubCallbackUrl) {
    const trimmed = env.githubCallbackUrl.trim();

    if (/\/$/.test(trimmed)) {
      checks.push(
        check(
          'github_callback_trailing_slash',
          'GITHUB_CALLBACK_URL trailing slash',
          'error',
          `"${trimmed}" ends with a "/" - GitHub matches this exactly and will reject it`,
          'Remove the trailing slash so it ends exactly in "/api/github/callback".'
        )
      );
    } else if (!trimmed.endsWith('/api/github/callback')) {
      checks.push(
        check(
          'github_callback_path',
          'GITHUB_CALLBACK_URL path',
          'warning',
          `Doesn't end in "/api/github/callback" (got "${trimmed}")`,
          'Double check this matches the route mounted in server/src/routes/githubRoutes.js.'
        )
      );
    } else {
      checks.push(check('github_callback_path', 'GITHUB_CALLBACK_URL path', 'ok', 'Ends correctly in /api/github/callback'));
    }

    const configuredHost = getUrlHost(trimmed);
    const requestHost = req.get('host');
    if (configuredHost && requestHost && configuredHost !== requestHost.toLowerCase()) {
      checks.push(
        check(
          'github_callback_host_match',
          'GITHUB_CALLBACK_URL host match',
          'error',
          `Configured for "${configuredHost}" but this request arrived on "${requestHost}"`,
          "Update GITHUB_CALLBACK_URL (and the GitHub OAuth App's Authorization callback URL) to match your actual deployed domain, then redeploy."
        )
      );
    } else if (configuredHost && requestHost) {
      checks.push(
        check('github_callback_host_match', 'GITHUB_CALLBACK_URL host match', 'ok', `Matches this deployment's host (${requestHost})`)
      );
    }
  }

  // --- CLIENT_URL matches the frontend's actual origin (sent by the client) ---
  const frontendOrigin = typeof req.query.frontendOrigin === 'string' ? req.query.frontendOrigin.trim() : null;
  if (env.clientUrl && frontendOrigin) {
    const configuredHost = getUrlHost(env.clientUrl);
    const actualHost = getUrlHost(frontendOrigin);
    if (configuredHost && actualHost && configuredHost !== actualHost) {
      checks.push(
        check(
          'client_url_match',
          'CLIENT_URL match',
          'error',
          `Configured as "${env.clientUrl}" but this page is running on "${frontendOrigin}"`,
          'Update CLIENT_URL to your actual frontend domain and redeploy - a mismatch here breaks CORS and the OAuth redirect back to your app.'
        )
      );
    } else if (configuredHost && actualHost) {
      checks.push(check('client_url_match', 'CLIENT_URL match', 'ok', `Matches the origin this page is loaded from (${frontendOrigin})`));
    }
  }

  // --- Deprecated Gemini model ---
  if (env.geminiModel) {
    if (KNOWN_DEPRECATED_GEMINI_MODELS.includes(env.geminiModel)) {
      checks.push(
        check(
          'gemini_model',
          'GEMINI_MODEL',
          'warning',
          `"${env.geminiModel}" may be deprecated or restricted for new users`,
          'Check Google AI Studio for the current recommended Flash model and update GEMINI_MODEL.'
        )
      );
    } else {
      checks.push(check('gemini_model', 'GEMINI_MODEL', 'ok', `Using "${env.geminiModel}"`));
    }
  }

  // --- NODE_ENV vs the platform's own reported environment (Vercel sets VERCEL_ENV automatically) ---
  const vercelEnv = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development' | undefined
  if (vercelEnv) {
    if (vercelEnv === 'production' && env.nodeEnv !== 'production') {
      checks.push(
        check(
          'node_env_vercel_mismatch',
          'NODE_ENV vs Vercel environment',
          'warning',
          `Vercel reports this as a "production" deployment, but NODE_ENV is "${env.nodeEnv}"`,
          "Set NODE_ENV=production in your Vercel project's environment variables."
        )
      );
    } else {
      checks.push(
        check('node_env_vercel_mismatch', 'NODE_ENV vs Vercel environment', 'ok', `Vercel environment: ${vercelEnv}, NODE_ENV: ${env.nodeEnv}`)
      );
    }
  }

  // --- MongoDB: if we're serving this page at all, a connection already succeeded ---
  checks.push(
    check(
      'mongo_connected',
      'MongoDB connection',
      mongoose.connection.readyState === 1 ? 'ok' : 'warning',
      mongoose.connection.readyState === 1
        ? `Connected to ${maskMongoUri(env.mongoUri)}`
        : 'Not currently connected (unusual if the app is running - check server logs)'
    )
  );

  const overallStatus = checks.some((c) => c.status === 'error')
    ? 'error'
    : checks.some((c) => c.status === 'warning')
    ? 'warning'
    : 'ok';

  return {
    overallStatus,
    checks,
    meta: {
      nodeEnv: env.nodeEnv,
      vercelEnv: vercelEnv || null,
      isVercel: Boolean(process.env.VERCEL),
      checkedAt: new Date().toISOString(),
    },
  };
};

module.exports = { runHealthChecks };