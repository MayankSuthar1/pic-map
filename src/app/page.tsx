'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import PhotoUpload from '@/components/PhotoUpload';

// Dynamically import PhotoMap to prevent SSR issues
const PhotoMap = dynamic(() => import('@/components/PhotoMap'), {
  ssr: false,
  loading: () => <div className="h-96 lg:h-[500px] rounded-lg bg-gray-100 flex items-center justify-center">Loading map...</div>
});

interface PhotoData {
  id: string;
  url: string;
  gpsData: { lat: number; lng: number };
  timestamp: string;
  caption?: string;
  labels?: string[];
  landmarks?: string[];
  locationSource?: string;
}

interface PhotoUploadData {
  file: File;
  gpsData: { lat: number; lng: number } | null;
  timestamp: string;
  hasGpsData: boolean;
  userContext?: string;
}

interface VisionAnalysisResult {
  aiCaption: string;
  labels?: Array<{ description: string }>;
  landmarks?: Array<{ description: string }>;
  aiDetectedLocation?: { lat: number; lng: number } | null;
  locationSource?: string;
}

export default function Home() {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const photoIdCounter = useRef(0);

  const handlePhotoUpload = async (photoData: PhotoUploadData) => {
    setIsLoading(true);
    try {
      // Create a FormData object for the API call
      const formData = new FormData();
      formData.append('image', photoData.file);
      formData.append('hasGpsData', photoData.hasGpsData.toString());
      if (photoData.userContext) {
        formData.append('userContext', photoData.userContext);
      }

      // Call our analyze-image API
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to analyze image');
      }

      const analysisResult: VisionAnalysisResult = await response.json();

      // Create a URL for the uploaded image (in a real app, you'd upload to cloud storage)
      const imageUrl = URL.createObjectURL(photoData.file);

      // Determine location: use GPS if available, otherwise use AI-detected location
      let finalLocation = photoData.gpsData;
      let locationSource = 'gps';

      if (!photoData.hasGpsData && analysisResult.aiDetectedLocation) {
        finalLocation = analysisResult.aiDetectedLocation;
        locationSource = analysisResult.locationSource || 'ai';
      }

      // If no location at all, use a default location (San Francisco)
      if (!finalLocation) {
        finalLocation = { lat: 37.7749, lng: -122.4194 };
        locationSource = 'default';
      }

      // Create new photo data
      const newPhoto: PhotoData = {
        id: `photo_${++photoIdCounter.current}`,
        url: imageUrl,
        gpsData: finalLocation,
        timestamp: photoData.timestamp,
        caption: analysisResult.aiCaption,
        labels: analysisResult.labels?.map((l) => l.description).slice(0, 5) || [],
        landmarks: analysisResult.landmarks?.map((l) => l.description) || [],
        locationSource: locationSource,
      };

      setPhotos(prev => [...prev, newPhoto]);
      setSelectedPhoto(newPhoto);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload and analyze photo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkerClick = (photo: PhotoData | null) => {
    setSelectedPhoto(photo);
  };

  const handlePhotoSelect = (photo: PhotoData) => {
    setSelectedPhoto(photo);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">📸</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Photo Mapper</h1>
            </div>
            <div className="text-sm text-gray-600">
              {photos.length} photo{photos.length !== 1 ? 's' : ''} mapped
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Photo</h2>
              <PhotoUpload onPhotoProcessed={handlePhotoUpload} />
              
              {/* Loading State */}
              {isLoading && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-blue-700">
                      Analyzing your photo and detecting location with AI...
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-blue-600">
                    🔍 Using Vision API to identify landmarks, text, and objects for location detection
                  </div>
                </div>
              )}

              {/* Selected Photo Details */}
              {selectedPhoto && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Photo Details</h3>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Caption:</span> {selectedPhoto.caption}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Location:</span> {selectedPhoto.gpsData.lat.toFixed(4)}, {selectedPhoto.gpsData.lng.toFixed(4)}
                      {selectedPhoto.locationSource && (
                        <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedPhoto.locationSource === 'gps' 
                            ? 'bg-green-100 text-green-800' 
                            : selectedPhoto.locationSource === 'user_context'
                            ? 'bg-blue-100 text-blue-800'
                            : selectedPhoto.locationSource === 'context_enhanced'
                            ? 'bg-indigo-100 text-indigo-800'
                            : selectedPhoto.locationSource === 'landmark'
                            ? 'bg-purple-100 text-purple-800'
                            : selectedPhoto.locationSource === 'text'
                            ? 'bg-orange-100 text-orange-800'
                            : selectedPhoto.locationSource === 'label'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedPhoto.locationSource === 'gps' && '📍 GPS'}
                          {selectedPhoto.locationSource === 'user_context' && '💭 User Context'}
                          {selectedPhoto.locationSource === 'context_enhanced' && '🎯 Enhanced AI'}
                          {selectedPhoto.locationSource === 'landmark' && '🏛️ AI Landmark'}
                          {selectedPhoto.locationSource === 'text' && '📝 AI Text'}
                          {selectedPhoto.locationSource === 'label' && '🏷️ AI Label'}
                          {selectedPhoto.locationSource === 'default' && '🌐 Default'}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Time:</span> {new Date(selectedPhoto.timestamp).toLocaleString()}
                    </p>
                    {selectedPhoto.labels && selectedPhoto.labels.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Detected:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedPhoto.labels.map((label: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedPhoto.landmarks && selectedPhoto.landmarks.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Landmarks:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedPhoto.landmarks.map((landmark: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                            >
                              {landmark}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Photo Map</h2>
              <div className="h-96 lg:h-[500px] rounded-lg overflow-hidden">
                <PhotoMap 
                  photos={photos} 
                  selectedPhoto={selectedPhoto}
                  onMarkerClick={handleMarkerClick}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Photo Gallery */}
        {photos.length > 0 && (
          <div className="mt-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Photo Gallery</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className={`relative cursor-pointer rounded-lg overflow-hidden transition-transform hover:scale-105 ${
                      selectedPhoto?.id === photo.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => handlePhotoSelect(photo)}
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Uploaded photo'}
                      className="w-full h-24 object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                      <p className="truncate">{photo.caption}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {photos.length === 0 && !isLoading && (
          <div className="mt-8 text-center">
            <div className="bg-white rounded-xl shadow-lg p-12">
              <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">📷</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No photos yet</h3>
              <p className="text-gray-600 mb-4">Upload your first photo to start mapping your memories!</p>
              
              {/* AI Location Detection Info */}
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">🤖 Smart Location Detection</h4>
                <p className="text-xs text-gray-600 text-left">
                  Don't have GPS data? No problem! Our AI can detect locations by:
                </p>
                <ul className="text-xs text-gray-600 text-left mt-2 space-y-1">
                  <li>🏛️ <strong>Landmarks:</strong> Famous buildings, monuments, and tourist attractions</li>
                  <li>📝 <strong>Text recognition:</strong> Signs, addresses, and place names in photos</li>
                  <li>🏷️ <strong>Object detection:</strong> Recognizing location-specific objects and buildings</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>Photo Mapper PWA - Powered by Google Cloud Vision API</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
