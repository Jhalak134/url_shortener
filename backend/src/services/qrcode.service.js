const QRCode = require('qrcode');

class QRCodeService {
  /**
   * Generates a QR code as a base64 data URL (e.g., "data:image/png;base64,...")
   * for a given short URL. This can be embedded directly in an <img> tag
   * on the frontend without saving any file to disk.
   *
   * @param {string} shortUrl - The full short URL (e.g., "http://localhost:3000/abc123")
   * @returns {Promise<string>} Base64-encoded PNG data URL
   */
  static async generateDataUrl(shortUrl) {
    try {
      const dataUrl = await QRCode.toDataURL(shortUrl, {
        errorCorrectionLevel: 'M', // Medium error correction (15% damage tolerance)
        margin: 2,
        width: 300,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return dataUrl;
    } catch (error) {
      console.error('QRCodeService.generateDataUrl error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generates a QR code and returns it as a raw SVG string.
   * Useful if you want to inline the SVG directly in HTML without an <img> tag.
   *
   * @param {string} shortUrl
   * @returns {Promise<string>} SVG markup string
   */
  static async generateSvg(shortUrl) {
    try {
      return await QRCode.toString(shortUrl, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
      });
    } catch (error) {
      console.error('QRCodeService.generateSvg error:', error);
      throw new Error('Failed to generate QR code SVG');
    }
  }
}

module.exports = QRCodeService;
