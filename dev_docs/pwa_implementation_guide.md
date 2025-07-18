# PWA Photo-Mapping App: Technical Implementation Guide

## Project Overview
Create a Progressive Web App that allows users to upload photos, extract EXIF data and GPS coordinates, 
generate AI-powered captions using Google Vision API, and display photo locations on an interactive map.

## Technology Stack (Google Cloud Platform Only)
- **Frontend**: Next.js with PWA capabilities (next-pwa plugin)
- **Photo Processing**: exif-js library for EXIF data extraction
- **AI Vision**: Google Cloud Vision API for image analysis and captioning
- **AI Captions**: Vertex AI with Gemini models for intelligent caption generation
- **Mapping**: Google Maps JavaScript API
- **Database**: Cloud Firestore for real-time data storage
- **Storage**: Google Cloud Storage for photo files
- **Authentication**: Google Cloud Identity Platform (Firebase Auth via GCP)
- **Hosting**: Google Cloud App Engine or Cloud Run for PWA deployment

## Step-by-Step Implementation

### Phase 1: Project Setup & PWA Foundation (Day 1 - 6 hours)

#### 1.1 Initialize Next.js App with PWA Support
```bash
npx create-next-app@latest photo-mapper-pwa
cd photo-mapper-pwa
npm install next-pwa
npm run dev
```

#### 1.2 Configure PWA with next-pwa
Create `next.config.js`:
```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

module.exports = withPWA({
  reactStrictMode: true,
  swcMinify: true,
});
```

Create `public/manifest.json`:
```json
{
  "name": "Photo Mapper PWA",
  "short_name": "PhotoMapper",
  "description": "AI-powered photo mapping application",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "display": "standalone",
  "scope": "/",
  "start_url": "/",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512x512.png", 
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### 1.3 Install Required Dependencies
```bash
npm install @google-cloud/firestore @google-cloud/storage exif-js
npm install @google-cloud/vision
npm install @googlemaps/react-wrapper
npm install @google-cloud/aiplatform
npm install @next/bundle-analyzer
npm install formidable
```

### Phase 2: EXIF Data Extraction (Day 1 - 6 hours)

#### 2.1 Create Photo Upload Component
```jsx
// components/PhotoUpload.jsx
import React, { useState } from 'react';
import EXIF from 'exif-js';

const PhotoUpload = ({ onPhotoProcessed }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      processPhoto(file);
    }
  };

  const processPhoto = (file) => {
    setProcessing(true);

    EXIF.getData(file, function() {
      const exifData = EXIF.getAllTags(this);
      const gpsData = extractGPSData(exifData);

      onPhotoProcessed({
        file,
        exifData,
        gpsData,
        timestamp: new Date().toISOString()
      });

      setProcessing(false);
    });
  };

  const extractGPSData = (exifData) => {
    if (!exifData.GPSLatitude || !exifData.GPSLongitude) {
      return null;
    }

    const lat = convertDMSToDD(
      exifData.GPSLatitude[0],
      exifData.GPSLatitude[1], 
      exifData.GPSLatitude[2],
      exifData.GPSLatitudeRef
    );

    const lng = convertDMSToDD(
      exifData.GPSLongitude[0],
      exifData.GPSLongitude[1],
      exifData.GPSLongitude[2], 
      exifData.GPSLongitudeRef
    );

    return { lat, lng };
  };

  const convertDMSToDD = (degrees, minutes, seconds, direction) => {
    let dd = degrees + (minutes/60) + (seconds/3600);
    if (direction === "S" || direction === "W") {
      dd = dd * -1;
    }
    return dd;
  };

  return (
    <div className="photo-upload">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={processing}
      />
      {processing && <p>Processing photo...</p>}
    </div>
  );
};

export default PhotoUpload;
```

### Phase 3: Google Cloud Integration (Day 2 - 8 hours)

#### 3.1 Google Cloud Configuration
```javascript
// lib/googleCloud.js
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';

// Initialize Google Cloud services
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

