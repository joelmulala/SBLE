const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'utf8').slice(0, 32);

/**
 * Encrypts a file and saves it with .enc extension.
 * Returns the encrypted file path.
 */
const encryptFile = (inputPath) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encryptedPath = inputPath + '.enc';

  const input = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(encryptedPath);

  // Prepend IV to the encrypted file for use during decryption
  output.write(iv);

  return new Promise((resolve, reject) => {
    input.pipe(cipher).pipe(output);
    output.on('finish', () => {
      fs.unlinkSync(inputPath); // remove plaintext file
      resolve(encryptedPath);
    });
    output.on('error', reject);
  });
};

/**
 * Decrypts a .enc file and streams it to the response.
 */
const decryptFileToStream = (encryptedPath, outputStream) => {
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(encryptedPath);
    let iv = null;
    let decipher = null;
    let ivBuffer = Buffer.alloc(0);

    input.on('data', (chunk) => {
      if (!iv) {
        ivBuffer = Buffer.concat([ivBuffer, chunk]);
        if (ivBuffer.length >= 16) {
          iv = ivBuffer.slice(0, 16);
          decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
          decipher.pipe(outputStream);
          decipher.write(ivBuffer.slice(16));
        }
      } else {
        decipher.write(chunk);
      }
    });

    input.on('end', () => { if (decipher) decipher.end(); resolve(); });
    input.on('error', reject);
    outputStream.on('error', reject);
  });
};

module.exports = { encryptFile, decryptFileToStream };
