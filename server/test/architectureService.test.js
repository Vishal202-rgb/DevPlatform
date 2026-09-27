const test = require('node:test');
const assert = require('node:assert/strict');
const architectureService = require('../src/services/architectureService');
const geminiService = require('../src/services/geminiService');

const sampleRepoFiles = [
  {
    path: 'server/server.js',
    content: `
      const express = require('express');
      const app = require('./src/app');
      const connectDB = require('./src/config/db');
      connectDB();
      app.listen(5000);
    `,
  },
  {
    path: 'server/src/app.js',
    content: `
      const express = require('express');
      const authRoutes = require('./routes/authRoutes');
      const repoRoutes = require('./routes/repoRoutes');
      const app = express();
      app.use('/api/auth', authRoutes);
      app.use('/api/repos', repoRoutes);
      module.exports = app;
    `,
  },
  {
    path: 'server/src/routes/authRoutes.js',
    content: `
      const express = require('express');
      const { login, register } = require('../controllers/authController');
      const router = express.Router();
      router.post('/login', login);
      router.post('/register', register);
      module.exports = router;
    `,
  },
  {
    path: 'server/src/controllers/authController.js',
    content: `
      const authService = require('../services/authService');
      const User = require('../models/User');
      const login = async (req, res) => {
        const user = await authService.login(req.body);
        res.json(user);
      };
      module.exports = { login };
    `,
  },
  {
    path: 'server/src/services/authService.js',
    content: `
      const jwt = require('jsonwebtoken');
      const bcrypt = require('bcryptjs');
      const User = require('../models/User');
      const env = require('../config/env');
      module.exports = {
        login: async () => {},
      };
    `,
  },
  {
    path: 'server/src/models/User.js',
    content: `
      const mongoose = require('mongoose');
      const userSchema = new mongoose.Schema({
        name: String,
        email: String,
      });
      module.exports = mongoose.model('User', userSchema);
    `,
  },
  {
    path: 'server/src/middleware/authMiddleware.js',
    content: `
      const jwt = require('jsonwebtoken');
      const User = require('../models/User');
      const protect = (req, res, next) => {
        next();
      };
      module.exports = { protect };
    `,
  },
  {
    path: 'server/src/config/db.js',
    content: `
      const mongoose = require('mongoose');
      const env = require('./env');
      module.exports = async () => {};
    `,
  },
  {
    path: 'server/src/config/env.js',
    content: `
      module.exports = {
        port: 5000,
        mongoUri: 'mongodb://localhost:27017',
      };
    `,
  },
  {
    path: 'client/src/App.jsx',
    content: `
      import React from 'react';
      import { Routes, Route } from 'react-router-dom';
      import Navbar from './components/Navbar';
      import Dashboard from './pages/Dashboard';
      export default function App() {
        return <div><Navbar /><Dashboard /></div>;
      }
    `,
  },
  {
    path: 'client/src/components/Navbar.jsx',
    content: `
      import React from 'react';
      import { Link } from 'react-router-dom';
      export default function Navbar() {
        return <nav><Link to="/">Home</Link></nav>;
      }
    `,
  },
  {
    path: 'client/src/pages/Dashboard.jsx',
    content: `
      import React, { useState } from 'react';
      import api from '../services/api';
      export default function Dashboard() {
        return <div>Dashboard</div>;
      }
    `,
  },
  {
    path: 'client/src/services/api.js',
    content: `
      import axios from 'axios';
      const api = axios.create({ baseURL: '/api' });
      export default api;
    `,
  },
];

