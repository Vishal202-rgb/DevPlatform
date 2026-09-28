const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
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
    action: {
      type: String,
      enum: [
        'fix_generated',
        'impact_analyzed',
        'tests_generated',
        'tests_applied',
        'tests_executed',
        'verification_completed',
        'fix_applied',
        'pr_created',
        'rollback_performed',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['success', 'warning', 'failed', 'pending'],
      default: 'success',
    },
    targetFile: {
      type: String,
      default: '',
    },
    issueId: {
      type: String,
      default: null,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    message: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ repository: 1, createdAt: -1 });

auditLogSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
