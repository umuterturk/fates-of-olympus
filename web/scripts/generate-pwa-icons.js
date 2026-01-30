/**
 * PWA Icon Generator Script
 * 
 * This script generates PNG icons from the logo for PWA installation.
 * 
 * Usage: node scripts/generate-pwa-icons.js
 * 
 * Prerequisites: npm install sharp
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

// Use the main logo as the source for PWA icons
const logoPath = join(publicDir, 'fates-of-olympus-logo.png');

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'pwa-maskable-512x512.png', size: 512, maskable: true },
];

async function generateIcons() {
  console.log('Generating PWA icons from fates-of-olympus-logo.png...\n');
  
  const themeColor = { r: 26, g: 26, b: 46, alpha: 1 }; // #1a1a2e - matches theme color
  
  for (const { name, size, maskable } of sizes) {
    const outputPath = join(publicDir, name);
    
    if (maskable) {
      // Maskable icons need 10% padding (safe zone) on all sides
      // So the actual image is 80% of the total size
      const innerSize = Math.floor(size * 0.8);
      const padding = Math.floor((size - innerSize) / 2);
      
      const resizedImage = await sharp(logoPath)
        .resize(innerSize, innerSize, {
          fit: 'contain',
          background: themeColor
        })
        .toBuffer();
      
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: themeColor
        }
      })
        .composite([{ input: resizedImage, left: padding, top: padding }])
        .png()
        .toFile(outputPath);
    } else {
      await sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: themeColor
        })
        .png()
        .toFile(outputPath);
    }
    
    console.log(`✓ Generated ${name} (${size}x${size})${maskable ? ' [maskable]' : ''}`);
  }
  
  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