export const db = new Firestore({
  projectId,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export const storage = new Storage({
  projectId,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export const bucket = storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET);

// For client-side Firestore (using Firebase SDK for web)
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if it hasn't been initialized yet (for client-side)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const clientDb = getFirestore(app);
export const auth = getAuth(app);
```

#### 3.2 Google Cloud Vision API Route
Create `pages/api/analyze-image.js`:
```javascript
// pages/api/analyze-image.js
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { VertexAI } from '@google-cloud/aiplatform';
import formidable from 'formidable';
import fs from 'fs';

// Configure API route to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

const vision = new ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

// Initialize Vertex AI for Gemini
const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-central1',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const form = formidable();
    const [fields, files] = await form.parse(req);
    const file = files.image[0];

    if (!file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Read the uploaded file
    const imageBuffer = fs.readFileSync(file.filepath);

    // Perform Vision API analysis
    const [labelResult] = await vision.labelDetection({ image: { content: imageBuffer } });
    const [textResult] = await vision.textDetection({ image: { content: imageBuffer } });
    const [objectResult] = await vision.objectLocalization({ image: { content: imageBuffer } });
    const [landmarkResult] = await vision.landmarkDetection({ image: { content: imageBuffer } });

    // Generate AI caption using Vertex AI Gemini
    const generativeModel = vertexAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
    });

    const labels = labelResult.labelAnnotations?.map(l => l.description).slice(0, 5) || [];
    const landmarks = landmarkResult.landmarkAnnotations?.map(l => l.description) || [];
    
    const prompt = `Generate a natural, engaging caption for a photo that contains these elements: ${labels.join(', ')}${landmarks.length > 0 ? ` and landmarks: ${landmarks.join(', ')}` : ''}. Keep it concise and appealing for social media.`;
    
    const result = await generativeModel.generateContent(prompt);
    const aiCaption = result.response.text();

    // Clean up temp file
    fs.unlinkSync(file.filepath);

    res.status(200).json({
      labels: labelResult.labelAnnotations || [],
      text: textResult.textAnnotations || [],
      objects: objectResult.localizedObjectAnnotations || [],
      landmarks: landmarkResult.landmarkAnnotations || [],
      aiCaption: aiCaption || 'Beautiful photo captured',
    });
  } catch (error) {
    console.error('Vision API error:', error);
    res.status(500).json({ message: 'Analysis failed', error: error.message });
  }
}
```

#### 3.3 Vision Service for Client-Side
```javascript
// lib/visionService.js
const analyzeImage = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);

  try {
    const response = await fetch('/api/analyze-image', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Analysis failed');
    }

    const result = await response.json();
    return {
      labels: result.labels,
      text: result.text,
      objects: result.objects,
      landmarks: result.landmarks,
      aiCaption: result.aiCaption
    };
  } catch (error) {
    console.error('Vision API error:', error);
    return null;
  }
};

export { analyzeImage };
```

### Phase 4: Map Integration (Day 2 - 4 hours)

#### 4.1 Google Maps Component
```jsx
// components/PhotoMap.jsx
import React from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';

const PhotoMap = ({ photos, selectedPhoto, onMarkerClick }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  });

  const mapCenter = photos.length > 0 ? 
    { lat: photos[0].gpsData.lat, lng: photos[0].gpsData.lng } :
    { lat: 0, lng: 0 };

  if (!isLoaded) return <div>Loading Map...</div>;

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '400px' }}
      center={mapCenter}
      zoom={10}
    >
      {photos.map((photo, index) => (
        photo.gpsData && (
          <Marker
            key={index}
            position={{ lat: photo.gpsData.lat, lng: photo.gpsData.lng }}
            onClick={() => onMarkerClick(photo)}
          />
        )
      ))}

      {selectedPhoto && (
        <InfoWindow
          position={{ 
            lat: selectedPhoto.gpsData.lat, 
            lng: selectedPhoto.gpsData.lng 
          }}
          onCloseClick={() => onMarkerClick(null)}
        >
          <div>
            <img src={selectedPhoto.url} alt="Photo" style={{width: '200px'}} />
            <p>{selectedPhoto.caption}</p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

export default PhotoMap;
```

### Phase 5: Database & Storage (Day 2 - 4 hours)

#### 5.1 Photo Storage Service
```javascript
// lib/storageService.js
import { bucket, db } from './googleCloud';
import { clientDb } from './googleCloud';
import { collection, addDoc, getDocs } from 'firebase/firestore';

export const uploadPhoto = async (photoData) => {
  try {
    // Create unique filename
    const fileName = `photos/${Date.now()}_${photoData.file.name}`;
    const file = bucket.file(fileName);

    // Upload image file to Google Cloud Storage
    const stream = file.createWriteStream({
      metadata: {
        contentType: photoData.file.type,
      },
    });

    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', async () => {
        try {
          // Make the file publicly readable
          await file.makePublic();
          
          // Get the public URL
          const downloadURL = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

          // Save metadata to Firestore (using client SDK for consistency)
          const docRef = await addDoc(collection(clientDb, 'photos'), {
            url: downloadURL,
            filename: photoData.file.name,
            gpsData: photoData.gpsData,
            exifData: photoData.exifData,
            caption: photoData.caption,
            timestamp: photoData.timestamp,
            userId: photoData.userId,
            analysis: photoData.analysis
          });

          resolve({ id: docRef.id, url: downloadURL });
        } catch (error) {
          reject(error);
        }
      });

      // Convert File to Buffer and write to stream
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = Buffer.from(reader.result);
        stream.end(buffer);
      };
      reader.readAsArrayBuffer(photoData.file);
    });
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

