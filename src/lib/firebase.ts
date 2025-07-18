'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { useEffect, useState } from 'react';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function initializeFirebase() {
  if (typeof window === 'undefined') return { db: null, auth: null };
  
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
    auth = getAuth(app);
  }
  
  return { db, auth };
}

export function useFirebase() {
  const [firebase, setFirebase] = useState<{ db: Firestore | null; auth: Auth | null }>({
    db: null,
    auth: null
  });

  useEffect(() => {
    const { db, auth } = initializeFirebase();
    setFirebase({ db, auth });
  }, []);

  return firebase;
}

export { db as clientDb, auth };
