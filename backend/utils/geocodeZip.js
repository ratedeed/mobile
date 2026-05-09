const axios = require('axios');

async function geocodeZip(zipString) {
  try {
    // We expect zipString to be something like "48201" or "48201, Detroit"
    // Using Nominatim API from OpenStreetMap
    // Using a delay to respect the 1 req/sec limit if needed, but for simple use cases it's fine.
    
    // Extract just the digits if it's a mixed string
    const zipCodeMatch = zipString.match(/\b\d{5}\b/);
    const query = zipCodeMatch ? zipCodeMatch[0] : zipString;
    
    console.log(`Geocoding zip code: ${query}`);
    
    const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: query + ' USA',
        format: 'json',
        limit: 1,
        polygon_geojson: 1
      },
      headers: {
        'User-Agent': 'RateDeed/1.0 (contact@ratedeed.com)'
      }
    });

    if (response.data && response.data.length > 0) {
      const data = response.data[0];
      
      // Bounding box format: [latMin, latMax, lonMin, lonMax]
      // We want: [[swLat, swLon], [neLat, neLon]]
      const bbox = data.boundingbox;
      const bounds = [
        [parseFloat(bbox[0]), parseFloat(bbox[2])], // SW
        [parseFloat(bbox[1]), parseFloat(bbox[3])]  // NE
      ];
      
      return {
        zip: query,
        name: data.display_name.split(',')[0],
        center: [parseFloat(data.lat), parseFloat(data.lon)],
        bounds: bounds,
        polygon: data.geojson // The actual polygon from nominatim
      };
    }
  } catch (error) {
    console.error(`Geocoding failed for ${zipString}:`, error.message);
  }
  return null;
}

module.exports = { geocodeZip };