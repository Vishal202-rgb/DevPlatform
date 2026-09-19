const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

test('E2E: User registration, authentication, health checks, and analysis status API', async () => {
  const uniqueEmail = `testuser_${Date.now()}@example.com`;
  const password = 'Password123!';

  // 1. Register test user
  const regRes = await axios.post(`${API_BASE}/auth/register`, {
    name: 'Test Engineer',
    email: uniqueEmail,
    password,
  });

  assert.equal(regRes.status, 201);
  assert.ok(regRes.data?.data?.token, 'Registration returns token');
  const token = regRes.data.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 2. Check current user profile
  const meRes = await axios.get(`${API_BASE}/auth/me`, { headers: authHeaders });
  assert.equal(meRes.status, 200);
  assert.equal(meRes.data.data.user.email, uniqueEmail);

  // 3. Check System Health / Deployment Diagnostics
  const healthRes = await axios.get(`${API_BASE}/system/health-check`, { headers: authHeaders });
  assert.equal(healthRes.status, 200);
  const checks = healthRes.data.data.checks;
  assert.ok(Array.isArray(checks));

  // Find GEMINI_MODEL and GEMINI_FALLBACK_MODEL checks
  const modelCheck = checks.find((c) => c.id === 'gemini_model');
  const fallbackModelCheck = checks.find((c) => c.id === 'gemini_fallback_model');
  const mongoCheck = checks.find((c) => c.id === 'mongo_connected');

  assert.ok(modelCheck, 'gemini_model check exists');
  assert.equal(modelCheck.status, 'ok', 'gemini-2.5-flash is recognized as ok, not deprecated');
  assert.ok(fallbackModelCheck, 'gemini_fallback_model check exists');
  assert.equal(fallbackModelCheck.status, 'ok');
  assert.ok(mongoCheck, 'mongo_connected check exists');
  assert.equal(mongoCheck.status, 'ok');

  // 4. Test Analysis Status endpoint for a repository
  const fakeRepoId = '507f1f77bcf86cd799439011';
  const statusRes = await axios.get(`${API_BASE}/analysis/${fakeRepoId}/status`, { headers: authHeaders });
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.data.success, true);
  assert.equal(statusRes.data.data.isRunning, false);
  assert.equal(statusRes.data.data.stage, 'idle');

  // 5. Test Issues endpoint (empty for new user without repos)
  const issuesRes = await axios.get(`${API_BASE}/analysis/issues`, { headers: authHeaders });
  assert.equal(issuesRes.status, 200);
  assert.equal(Array.isArray(issuesRes.data.data.issues), true);
  assert.equal(issuesRes.data.data.issues.length, 0);

  // 6. Test list analyses (empty for new user)
  const listRes = await axios.get(`${API_BASE}/analysis`, { headers: authHeaders });
  assert.equal(listRes.status, 200);
  assert.equal(Array.isArray(listRes.data.data.analyses), true);
  assert.equal(listRes.data.data.analyses.length, 0);
});
