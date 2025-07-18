import { NextRequest, NextResponse } from 'next/server';
import { ImageAnnotatorClient, protos } from '@google-cloud/vision';

// Initialize Google Cloud Vision
const vision = new ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

// Helper function to extract potential location strings from text
function extractLocationFromText(text: string): string[] {
  const candidates: string[] = [];
  
  // Look for specific location patterns
  const locationPatterns = [
    // Address patterns
    /(\d+\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Place|Pl))/gi,
    // City, State patterns
    /([A-Z][a-z]{2,}\s*,\s*[A-Z]{2,3}(?:\s+\d{5})?)/g,
    // Landmark or building names with common suffixes
    /([A-Z][a-z]+\s+(?:University|College|School|Hospital|Medical Center|Library|Museum|Theater|Theatre|Center|Centre|Mall|Plaza|Park|Square|Station|Airport|Terminal))/gi,
    // Restaurant or business chains (often have location context)
    /([A-Z][a-z]+\s+(?:Restaurant|Cafe|Coffee|Hotel|Inn|Lodge|Bank|Store|Market|Pharmacy|Gas|Station))/gi,
    // Geographic features
    /([A-Z][a-z]+\s+(?:Lake|River|Mountain|Beach|Bay|Island|Valley|Canyon|Hill|Bridge))/gi,
    // General place names (two or more capitalized words)
    /([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3})/g,
  ];

  for (const pattern of locationPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      candidates.push(...matches.map(match => match.trim()));
    }
  }

  // Remove duplicates and sort by length (longer names often more specific)
  const uniqueCandidates = [...new Set(candidates)];
  return uniqueCandidates.sort((a, b) => b.length - a.length);
}

