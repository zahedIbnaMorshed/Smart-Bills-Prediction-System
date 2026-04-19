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
