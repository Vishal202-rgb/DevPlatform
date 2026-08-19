const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    githubId: {
      type: Number,
      required: true, // GitHub's numeric repository id
    },
    name: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true, // e.g. "octocat/hello-world"
    },
    description: {
      type: String,
      default: '',
    },
    htmlUrl: {
      type: String,
      required: true,
    },
    cloneUrl: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      default: null,
    },
    stars: {
      type: Number,
      default: 0,
    },
    forks: {
      type: Number,
      default: 0,
    },
    defaultBranch: {
      type: String,
      default: 'main',
    },
    private: {
      type: Boolean,
      default: false,
    },
    githubOwner: {
      type: String,
      required: true, // owner login, e.g. "octocat"
    },
    // Whether the user has explicitly "connected" this repo for future
    // analysis (Part 3+). Listing GitHub repos does not, by itself, persist
    // anything here — only an explicit connect action does.
    connectedForAnalysis: {
      type: Boolean,
      default: true,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    // Part 3 additions - denormalized pointer to the most recent analysis so
    // the repository list/dashboard can show status without an extra query.
    lastAnalysis: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Analysis',
      default: null,
    },
    lastAnalyzedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// One record per user+repo
repositorySchema.index({ user: 1, githubId: 1 }, { unique: true });

repositorySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Repository', repositorySchema);
