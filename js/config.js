/**
 * API Configuration for PokéAgent GitHub Pages
 * 
 * Controls integration with the Flask API server for live leaderboard data
 */

export const API_CONFIG = {
  // Base URL of the Flask API server
  BASE_URL: 'https://replays.pokeagentshowdown.com:8443',
  
  // Toggle between live API and static JSON
  // Set to false to use only static files (fallback mode)
  USE_LIVE_DATA: true,
  
  // API endpoints
  ENDPOINTS: {
    LEADERBOARD: '/api/leaderboard/live',
    H2H: '/api/h2h'
  },
  
  // Fallback data sources (used when API fails or USE_LIVE_DATA is false)
  FALLBACK: {
    LEADERBOARD_JSON: 'leaderboard/track1_qualifying.json',
    H2H_TSV_DIR: 'leaderboard/showdown_tsvs'
  },
  
  // Request settings
  TIMEOUT_MS: 5000,           // 5 second timeout
  RETRY_ATTEMPTS: 2,          // Number of retry attempts on failure
  RETRY_DELAY_MS: 1000,       // Delay between retries
  
  // Display settings
  TIMEZONE: 'America/Chicago',
  DATE_FORMAT: {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }
};

/**
 * Convert username to H2H lookup key (lowercase, alphanumeric only)
 * @param {string} username - Original username
 * @returns {string} H2H lookup key
 */
export function usernameToH2HKey(username) {
  return username.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Format ISO timestamp for display in Central Time
 * @param {string} isoString - ISO 8601 timestamp
 * @returns {string} Formatted timestamp
 */
export function formatTimestamp(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      timeZone: API_CONFIG.TIMEZONE,
      ...API_CONFIG.DATE_FORMAT
    }) + ' CT';
  } catch (error) {
    console.warn('[Config] Error formatting timestamp:', error);
    return isoString;
  }
}

