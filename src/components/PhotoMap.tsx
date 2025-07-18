import React from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';

interface Photo {
  id: string;
  url: string;
  caption?: string;
  gpsData: { lat: number; lng: number };
  timestamp: string;
  labels?: string[];
  landmarks?: string[];
}

interface PhotoMapProps {
  photos: Photo[];
  selectedPhoto: Photo | null;
  onMarkerClick: (photo: Photo | null) => void;
}

const PhotoMap: React.FC<PhotoMapProps> = ({ photos, selectedPhoto, onMarkerClick }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  });

  const mapCenter = photos.length > 0 ? 
    { lat: photos[0].gpsData.lat, lng: photos[0].gpsData.lng } :
    { lat: 0, lng: 0 };

  if (!isLoaded) {
    return (
      <div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading Map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-96 rounded-lg overflow-hidden shadow-md">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={mapCenter}
        zoom={10}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        {photos.map((photo, index) => (
          photo.gpsData && (
            <Marker
              key={index}
              position={{ lat: photo.gpsData.lat, lng: photo.gpsData.lng }}
              onClick={() => onMarkerClick(photo)}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="18" fill="#4285f4" stroke="white" stroke-width="2"/>
                    <text x="20" y="25" text-anchor="middle" fill="white" font-size="16">📷</text>
                  </svg>
                `),
                scaledSize: new google.maps.Size(40, 40),
              }}
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
            <div className="p-2 max-w-sm">
              <img 
                src={selectedPhoto.url} 
                alt="Photo" 
                className="w-48 h-32 object-cover rounded mb-2" 
              />
              <p className="text-sm text-gray-700">{selectedPhoto.caption || 'Photo'}</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default PhotoMap;
