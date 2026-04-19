# ⚡🔥 — MongoDB Setup Guide

## ডেটা কোথায় যাবে?

এখন সব data **MongoDB Atlas** এ যাবে:

| Collection | কী store হয় |
|---|---|
| `users` | User এর সব তথ্য (নাম, ইমেইল, পাসওয়ার্ড hash) |
| `histories` | Bill calculation history |
| `feedbacks` | User feedback |
| `resettokens` | Password reset OTP |

---

## চালু করার ধাপ

### ১. `.env` ফাইল তৈরি করুন

`env.example` ফাইলটি কপি করে `.env` নাম দিন:

```bash
cp env.example .env
```

তারপর `.env` ফাইলে MongoDB connection string বসান।

### ২. MongoDB Atlas থেকে connection string নিন

1. [mongodb.com/atlas](https://www.mongodb.com/atlas) এ যান
2. Cluster সিলেক্ট করুন → **Connect** বাটনে ক্লিক করুন
3. **Drivers** অপশন বেছে নিন
4. Connection string কপি করুন — এভাবে দেখাবে:
   ```
   mongodb+srv://zahed:zahed123@cluster0.tfrqaqx.mongodb.net/bidyutbill?retryWrites=true&w=majority
   ```
5. `.env` ফাইলে `MONGO_URI=` এর পরে বসান

### ৩. Dependencies install করুন

```bash
npm install
```

### ৪. দুটো terminal এ চালান

**Terminal 1 — Backend server:**
```bash
npm run server
```
> Server চালু হলে দেখাবে: `✅ Connected to MongoDB Atlas`

**Terminal 2 — Frontend:**
```bash
npm run dev
```
> Browser এ যান: `http://localhost:5173`

---

## একসাথে চালানো (optional)

```bash
npm run start:all
```

---

## MongoDB Atlas এ data দেখুন

1. Atlas dashboard এ যান
2. **Browse Collections** ক্লিক করুন
3. `bidyutbill` database এ দেখুন:
   - `users` — সব registered users
   - `histories` — bill calculation records
   - `feedbacks` — user feedbacks

---

## API Endpoints

| Method | URL | কাজ |
|--------|-----|-----|
| POST | `/api/auth/register` | নতুন user তৈরি |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me/:id` | Session restore |
| PUT | `/api/auth/update/:id` | Profile update |
| POST | `/api/reset/send` | Password reset OTP |
| POST | `/api/reset/verify` | নতুন password set |
| POST | `/api/history` | History save |
| GET | `/api/history/:userId` | History load |
| POST | `/api/feedback` | Feedback save |
| GET | `/api/feedback/:userId` | Feedback load |
| GET | `/api/health` | Server status check |

---

## সমস্যা হলে

**"MONGO_URI is not defined" error:**
→ `.env` ফাইল আছে কিনা চেক করুন, `env.example` থেকে কপি করুন

**"MongoDB connection error":**
→ Atlas dashboard এ Network Access এ `0.0.0.0/0` (Allow from anywhere) add করুন

**Frontend API call fail:**
→ Backend server চালু আছে কিনা চেক করুন (`npm run server`)
→ `http://localhost:5000/api/health` এ গেলে `{"status":"ok","db":"connected"}` দেখাবে
