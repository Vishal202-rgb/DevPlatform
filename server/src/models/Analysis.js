const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema(
  {
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      required: true,
    },
    category: {
      type: String,
      enum: ['bug', 'security', 'performance', 'code-smell'],
      required: true,
    },
    file: {
      type: String,
      required: true,
    },
    line: {
      type: Number,
      default: null,
    },
    description: {
      type: String,
      required: true,
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

const analysisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['completed', 'failed'],
      required: true,
    },
    model: {
      type: String,
      default: 'gemini-2.5-flash',
    },
    filesAnalyzed: {
      type: Number,
      default: 0,
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null, // null when status === 'failed'
    },
    summary: {
      critical: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      totalIssues: { type: Number, default: 0 },
    },
    issues: {
      type: [issueSchema],
      default: [],
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt = when the analysis ran, updatedAt
  }
);

analysisSchema.index({ repository: 1, createdAt: -1 });

analysisSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Analysis', analysisSchema);
