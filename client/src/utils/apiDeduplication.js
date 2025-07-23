// client/src/utils/apiDeduplication.js
/**
 * API Request Deduplication Utility
 * Prevents duplicate API calls by caching in-flight requests
 */

class RequestDeduplicator {
  constructor() {
    this.inFlightRequests = new Map();
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5 seconds default cache
  }

  /**
   * Make a deduplicated request
   * @param {string} key - Unique key for the request
   * @param {Function} requestFn - Function that returns a Promise
   * @param {Object} options - Options for caching
   * @returns {Promise} - The result of the request
   */
  async request(key, requestFn, options = {}) {
    const { 
      cache = true, 
      cacheTime = this.cacheTimeout,
      forceRefresh = false 
    } = options;

    // Check if we should use cached data
    if (cache && !forceRefresh && this.cache.has(key)) {
      const cached = this.cache.get(key);
      if (Date.now() - cached.timestamp < cacheTime) {
        return cached.data;
      }
    }

    // Check if request is already in flight
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key);
    }

    // Make the request
    const requestPromise = requestFn()
      .then(data => {
        // Cache the successful result
        if (cache) {
          this.cache.set(key, {
            data,
            timestamp: Date.now()
          });
        }
        return data;
      })
      .finally(() => {
        // Remove from in-flight requests
        this.inFlightRequests.delete(key);
      });

    // Store the in-flight request
    this.inFlightRequests.set(key, requestPromise);

    return requestPromise;
  }

  /**
   * Clear cache for a specific key or all cache
   * @param {string} key - Optional key to clear specific cache
   */
  clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Clear all in-flight requests (use with caution)
   */
  clearInFlight() {
    this.inFlightRequests.clear();
  }
}

// Create a singleton instance
const deduplicator = new RequestDeduplicator();

// Enhanced API wrapper with deduplication
export const dedupApi = {
  // User related methods with deduplication
  getUserProfile: () => 
    deduplicator.request('user-profile', () => 
      fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }).then(res => res.json())
    ),

  getPermissions: () =>
    deduplicator.request('user-permissions', () =>
      fetch('/api/user/permissions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }).then(res => res.json())
    ),

  getUserSettings: () =>
    deduplicator.request('user-settings', () =>
      fetch('/api/user/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }).then(res => res.json())
    ),

  getBreaks: () =>
    deduplicator.request('breaks', () =>
      fetch('/api/breaks', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }).then(res => res.json()),
      { cacheTime: 30000 } // Cache breaks for 30 seconds
    ),

  getUserStatus: () =>
    deduplicator.request('user-status', () =>
      fetch('/api/user/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }).then(res => res.json()),
      { cacheTime: 3000 } // Short cache for status
    ),

  // Force refresh methods
  refreshProfile: () =>
    deduplicator.request('user-profile', () =>
      fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }).then(res => res.json()),
      { forceRefresh: true }
    ),

  // Clear cache on logout
  clearAllCache: () => {
    deduplicator.clearCache();
    deduplicator.clearInFlight();
  }
};

export default deduplicator;