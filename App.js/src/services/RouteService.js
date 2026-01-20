import axios from 'axios';

/**
 * RouteService - Google Maps Directions API Integration
 * Provides walking, biking, and transit route recommendations
 */

// Your Google Maps API Key - Fresh key with billing enabled
const GOOGLE_MAPS_API_KEY = 'AIzaSyDRbxFMfeBxVtgFBXY53_LSZjE75Z4bA84';
const DIRECTIONS_API_URL = 'https://maps.googleapis.com/maps/api/directions/json';

class RouteService {
  constructor() {
    this.cachedRoutes = new Map(); // Cache routes to reduce API calls
  }

  /**
   * Get route recommendations for all travel modes
   * @param {Object} origin - { latitude, longitude }
   * @param {Object} destination - { latitude, longitude }
   * @returns {Object} Routes for walking, biking, transit
   */
  async getRouteRecommendations(origin, destination) {
    try {
      console.log('🗺️ Fetching route recommendations...');
      
      // Fetch all three route types in parallel
      const [walkingRoute, bikingRoute, transitRoute] = await Promise.all([
        this.getRoute(origin, destination, 'walking'),
        this.getRoute(origin, destination, 'bicycling'),
        this.getRoute(origin, destination, 'transit'),
      ]);

      const recommendations = {
        walking: walkingRoute,
        biking: bikingRoute,
        transit: transitRoute,
      };

      console.log('✅ Route recommendations loaded');
      return recommendations;
    } catch (error) {
      console.error('❌ Error fetching route recommendations:', error);
      throw error;
    }
  }

  /**
   * Get a single route for a specific travel mode
   * @param {Object} origin - { latitude, longitude }
   * @param {Object} destination - { latitude, longitude }
   * @param {string} mode - 'walking', 'bicycling', 'transit', or 'driving'
   * @returns {Object} Route details
   */
  async getRoute(origin, destination, mode = 'walking') {
    try {
      // Create cache key
      const cacheKey = `${origin.latitude},${origin.longitude}-${destination.latitude},${destination.longitude}-${mode}`;
      
      // Check cache first
      if (this.cachedRoutes.has(cacheKey)) {
        console.log(`📦 Using cached ${mode} route`);
        return this.cachedRoutes.get(cacheKey);
      }

      const params = {
        origin: `${origin.latitude},${origin.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        mode: mode,
        key: GOOGLE_MAPS_API_KEY,
        alternatives: true, // Get multiple route options
      };

      console.log(`🔍 Fetching ${mode} route...`);
      const response = await axios.get(DIRECTIONS_API_URL, { params });

      if (response.data.status === 'OK' && response.data.routes.length > 0) {
        const route = this.parseRoute(response.data.routes[0], mode);
        
        // Cache the route
        this.cachedRoutes.set(cacheKey, route);
        
        console.log(`✅ ${mode} route loaded: ${route.duration}`);
        return route;
      } else if (response.data.status === 'ZERO_RESULTS') {
        console.warn(`⚠️ No ${mode} route found`);
        return null;
      } else {
        console.error(`❌ Directions API error: ${response.data.status}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error fetching ${mode} route:`, error.message);
      return null;
    }
  }

  /**
   * Parse Google Directions API response into usable format
   * @param {Object} route - Google Directions API route object
   * @param {string} mode - Travel mode
   * @returns {Object} Parsed route
   */
  parseRoute(route, mode) {
    const leg = route.legs[0]; // First leg of the journey
    
    return {
      mode: mode,
      distance: leg.distance.text, // e.g., "2.0 mi"
      distanceValue: leg.distance.value, // in meters
      duration: leg.duration.text, // e.g., "25 mins"
      durationValue: leg.duration.value, // in seconds
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      steps: this.parseSteps(leg.steps, mode),
      polyline: route.overview_polyline.points, // Encoded polyline
      bounds: route.bounds, // Map bounds
      summary: route.summary, // Route summary (e.g., "Main St")
      // Transit-specific info
      transitDetails: mode === 'transit' ? this.parseTransitDetails(leg) : null,
    };
  }

  /**
   * Parse route steps (turn-by-turn directions)
   * @param {Array} steps - Google Directions API steps
   * @param {string} mode - Travel mode
   * @returns {Array} Parsed steps
   */
  parseSteps(steps, mode) {
    return steps.map((step, index) => ({
      stepNumber: index + 1,
      instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
      distance: step.distance.text,
      duration: step.duration.text,
      travelMode: step.travel_mode,
      // Transit-specific step info
      transitInfo: step.transit_details ? {
        line: step.transit_details.line.short_name || step.transit_details.line.name,
        stops: step.transit_details.num_stops,
        departureTime: step.transit_details.departure_time.text,
        arrivalTime: step.transit_details.arrival_time.text,
        headsign: step.transit_details.headsign,
      } : null,
    }));
  }

  /**
   * Parse transit-specific details
   * @param {Object} leg - Route leg with transit info
   * @returns {Object} Transit details
   */
  parseTransitDetails(leg) {
    const transitSteps = leg.steps.filter(step => step.travel_mode === 'TRANSIT');
    
    if (transitSteps.length === 0) return null;

    return {
      totalStops: transitSteps.reduce((sum, step) => 
        sum + (step.transit_details?.num_stops || 0), 0
      ),
      lines: transitSteps.map(step => ({
        name: step.transit_details.line.short_name || step.transit_details.line.name,
        agency: step.transit_details.line.agencies[0].name,
        vehicle: step.transit_details.line.vehicle.name, // e.g., "Bus", "Subway"
      })),
      departureTime: leg.departure_time?.text,
      arrivalTime: leg.arrival_time?.text,
    };
  }

  /**
   * Get quick route summary (for displaying on map markers)
   * @param {Object} origin - { latitude, longitude }
   * @param {Object} destination - { latitude, longitude }
   * @returns {Object} Quick summary of fastest route
   */
  async getQuickRouteSummary(origin, destination) {
    try {
      const routes = await this.getRouteRecommendations(origin, destination);
      
      // Find fastest route
      const availableRoutes = [
        { mode: 'walking', ...routes.walking },
        { mode: 'biking', ...routes.biking },
        { mode: 'transit', ...routes.transit },
      ].filter(r => r.durationValue);

      if (availableRoutes.length === 0) return null;

      const fastest = availableRoutes.reduce((prev, current) => 
        (current.durationValue < prev.durationValue) ? current : prev
      );

      return {
        mode: fastest.mode,
        duration: fastest.duration,
        distance: fastest.distance,
      };
    } catch (error) {
      console.error('Error getting quick route summary:', error);
      return null;
    }
  }

  /**
   * Decode Google polyline into coordinates
   * @param {string} encoded - Encoded polyline string
   * @returns {Array} Array of {latitude, longitude} points
   */
  decodePolyline(encoded) {
    const poly = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      poly.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return poly;
  }

  /**
   * Clear route cache (call when user location changes significantly)
   */
  clearCache() {
    this.cachedRoutes.clear();
    console.log('🗑️ Route cache cleared');
  }

  /**
   * Get route emoji/icon for display
   * @param {string} mode - Travel mode
   * @returns {string} Emoji
   */
  getModeIcon(mode) {
    const icons = {
      walking: '🚶',
      bicycling: '🚴',
      transit: '🚌',
      driving: '🚗',
    };
    return icons[mode] || '📍';
  }

  /**
   * Format duration in human-readable format
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
}

// Create singleton instance
const routeService = new RouteService();

export default routeService;
