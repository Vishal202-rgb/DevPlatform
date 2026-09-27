const mongoose = require('mongoose');

const codeChunkSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
      index: true,
    },
    filePath: {
      type: String,
      required: true,
      index: true,
    },
    fileHash: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      default: 'javascript',
    },
    symbolName: {
      type: String,
      default: null,
    },
    chunkType: {
      type: String,
      enum: ['function', 'class', 'component', 'export', 'route', 'model', 'module', 'block', 'config', 'doc'],
      default: 'block',
    },
    startLine: {
      type: Number,
      required: true,
    },
    endLine: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      default: [],
    },
    charCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

codeChunkSchema.index({ repository: 1, filePath: 1 });
codeChunkSchema.index({ repository: 1, chunkType: 1 });
codeChunkSchema.index({ repository: 1, symbolName: 1 });

codeChunkSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('CodeChunk', codeChunkSchema);
