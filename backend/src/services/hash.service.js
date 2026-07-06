const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

class HashService {
  /**
   * Encodes a given integer ID into a Base62 string.
   * @param {number} num 
   * @returns {string}
   */
  static encode(num) {
    if (num === 0) return BASE62[0];
    let str = "";
    while (num > 0) {
      str = BASE62[num % 62] + str;
      num = Math.floor(num / 62);
    }
    return str;
  }

  /**
   * Decodes a Base62 string back to an integer ID.
   * @param {string} str 
   * @returns {number}
   */
  static decode(str) {
    let num = 0;
    for (let i = 0; i < str.length; i++) {
      num = num * 62 + BASE62.indexOf(str[i]);
    }
    return num;
  }
  
  /**
   * Generates a random short string (fallback method)
   * @param {number} length 
   * @returns {string}
   */
  static generateRandom(length = 7) {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += BASE62.charAt(Math.floor(Math.random() * BASE62.length));
    }
    return result;
  }
}

module.exports = HashService;
