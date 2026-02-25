const sharp = require('sharp');
const fs = require('fs');

const innerSvg = `
  <!-- Shadow -->
  <ellipse cx="100" cy="170" fill="rgba(0,0,0,0.08)" rx="60" ry="10"></ellipse>
  <!-- Wing Back -->
  <path d="M40,110 Q20,100 25,80 Q45,85 55,105" fill="white"></path>
  <!-- Shoe Body -->
  <path d="M45,135 Q40,145 60,150 L140,150 Q165,150 170,130 Q175,100 150,85 Q120,70 80,85 Q50,100 45,135" fill="white" stroke="#e2e8f0" stroke-width="2"></path>
  <!-- Grey Accents -->
  <path d="M140,150 Q165,150 170,130 L155,125 Q150,140 135,140 Z" fill="#f1f5f9"></path>
  <!-- Laces (Yellow) -->
  <path d="M85,95 L115,105" stroke="#fbbf24" stroke-linecap="round" stroke-width="6"></path>
  <path d="M92,110 L122,120" stroke="#fbbf24" stroke-linecap="round" stroke-width="6"></path>
  <!-- Wing Front -->
  <path d="M35,120 Q15,110 20,90 Q40,95 50,115" fill="white"></path>
  <!-- Expressive Eyes -->
  <circle cx="130" cy="105" fill="#1e293b" r="5"></circle>
  <circle cx="155" cy="115" fill="#1e293b" r="5"></circle>
  <!-- Blushes -->
  <circle cx="125" cy="115" fill="#fda4af" opacity="0.6" r="3"></circle>
  <circle cx="160" cy="125" fill="#fda4af" opacity="0.6" r="3"></circle>
`;

const monochromeInnerSvg = `
  <!-- Shoe Silhouette -->
  <path d="M40,110 Q20,100 25,80 Q45,85 55,105 
           M45,135 Q40,145 60,150 L140,150 Q165,150 170,130 Q175,100 150,85 Q120,70 80,85 Q50,100 45,135 
           M35,120 Q15,110 20,90 Q40,95 50,115" fill="black"></path>
`;

const createSvg = (withBg, isMonochrome) => `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${withBg ? '<rect width="1024" height="1024" fill="#58CC02" />' : ''}
  <g transform="translate(192, 192) scale(3.2)">
    ${isMonochrome ? monochromeInnerSvg : innerSvg}
  </g>
</svg>
`;

const bgOnlySvg = `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#58CC02" />
</svg>
`;

async function main() {
    console.log('Generating app icon...');
    await sharp(Buffer.from(createSvg(true, false))).resize(1024, 1024).png().toFile('./assets/images/icon.png');

    console.log('Generating adaptive icon foreground...');
    await sharp(Buffer.from(createSvg(false, false))).resize(1024, 1024).png().toFile('./assets/images/android-icon-foreground.png');

    console.log('Generating adaptive icon background...');
    await sharp(Buffer.from(bgOnlySvg)).resize(1024, 1024).png().toFile('./assets/images/android-icon-background.png');

    console.log('Generating adaptive monochrome icon...');
    await sharp(Buffer.from(createSvg(false, true))).resize(1024, 1024).png().toFile('./assets/images/android-icon-monochrome.png');

    console.log('Generating splash icon (transparent)...');
    await sharp(Buffer.from(createSvg(false, false))).resize(200, 200).png().toFile('./assets/images/splash-icon.png');

    console.log('Generating favicon...');
    await sharp(Buffer.from(createSvg(true, false))).resize(48, 48).png().toFile('./assets/images/favicon.png');

    console.log('Done!');
}

main().catch(console.error);
