/**
 * Design System Extractor Engine
 * Logic for token normalization and component identification.
 */

export interface DesignTokens {
  colors: Record<string, string>;
  fontSizes: Record<string, string>;
  spacing: Record<string, string>;
  radii: Record<string, string>;
  fonts: string[];
}

export interface ComponentSpec {
  name: string;
  selector: string;
  html: string;
  styles: string[];
}

export interface DesignSystemData {
  tokens: DesignTokens;
  components: ComponentSpec[];
}

function parseToHex(c: string): string | null {
  c = c.trim().toLowerCase();
  
  if (c.startsWith('#')) {
    if (c.length === 5 || c.length === 9) { // #RGBA or #RRGGBBAA
      const alpha = c.length === 5 ? parseInt(c[4]+c[4], 16) : parseInt(c.slice(7,9), 16);
      if (alpha < 10) return null; // practically transparent
    }
    if (c.length === 4 || c.length === 5) return '#' + c[1]+c[1]+c[2]+c[2]+c[3]+c[3];
    return c.substring(0,7); 
  }
  
  if (c.startsWith('rgb')) {
    const match = c.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      if (match.length >= 4 && parseFloat(match[3]) < 0.05) return null;
      const r = parseInt(match[0]).toString(16).padStart(2, '0');
      const g = parseInt(match[1]).toString(16).padStart(2, '0');
      const b = parseInt(match[2]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
  }

  if (c.startsWith('hsl')) {
    const match = c.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      if (match.length >= 4 && parseFloat(match[3]) < 0.05) return null;
      let h = parseFloat(match[0]) / 360;
      let s = parseFloat(match[1]) / 100;
      let l = parseFloat(match[2]) / 100;
      let r, g, b;
      if (s === 0) {
        r = g = b = l; 
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }
  return c;
}

/**
 * Normalizes colors to group "near-matches"
 */
function normalizeColors(colors: string[]): Record<string, string> {
  const freqMap: Record<string, number> = {};
  colors.forEach(rawC => { const color = parseToHex(rawC); if (color && color.startsWith('#')) { freqMap[color] = (freqMap[color] || 0) + 1; } });

  const unique = Object.keys(freqMap)
    .sort((a, b) => freqMap[b] - freqMap[a])
    .slice(0, 12); // Limit to top 12 most frequent colors

  const tokens: Record<string, string> = {};
  
  unique.forEach((color, i) => {
    let name = `color-primary-${i + 1}`;
    if (color === '#ffffff' || color === 'white') name = 'bg-primary';
    if (color === '#000000' || color === 'black') name = 'text-primary';
    tokens[name] = color;
  });

  return tokens;
}

export function extractDesignSystem(html: string, css: string): DesignSystemData {
  // 1. Extract Colors (Hex, RGB, RGBA)
  const colorRegex = /#([a-fA-F0-9]{8}|[a-fA-F0-9]{6}|[a-fA-F0-9]{4}|[a-fA-F0-9]{3})\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)|hsla?\(\s*[\d.]+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(?:\s*,\s*[\d.]+)?\s*\)/gi;
  const rawColors = css.match(colorRegex) || [];
  const normalizedColors = normalizeColors(rawColors);

  // 2. Extract Font Sizes
  const fontSizeRegex = /font-size:\s*([^;]+);/g;
  let fontVals: string[] = [];
  let match;
  while ((match = fontSizeRegex.exec(css)) !== null) {
    fontVals.push(match[1].trim());
  }
  const uniqueFonts = Array.from(new Set(fontVals)).slice(0, 15);
  const fontSizes: Record<string, string> = {};
  uniqueFonts.forEach((val, i) => fontSizes[`text-${i+1}`] = val);

  // 3. Extract Spacing (Margin, Padding, Gap)
  const spacingRegex = /(?:margin|padding|gap):\s*([^;]+);/g;
  let spaceVals: string[] = [];
  while ((match = spacingRegex.exec(css)) !== null) {
    spaceVals.push(match[1].trim());
  }
  const uniqueSpacing = Array.from(new Set(spaceVals)).slice(0, 15);
  const spacing: Record<string, string> = {};
  uniqueSpacing.forEach((val, i) => spacing[`space-${i+1}`] = val);

  // Extract Radii
  const radiusRegex = /border-radius:\s*([^;}]+)/g;
  let radiusVals: string[] = [];
  while ((match = radiusRegex.exec(css)) !== null) {
    radiusVals.push(match[1].trim());
  }
  
  const countMap: Record<string, number> = {};
  for (const v of radiusVals) { countMap[v] = (countMap[v] || 0) + 1; }
  
  let uniqueRadii = Object.keys(countMap).sort((a,b) => countMap[b] - countMap[a]).slice(0, 10);

  const radii: Record<string, string> = {};
  uniqueRadii.forEach((val, i) => radii[`radius-${i+1}`] = val);

  // Extract Fonts
  const fontRegex = /font-family:\s*([^;]+);/g;
  let fontFamilies: string[] = [];
  while ((match = fontRegex.exec(css)) !== null) {
    const f = match[1].trim().replace(/['"]/g, '');
    if (f !== 'inherit' && f !== 'initial') {
        // Just split by comma and take first valid one
        fontFamilies.push(f.split(',')[0].trim());
    }
  }
  const uniqueFontFamilies = Array.from(new Set(fontFamilies)).filter(Boolean).slice(0, 5);

  // 4. Extract Component Patterns (Rudimentary logic using DOMParser)
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const components: ComponentSpec[] = [];

  // Identify Buttons as a primary example
  const buttons = doc.querySelectorAll('button, .btn, .button');
  if (buttons.length > 0) {
    const btn = buttons[0];
    components.push({
      name: 'Button',
      selector: btn.className ? `.${btn.className.split(' ').join('.')}` : 'button',
      html: btn.outerHTML,
      styles: [] // In a full implementation, we'd find matching CSS rules
    });
  }

  // Identify Cards
  const cards = doc.querySelectorAll('.card, .container, section');
  if (cards.length > 0) {
    const card = cards[0];
    components.push({
      name: 'Container/Card',
      selector: card.className ? `.${card.className.split(' ').join('.')}` : 'div',
      html: card.outerHTML.substring(0, 300) + '...',
      styles: []
    });
  }

  return {
    tokens: {
      colors: normalizedColors,
      fontSizes,
      spacing,
      radii,
      fonts: uniqueFontFamilies.length > 0 ? uniqueFontFamilies : ['Inter', 'sans-serif']
    },
    components,
  };
}

export function generateMarkdown(data: DesignSystemData, title: string = 'Extracted Theme'): string {
  let md = `---
name: ${title.replace(/:/g, '')}
version: "alpha"
description: Extracted design system
colors:
`;

  // Colors
  const validColors = Object.entries(data.tokens.colors).filter(([_, val]) => val.startsWith('#'));
  if (validColors.length === 0) {
    validColors.push(['primary', '#000000']);
  }
  
  validColors.forEach(([name, val], i) => {
    // Simplify names a bit for spec
    let safeName = name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    if (i === 0 && !validColors.find(c => c[0] === 'primary')) safeName = 'primary';
    md += `  ${safeName}: "${val}"\n`;
  });

  // Typography
  md += `typography:\n`;
  Object.entries(data.tokens.fontSizes).slice(0, 5).forEach(([name, val], i) => {
    md += `  body-${i+1}:\n`;
    md += `    fontFamily: sans-serif\n`;
    md += `    fontSize: ${val}\n`;
  });

  // Spacing
  md += `spacing:\n`;
  Object.entries(data.tokens.spacing).slice(0, 5).forEach(([name, val], i) => {
    const safeVal = val.split(' ')[0]; // Take first value if there are multiples like "10px 20px"
    if (/^\d/i.test(safeVal)) {
      md += `  space-${i+1}: ${safeVal}\n`;
    }
  });

  // Components
  md += `components:\n`;
  data.components.slice(0, 3).forEach((comp, i) => {
    const compName = comp.name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    md += `  ${compName}:\n`;
    // Add dummy or extracted values
    md += `    padding: "16px"\n`;
  });

  md += `---\n\n`;

  // Markdown Body
  md += `## Overview\n\n`;
  md += `This design system was auto-extracted from \`${title}\`.\n\n`;

  md += `## Colors\n\n`;
  md += `The extracted color palette defines the brand identity.\n\n`;
  validColors.forEach(([name, val], i) => {
    let safeName = name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    if (i === 0 && !validColors.find(c => c[0] === 'primary')) safeName = 'primary';
    md += `- **${safeName.charAt(0).toUpperCase() + safeName.slice(1)} (${val})**\n`;
  });
  
  md += `\n## Components\n\n`;
  data.components.forEach(comp => {
    md += `### ${comp.name}\n\n`;
    md += `Extracted from selector \`${comp.selector}\`.\n\n`;
    md += `\`\`\`html\n${comp.html}\n\`\`\`\n\n`;
  });

  return md;
}
