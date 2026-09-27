const mongoose = require('mongoose');

const nodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    path: { type: String },
    category: { type: String, default: 'misc' },
    type: { type: String }, // alias for category for backwards compatibility
    val: { type: Number, default: 1 },
    color: { type: String, default: '#F5B942' },
    description: { type: String },
    linesOfCode: { type: Number },
    importsCount: { type: Number, default: 0 },
    importedByCount: { type: Number, default: 0 },
  },
  { _id: false, strict: false }
);

const linkSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    target: { type: String, required: true },
    label: { type: String, default: 'imports' },
    type: { type: String, default: 'imports' },
  },
  { _id: false, strict: false }
);

const architectureGraphSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
      index: true,
    },
    nodes: {
      type: [nodeSchema],
      default: [],
    },
    links: {
      type: [linkSchema],
      default: [],
    },
    summary: {
      totalModules: { type: Number, default: 0 },
      totalLinks: { type: Number, default: 0 },
      categories: { type: mongoose.Schema.Types.Mixed, default: {} },
      entryPoints: { type: [String], default: [] },
      topConnected: { type: [mongoose.Schema.Types.Mixed], default: [] },
      generatedWith: { type: String, default: 'static' },
      lastGeneratedAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ArchitectureGraph', architectureGraphSchema);
