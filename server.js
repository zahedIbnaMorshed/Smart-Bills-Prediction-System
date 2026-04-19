// ════════════════════════════════════════════════════════════════════
//  BACKEND — BidyutBill ⚡🔥
//  MongoDB Atlas + Express REST API
// ════════════════════════════════════════════════════════════════════

import 'dotenv/config';
import mongoose from 'mongoose';
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// ── CORS (allow frontend dev server) ────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── MongoDB Connection ────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in .env file');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// ── Mongoose Schemas ─────────────────────────────────────────────────

const UserSchema = new mongoose.Schema({
  _id: { type: String },          // same as frontend gid() UUID
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String },
  district: { type: String },
  passwordHash: { type: String, required: true },
  emailVerified: { type: Boolean, default: false },
  otp: { type: String },
  joinDate: { type: Number },
  provider: { type: String, default: '' },
  sanctionedLoad: { type: Number, default: 2 },
  gasProvider: { type: String, default: '' },
}, { _id: false });

const HistorySchema = new mongoose.Schema({
  _id: { type: String },          // frontend gid()
  userId: { type: String, required: true, index: true },
  userName: { type: String },
  type: { type: String },         // "electricity" | "gas"
  date: { type: Number, index: true },
  data: { type: mongoose.Schema.Types.Mixed }, // full record
}, { _id: false });

const FeedbackSchema = new mongoose.Schema({
  _id: { type: String },
  userId: { type: String, required: true, index: true },
  userName: { type: String },
  date: { type: Number },
  data: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const ResetTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: String },
  email: { type: String },
  expires: { type: Number },
});

const User      = mongoose.model('User',       UserSchema);
const History   = mongoose.model('History',    HistorySchema);
const Feedback  = mongoose.model('Feedback',   FeedbackSchema);
const ResetToken = mongoose.model('ResetToken', ResetTokenSchema);
// ── Helper ────────────────────────────────────────────────────────────
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// ── AUTH ROUTES ───────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { id, name, email, phone, district, passwordHash, otp, joinDate, provider, sanctionedLoad, gasProvider } = req.body;
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already registered.' });
    const user = new User({ _id: id, name, email, phone, district, passwordHash, emailVerified: false, otp, joinDate, provider: provider || '', sanctionedLoad: sanctionedLoad || 2, gasProvider: gasProvider || '' });
    await user.save();
    const u = user.toObject();
    u.id = u._id; delete u._id; delete u.__v;
    res.json({ user: u });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, passwordHash } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'Email not registered.' });
    if (user.passwordHash !== passwordHash) return res.status(401).json({ error: 'Wrong password.' });
    const u = user.toObject();
    u.id = u._id; delete u._id; delete u.__v;
    res.json({ user: u });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// GET /api/auth/me/:id
app.get('/api/auth/me/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const u = user.toObject();
    u.id = u._id; delete u._id; delete u.__v;
    res.json({ user: u });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/auth/update/:id
app.put('/api/auth/update/:id', async (req, res) => {
  try {
    const { name, phone, district, provider, gasProvider, sanctionedLoad, passwordHash, emailVerified, otp } = req.body;
    const update = {};
    if (name !== undefined)          update.name = name;
    if (phone !== undefined)         update.phone = phone;
    if (district !== undefined)      update.district = district;
    if (provider !== undefined)      update.provider = provider;
    if (gasProvider !== undefined)   update.gasProvider = gasProvider;
    if (sanctionedLoad !== undefined) update.sanctionedLoad = sanctionedLoad;
    if (passwordHash !== undefined)  update.passwordHash = passwordHash;
    if (emailVerified !== undefined) update.emailVerified = emailVerified;
    if (otp !== undefined)           update.otp = otp;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const u = user.toObject();
    u.id = u._id; delete u._id; delete u.__v;
    res.json({ user: u });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── RESET TOKEN ROUTES ────────────────────────────────────────────────

// POST /api/reset/send
app.post('/api/reset/send', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'Email not registered.' });
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    await ResetToken.deleteMany({ email: email.toLowerCase() });
    await ResetToken.create({ token, userId: user._id, email: email.toLowerCase(), expires: Date.now() + 15 * 60 * 1000 });
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/reset/verify
app.post('/api/reset/verify', async (req, res) => {
  try {
    const { token, newPasswordHash } = req.body;
    const rec = await ResetToken.findOne({ token });
    if (!rec || Date.now() > rec.expires) return res.status(400).json({ error: 'Invalid or expired OTP.' });
    await User.findByIdAndUpdate(rec.userId, { passwordHash: newPasswordHash });
    await ResetToken.deleteOne({ token });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
