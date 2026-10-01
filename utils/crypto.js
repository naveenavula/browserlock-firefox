/**
 * BrowserLock - Crypto Utilities
 * SHA-256 hashing using Web Crypto API
 */

const CryptoUtils = {
  /**
   * Hash a string using SHA-256
   * @param {string} text - The text to hash
   * @returns {Promise<string>} - Hex-encoded hash
   */
  async sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  },

  /**
   * Verify a password against a stored hash
   * @param {string} password - The password to verify
   * @param {string} storedHash - The stored hash to compare against
   * @returns {Promise<boolean>} - True if password matches
   */
  async verifyPassword(password, storedHash) {
    const hash = await this.sha256(password);
    return hash === storedHash;
  }
};

// Make available in both background scripts and content scripts
if (typeof window !== 'undefined') {
  window.CryptoUtils = CryptoUtils;
}
