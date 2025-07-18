import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';

// Initialize Google Cloud services (server-side only)
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

export const db = new Firestore({
  projectId,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export const storage = new Storage({
  projectId,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export const bucket = storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET!);

// Client-side Firebase is now in separate firebase.ts file to avoid hydration issues