// Enhanced geocoding function with geographic bias and better filtering
async function geocodeLocation(
  locationString: string, 
  bias?: { lat: number; lng: number }
): Promise<{ lat: number; lng: number } | null> {
  try {
    let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationString)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    
    // Add location bias if available to improve accuracy for local places
    if (bias) {
      url += `&location=${bias.lat},${bias.lng}&radius=50000`; // 50km radius
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      const addressComponents = data.results[0].address_components || [];
      
      // Check if the result seems reasonable (has city/country info)
      const hasValidAddress = addressComponents.some((comp: any) => 
        comp.types.includes('locality') || 
        comp.types.includes('administrative_area_level_1') ||
        comp.types.includes('country')
      );
      
      if (hasValidAddress) {
        return {
          lat: location.lat,
          lng: location.lng
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const hasGpsData = formData.get('hasGpsData') === 'true';
    const userContext = formData.get('userContext') as string;

    if (!file) {
      return NextResponse.json({ message: 'No image file provided' }, { status: 400 });
    }

    // Convert File to Buffer for Vision API
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Perform Vision API analysis
    const [labelResult] = await vision.labelDetection({ image: { content: buffer } });
    const [textResult] = await vision.textDetection({ image: { content: buffer } });
    const [landmarkResult] = await vision.landmarkDetection({ image: { content: buffer } });
    
    // Handle optional object localization
    let objectResult: protos.google.cloud.vision.v1.IAnnotateImageResponse = { localizedObjectAnnotations: [] };
    try {
      if (vision.objectLocalization) {
        [objectResult] = await vision.objectLocalization({ image: { content: buffer } });
      }
    } catch (error) {
      console.warn('Object localization not available:', error);
    }

    const labels = labelResult.labelAnnotations?.map(l => l.description).slice(0, 5) || [];
    const landmarks = landmarkResult.landmarkAnnotations?.map(l => l.description) || [];
    const textAnnotations = textResult.textAnnotations || [];

    // AI-powered location detection when GPS is missing
    let aiDetectedLocation: { lat: number; lng: number } | null = null;
    let locationSource = 'gps';
    let locationBias: { lat: number; lng: number } | null = null;

    if (!hasGpsData) {
      console.log('No GPS data available, attempting AI location detection...');
      
      // PRIORITY 1: Try user context first if provided
      if (userContext && userContext.trim()) {
        console.log('Attempting geocoding for user context:', userContext);
        aiDetectedLocation = await geocodeLocation(userContext.trim());
        if (aiDetectedLocation) {
          locationSource = 'user_context';
          locationBias = aiDetectedLocation; // Use user context location as bias
        }
      }
      
      // PRIORITY 2: Try landmarks (most accurate among automated methods)
      if (!aiDetectedLocation && landmarks.length > 0 && landmarks[0]) {
        console.log('Attempting geocoding for landmark:', landmarks[0]);
        aiDetectedLocation = await geocodeLocation(landmarks[0], locationBias || undefined);
        if (aiDetectedLocation) {
          locationSource = 'landmark';
          if (!locationBias) locationBias = aiDetectedLocation; // Use landmark as bias for further searches
        }
      }

      // Enhanced text-based location detection
      if (!aiDetectedLocation && textAnnotations.length > 0) {
        const allText = textAnnotations.map(t => t.description).join(' ');
        console.log('Searching for location in text:', allText);
        
        // Extract potential location candidates
        const locationCandidates = extractLocationFromText(allText);
        
        // If we have user context, try combining it with detected text
        if (userContext && userContext.trim() && locationCandidates.length > 0) {
          for (const candidate of locationCandidates.slice(0, 3)) {
            const combinedQuery = `${candidate} ${userContext.trim()}`;
            console.log('Attempting geocoding for combined context + text:', combinedQuery);
            aiDetectedLocation = await geocodeLocation(combinedQuery, locationBias || undefined);
            if (aiDetectedLocation) {
              locationSource = 'context_enhanced';
              break;
            }
          }
        }
        
        // Try each candidate with bias if available
        if (!aiDetectedLocation) {
          for (const candidate of locationCandidates.slice(0, 5)) {
            console.log('Attempting geocoding for text location:', candidate);
            aiDetectedLocation = await geocodeLocation(candidate, locationBias || undefined);
            if (aiDetectedLocation) {
              locationSource = 'text';
              break;
            }
          }
        }

        // Fallback: try simpler text patterns if specific ones didn't work
        if (!aiDetectedLocation) {
          const simplePatterns = [
            /([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})/g, // Two capitalized words
            /([A-Z][a-z]+\s+(?:City|Town|Village))/g, // Places with City/Town
          ];

          for (const pattern of simplePatterns) {
            const matches = allText.match(pattern);
            if (matches && matches.length > 0) {
              for (const match of matches.slice(0, 3)) {
                console.log('Attempting geocoding for simple pattern:', match);
                aiDetectedLocation = await geocodeLocation(match.trim(), locationBias || undefined);
                if (aiDetectedLocation) {
                  locationSource = 'text';
                  break;
                }
              }
              if (aiDetectedLocation) break;
            }
          }
        }
      }

      // Only try generic labels as last resort and with strict filtering
      if (!aiDetectedLocation && labels.length > 0) {
        // Be much more selective about which labels to try
        const locationSpecificLabels = labels.filter(label => {
          if (!label) return false;
          
          // Only try labels that are very likely to be location-specific
          const specificLocationTerms = /^(airport|station|terminal|university|college|hospital|museum|library|cathedral|church|temple|mosque|synagogue|stadium|arena|theater|theatre|mall|market|bridge|tower|lighthouse|castle|palace|fort|monument)$/i;
          const buildingTypes = /^(school|hotel|restaurant|cafe|bank|store|shop)$/i;
          
          return specificLocationTerms.test(label) || 
                 (buildingTypes.test(label) && locationBias); // Only try generic building types if we have a bias
        });
        
        for (const label of locationSpecificLabels.slice(0, 2)) {
          if (label) {
            console.log('Attempting geocoding for specific label:', label);
            aiDetectedLocation = await geocodeLocation(label, locationBias || undefined);
            if (aiDetectedLocation) {
              locationSource = 'label';
              break;
            }
          }
        }
      }
    }

    // Generate AI caption
    let aiCaption = 'Beautiful photo captured';
    
    if (landmarks.length > 0) {
      aiCaption = `Photo taken at ${landmarks[0]}`;
    } else if (labels.length > 0) {
      aiCaption = `Photo featuring ${labels.slice(0, 3).join(', ')}`;
    }

    // Add location context to caption if detected by AI
    if (aiDetectedLocation && locationSource !== 'gps') {
      aiCaption += ` (location detected by AI from ${locationSource})`;
    }

    return NextResponse.json({
      labels: labelResult.labelAnnotations || [],
      text: textResult.textAnnotations || [],
      objects: objectResult.localizedObjectAnnotations || [],
      landmarks: landmarkResult.landmarkAnnotations || [],
      aiCaption: aiCaption,
      aiDetectedLocation: aiDetectedLocation,
      locationSource: locationSource,
    });
  } catch (error) {
    console.error('Vision API error:', error);
    return NextResponse.json(
      { message: 'Analysis failed', error: (error as Error).message },
      { status: 500 }
    );
  }
}