test('Architecture Service - Static Analysis & Category Classification', (t) => {
  const result = architectureService.generateStaticArchitectureGraph('acme/webapp', sampleRepoFiles);

  assert.ok(result);
  assert.ok(Array.isArray(result.nodes), 'result.nodes must be an array');
  assert.ok(Array.isArray(result.links), 'result.links must be an array');
  assert.ok(result.nodes.length >= sampleRepoFiles.length, 'All files must be represented as nodes');

  // Verify categories
  const routesNode = result.nodes.find((n) => n.id === 'server/src/routes/authRoutes.js');
  assert.ok(routesNode, 'authRoutes node exists');
  assert.strictEqual(routesNode.category, 'routes');
  assert.strictEqual(routesNode.color, '#38BDF8');

  const controllerNode = result.nodes.find((n) => n.id === 'server/src/controllers/authController.js');
  assert.ok(controllerNode);
  assert.strictEqual(controllerNode.category, 'controllers');
  assert.strictEqual(controllerNode.color, '#818CF8');

  const serviceNode = result.nodes.find((n) => n.id === 'server/src/services/authService.js');
  assert.ok(serviceNode);
  assert.strictEqual(serviceNode.category, 'services');
  assert.strictEqual(serviceNode.color, '#F59E0B');

  const modelNode = result.nodes.find((n) => n.id === 'server/src/models/User.js');
  assert.ok(modelNode);
  assert.strictEqual(modelNode.category, 'models');
  assert.strictEqual(modelNode.color, '#10B981');

  const middlewareNode = result.nodes.find((n) => n.id === 'server/src/middleware/authMiddleware.js');
  assert.ok(middlewareNode);
  assert.strictEqual(middlewareNode.category, 'middleware');
  assert.strictEqual(middlewareNode.color, '#A855F7');

  const componentNode = result.nodes.find((n) => n.id === 'client/src/components/Navbar.jsx');
  assert.ok(componentNode);
  assert.strictEqual(componentNode.category, 'components');
  assert.strictEqual(componentNode.color, '#F97316');

  const configNode = result.nodes.find((n) => n.id === 'server/src/config/env.js');
  assert.ok(configNode);
  assert.strictEqual(configNode.category, 'config');
  assert.strictEqual(configNode.color, '#06B6D4');
});

test('Architecture Service - Link Resolution & Dependency Mapping', (t) => {
  const result = architectureService.generateStaticArchitectureGraph('acme/webapp', sampleRepoFiles);

  // Check controller -> service link
  const ctrlToServiceLink = result.links.find(
    (l) => l.source === 'server/src/controllers/authController.js' && l.target === 'server/src/services/authService.js'
  );
  assert.ok(ctrlToServiceLink, 'Link exists from authController to authService');

  // Check controller -> model link
  const ctrlToModelLink = result.links.find(
    (l) => l.source === 'server/src/controllers/authController.js' && l.target === 'server/src/models/User.js'
  );
  assert.ok(ctrlToModelLink, 'Link exists from authController to User model');

  // Check routes -> controller link
  const routesToCtrlLink = result.links.find(
    (l) => l.source === 'server/src/routes/authRoutes.js' && l.target === 'server/src/controllers/authController.js'
  );
  assert.ok(routesToCtrlLink, 'Link exists from authRoutes to authController');

  // Check App.jsx -> Navbar.jsx link
  const appToNavbarLink = result.links.find(
    (l) => l.source === 'client/src/App.jsx' && l.target === 'client/src/components/Navbar.jsx'
  );
  assert.ok(appToNavbarLink, 'Link exists from App.jsx to Navbar.jsx');

  // Check major dependency node creation (e.g. express, mongoose, axios, react)
  const expressDepNode = result.nodes.find((n) => n.id === 'dep:express');
  assert.ok(expressDepNode, 'Major dependency node for express created');
  assert.strictEqual(expressDepNode.category, 'dependencies');

  const mongooseDepNode = result.nodes.find((n) => n.id === 'dep:mongoose');
  assert.ok(mongooseDepNode, 'Major dependency node for mongoose created');
});

test('Architecture Service - Summary Metrics & Resilience', async (t) => {
  const originalGen = geminiService.generateArchitectureGraph;
  geminiService.generateArchitectureGraph = async () => ({
    nodes: [{ id: 'server/server.js', name: 'Server Entry', val: 3, color: '#64748B' }],
    links: [],
  });

  try {
    const result = await architectureService.generateArchitecture('acme/webapp', sampleRepoFiles);

    assert.ok(result.summary);
    assert.ok(result.summary.totalModules > 0);
    assert.ok(result.summary.totalLinks > 0);
    assert.ok(result.summary.categories);
    assert.ok(result.summary.entryPoints.includes('server/server.js') || result.summary.entryPoints.includes('client/src/App.jsx'));
    assert.ok(Array.isArray(result.summary.topConnected));
    assert.ok(result.summary.topConnected.length > 0);

    // Even if Gemini fails or is unconfigured, generateArchitecture never throws
    geminiService.generateArchitectureGraph = async () => {
      throw new Error('Gemini model not found / network failure');
    };

    const fallbackResult = await architectureService.generateArchitecture('acme/webapp', sampleRepoFiles);
    assert.ok(fallbackResult, 'Fallback static architecture generated successfully without throwing');
    assert.strictEqual(fallbackResult.summary.generatedWith, 'static');
    assert.ok(fallbackResult.nodes.length > 0);
  } finally {
    geminiService.generateArchitectureGraph = originalGen;
  }
});