export const getPhotos = async () => {
  try {
    const querySnapshot = await getDocs(collection(clientDb, 'photos'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Fetch error:', error);
    return [];
  }
};
```

### Phase 6: Sharing Feature (Day 3 - 3 hours)

#### 6.1 Share Component
```jsx
// components/ShareModal.jsx
import React, { useState } from 'react';

const ShareModal = ({ photo, onClose }) => {
  const [shareUrl, setShareUrl] = useState('');

  const generateShareUrl = () => {
    const url = `${window.location.origin}/photo/${photo.id}`;
    setShareUrl(url);
    navigator.clipboard.writeText(url);
  };

  const shareToSocial = (platform) => {
    const text = `Check out this photo: ${photo.caption}`;
    const url = shareUrl;

    switch(platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`);
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`);
        break;
      default:
        break;
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Share Photo</h3>
        <img src={photo.url} alt="Shared photo" style={{width: '200px'}} />
        <p>{photo.caption}</p>

        <button onClick={generateShareUrl}>Generate Share Link</button>
        {shareUrl && (
          <div>
            <input value={shareUrl} readOnly />
            <button onClick={() => shareToSocial('twitter')}>Share on Twitter</button>
            <button onClick={() => shareToSocial('facebook')}>Share on Facebook</button>
          </div>
        )}

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default ShareModal;
```

## Security & Performance Considerations

### Security Rules for Firestore
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /photos/{photoId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Service Worker for Offline Support
```javascript
// public/sw.js (automatically generated by next-pwa)
// This file is automatically generated by next-pwa plugin
// You can customize caching strategies in next.config.js

// Custom service worker additions can be added here
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Cache strategies are configured via next-pwa plugin
```

#### Next.js PWA Configuration
Update `next.config.js` for advanced PWA features:
```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/maps\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-maps-cache',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60 // 24 hours
        }
      }
    },
    {
      urlPattern: /^https:\/\/storage\.googleapis\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-cloud-storage-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
        }
      }
    }
  ]
});

module.exports = withPWA({
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['storage.googleapis.com'],
    formats: ['image/webp', 'image/avif'],
  },
});
```

## Environment Variables Setup for Next.js

Create `.env.local` file:
```env
# Google Cloud Platform Configuration
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
GOOGLE_CLOUD_STORAGE_BUCKET=your_storage_bucket_name

# Firebase Web SDK (for client-side Firestore)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Google Maps API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_api_key

# Next.js specific
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_key
```

## Google Cloud Platform Setup

### Prerequisites
1. **Create Google Cloud Project**
   ```bash
   gcloud projects create your-project-id
   gcloud config set project your-project-id
   ```

2. **Enable Required APIs**
   ```bash
   gcloud services enable vision.googleapis.com
   gcloud services enable aiplatform.googleapis.com
   gcloud services enable firestore.googleapis.com
   gcloud services enable storage.googleapis.com
   gcloud services enable maps-backend.googleapis.com
   gcloud services enable places-backend.googleapis.com
   ```

3. **Create Service Account**
   ```bash
   gcloud iam service-accounts create photo-mapper-service \
     --display-name="Photo Mapper Service Account"
   
   gcloud projects add-iam-policy-binding your-project-id \
     --member="serviceAccount:photo-mapper-service@your-project-id.iam.gserviceaccount.com" \
     --role="roles/storage.admin"
   
   gcloud projects add-iam-policy-binding your-project-id \
     --member="serviceAccount:photo-mapper-service@your-project-id.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   
   gcloud projects add-iam-policy-binding your-project-id \
     --member="serviceAccount:photo-mapper-service@your-project-id.iam.gserviceaccount.com" \
     --role="roles/datastore.user"
   
   gcloud iam service-accounts keys create ./service-account-key.json \
     --iam-account=photo-mapper-service@your-project-id.iam.gserviceaccount.com
   ```

4. **Create Cloud Storage Bucket**
   ```bash
   gsutil mb gs://your-photo-mapper-bucket
   gsutil iam ch allUsers:objectViewer gs://your-photo-mapper-bucket
   ```

5. **Initialize Firestore Database**
   ```bash
   gcloud firestore databases create --region=us-central1
   ```

6. **Get Google Maps API Key**
   - Go to Google Cloud Console > APIs & Services > Credentials
   - Create API Key and restrict it to Maps JavaScript API
   - Enable Places API if needed for location search
````
