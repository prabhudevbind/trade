// Simple cache object
const optionChainCache = {};

// Helper to get cache key
export function getOptionChainCacheKey({ expiry_date, instrument_key }) {
  return `${expiry_date}_${instrument_key}`;
}

// Get from cache (returns null if expired or not found)
export function getOptionChainFromCache(params, maxAgeMs = 10000) {
  const key = getOptionChainCacheKey(params);
  const entry = optionChainCache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAgeMs) {
    delete optionChainCache[key];
    return null;
  }
  return entry.data;
}

// Set cache
export function setOptionChainCache(params, data) {
  const key = getOptionChainCacheKey(params);
  optionChainCache[key] = {
    data,
    timestamp: Date.now(),
  };
}