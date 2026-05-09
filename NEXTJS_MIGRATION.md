# WebCraft Next.js Migration Guide

This project is currently a Vite React app. I cannot fully switch the build script to Next.js here because `package.json` and build scripts are controlled by the workspace, but this is the exact migration path to use Next.js.

## 1. Create Next.js App

```bash
npx create-next-app@latest webcraft-next --ts --tailwind --eslint --app
cd webcraft-next
npm install firebase lucide-react validator @types/validator
```

## 2. Copy Source Files

Copy these files from this project into your Next.js project:

```txt
src/firebase.ts      -> src/lib/firebase.ts
src/AuthContext.tsx  -> src/providers/AuthContext.tsx
src/LoginPage.tsx    -> src/components/LoginPage.tsx
src/VerifyPage.tsx   -> src/components/VerifyPage.tsx
src/AIChat.tsx       -> src/components/AIChat.tsx
src/VoiceAI.tsx      -> src/components/VoiceAI.tsx
src/index.css        -> app/globals.css
```

## 3. Add Client Components

Every component that uses React state, Firebase Auth, Firestore, browser APIs, voice, or `window` must start with:

```tsx
'use client';
```

Add it at the top of:

```txt
AuthContext.tsx
LoginPage.tsx
VerifyPage.tsx
AIChat.tsx
VoiceAI.tsx
WebCraftApp.tsx
```

## 4. Next.js App Structure

Use this structure:

```txt
app/
  layout.tsx
  page.tsx
  globals.css
src/
  components/
  providers/
  lib/
```

Example `app/layout.tsx`:

```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WebCraft - Build Your Website',
  description: 'Website builder with Firebase auth, dashboard, and KellySeekAI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Example `app/page.tsx`:

```tsx
'use client';

import { AuthProvider } from '@/providers/AuthContext';
import WebCraftApp from '@/components/WebCraftApp';

export default function Page() {
  return (
    <AuthProvider>
      <WebCraftApp />
    </AuthProvider>
  );
}
```

## 5. Firebase Environment Variables

For Next.js, use `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBh5Jrwp53NS4n4_W4Q1Zssh2kqTz0sWBA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=webcraft-6e3ba.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=webcraft-6e3ba
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=webcraft-6e3ba.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=49475677388
NEXT_PUBLIC_FIREBASE_APP_ID=1:49475677388:web:41c80bb4d4e4f7d2636669
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-TN8N3L8TVL
```

Then update Firebase config:

```ts
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
```

## 6. Firebase Auth Rules For Google Login

In Firebase Console:

1. Go to Authentication.
2. Open Sign-in method.
3. Enable Email/Password.
4. Enable Google.
5. Add a support email in Google provider.
6. Open Settings > Authorized domains.
7. Add `localhost`.
8. Add your Vercel domain, for example `webcraft-next.vercel.app`.
9. Add your custom domain if you have one.
10. Open Templates > Email address verification.
11. Set sender name to `WebCraft`.
12. Do not use a custom continue URL unless that domain is authorized.

## 7. Firestore Rules

Use the complete rules in `FIREBASE_RULES.txt`.

## 8. Important Security Note

Admin and manager keys should not stay in frontend code in production. In Next.js, move them into a secure Route Handler or Firebase Cloud Function.