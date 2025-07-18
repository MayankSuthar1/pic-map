import React, { useState } from 'react';
import EXIF from 'exif-js';

interface ExifData {
  GPSLatitude?: number[];
  GPSLatitudeRef?: string;
  GPSLongitude?: number[];
  GPSLongitudeRef?: string;
  [key: string]: unknown;
}

interface PhotoData {
  file: File;
  exifData: ExifData;
  gpsData: { lat: number; lng: number } | null;
  timestamp: string;
  hasGpsData: boolean;
  userContext?: string;
}

interface PhotoUploadProps {
  onPhotoProcessed: (photoData: PhotoData) => void;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ onPhotoProcessed }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [userContext, setUserContext] = useState('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      processPhoto(file);
    }
  };

  const processPhoto = (file: File) => {
    setProcessing(true);

    // Use EXIF.getData with type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (EXIF as any).getData(file, function(this: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exifData = (EXIF as any).getAllTags(this);
      const gpsData = extractGPSData(exifData);

      onPhotoProcessed({
        file,
        exifData,
        gpsData,
        timestamp: new Date().toISOString(),
        hasGpsData: gpsData !== null,
        userContext: userContext.trim() || undefined
      });

      setProcessing(false);
    });
  };

  const extractGPSData = (exifData: ExifData): { lat: number; lng: number } | null => {
    if (!exifData.GPSLatitude || !exifData.GPSLongitude || 
        !exifData.GPSLatitudeRef || !exifData.GPSLongitudeRef) {
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

  const convertDMSToDD = (degrees: number, minutes: number, seconds: number, direction: string): number => {
    let dd = degrees + (minutes/60) + (seconds/3600);
    if (direction === "S" || direction === "W") {
      dd = dd * -1;
    }
    return dd;
  };

  return (
    <div className="photo-upload bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload Photo</h2>
      
      <div className="space-y-4">
        {/* Context Input Field */}
        <div className="space-y-2">
          <label htmlFor="userContext" className="block text-sm font-medium text-gray-700">
            Add location context (optional)
          </label>
          <textarea
            id="userContext"
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            placeholder="e.g., &quot;at my house in downtown Seattle&quot;, &quot;hiking trail in Rocky Mountain National Park&quot;, &quot;Main Street near the coffee shop&quot;"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
          <p className="text-xs text-gray-500">
            Help AI identify your photo&apos;s location by describing where it was taken. This is especially helpful for everyday places without GPS data.
          </p>
        </div>

        {/* File Upload */}
        <div className="border-2 border-dashed border-gray-300 p-6 rounded-lg hover:border-blue-500 transition-colors">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={processing}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {processing && (
            <div className="mt-4 flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <p className="text-blue-600">Processing photo...</p>
            </div>
          )}
          {selectedFile && !processing && (
            <div className="mt-4">
              <p className="text-green-600">✓ {selectedFile.name} selected</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoUpload;
