const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name must be under 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never return password by default
    },
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    // GitHub OAuth connection (Part 2). The access token is never sent to the
    // frontend: `select: false` here, plus it's stripped again in toJSON below
    // as defense in depth.
    github: {
      id: { type: Number, default: null }, // GitHub numeric user id
      username: { type: String, default: null },
      avatarUrl: { type: String, default: null },
      profileUrl: { type: String, default: null },
      accessToken: { type: String, default: null, select: false },
      scope: { type: String, default: null },
      connectedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Hash password before saving, only if modified
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare candidate password with hashed password
userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Convenience flag for the frontend so it can show "Connected as x"
 * without ever seeing the access token itself.
 */
userSchema.virtual('githubConnected').get(function githubConnected() {
  return Boolean(this.github && this.github.id);
});
userSchema.set('toObject', { virtuals: true });

// Never leak password/access token/version key when serialized
userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    if (ret.github) {
      delete ret.github.accessToken;
    }
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
