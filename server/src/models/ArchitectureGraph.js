const mongoose = require('mongoose');

const nodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  val: { type: Number, default: 1 },
  color: { type: String, default: '#F5B942' },
}, { _id: false });

const linkSchema = new mongoose.Schema({
  source: { type: String, required: true },
  target: { type: String, required: true },
}, { _id: false });

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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ArchitectureGraph', architectureGraphSchema);
