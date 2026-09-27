const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema(
  {
    agent: {
      type: String,
      enum: ['bug', 'security', 'architecture', 'test', 'performance'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'info'],
      default: 'medium',
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.85,
    },
    filePath: {
      type: String,
      required: true,
    },
    startLine: {
      type: Number,
      default: null,
    },
    endLine: {
      type: Number,
      default: null,
    },
    evidence: {
      type: String,
      default: '',
    },
    recommendation: {
      type: String,
      required: true,
    },
    suggestedFix: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const agentRunSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      default: 'running',
    },
    agentsExecuted: {
      type: [String],
      default: ['bug', 'security', 'architecture', 'test', 'performance'],
    },
    findings: {
      type: [findingSchema],
      default: [],
    },
    summary: {
      totalFindings: { type: Number, default: 0 },
      critical: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      byAgent: {
        bug: { type: Number, default: 0 },
        security: { type: Number, default: 0 },
        architecture: { type: Number, default: 0 },
        test: { type: Number, default: 0 },
        performance: { type: Number, default: 0 },
      },
      filesScanned: { type: Number, default: 0 },
      rulesEvaluated: { type: Number, default: 0 },
      securityScore: { type: Number, default: 100 },
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

agentRunSchema.index({ repository: 1, createdAt: -1 });

agentRunSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('AgentRun', agentRunSchema);
