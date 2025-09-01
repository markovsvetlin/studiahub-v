# 🔐 Authentication Setup Guide

## Quick Fix for OAuth Error

You're seeing the "OAuth client was not found" error because Clerk authentication isn't configured.

## 🚀 Step-by-Step Setup

### 1. Create a Clerk Account

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Sign up/Sign in
3. Create a new application
4. Choose "Next.js" as your framework

### 2. Get Your Clerk Keys

From your Clerk Dashboard:

1. **Publishable Key**: Copy the key that starts with `pk_test_` or `pk_live_`
2. **Secret Key**: Copy the key that starts with `sk_test_` or `sk_live_`

### 3. Configure Environment Variables

1. **Frontend Configuration**:
   ```bash
   cd frontend
   cp .env.example .env.local
   ```
   
   Edit `frontend/.env.local` and replace:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY_HERE
   CLERK_SECRET_KEY=sk_test_YOUR_ACTUAL_SECRET_HERE
   ```

2. **Backend Configuration**:
   ```bash
   cd backend
   cp .env.example .env.dev
   ```
   
   Fill in your API keys in `backend/.env.dev`

### 4. Enable Google OAuth in Clerk

1. In your Clerk Dashboard, go to **"User & Authentication" → "Social Connections"**
2. Click on **"Google"**
3. Toggle it **ON**
4. Configure your Google OAuth settings:
   - You can use Clerk's development keys initially
   - For production, add your own Google OAuth credentials

### 5. Configure Redirect URLs

In Clerk Dashboard → **"Domains"**:
- Add `http://localhost:3000` for development
- Add your production domain later

### 6. Restart Your Application

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend  
cd frontend
npm run dev
```

## 🔍 Verification

1. Visit `http://localhost:3000`
2. Click "Sign in with Google"
3. You should be redirected to Clerk's Google OAuth flow
4. After successful authentication, you'll be redirected to your dashboard

## 🚨 Common Issues

### "Invalid Publishable Key"
- Double-check your `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `frontend/.env.local`
- Make sure it starts with `pk_test_` or `pk_live_`

### "Redirect URL Mismatch"
- Ensure `http://localhost:3000` is added in Clerk Dashboard → Domains
- Check that `redirectUrl` in your code matches your domain

### "Google OAuth Not Working"
- Enable Google in Clerk Dashboard → Social Connections
- Make sure Google OAuth is toggled ON

## 🎯 Next Steps

After authentication works:

1. **Production Setup**: 
   - Get production Clerk keys
   - Configure production domains
   - Set up custom Google OAuth app

2. **Additional Features**:
   - Configure user profiles
   - Set up webhooks for user events
   - Customize authentication flow

## 🔗 Helpful Links

- [Clerk Documentation](https://clerk.com/docs)
- [Next.js Integration Guide](https://clerk.com/docs/nextjs/overview)
- [Google OAuth Setup](https://clerk.com/docs/authentication/social-connections/google)

---

*After following these steps, your OAuth error should be resolved!*
