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
  cleanHtml?: string;
  styles: string[];
  radius?: string;
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
  const spacingRegex = /(?:margin|padding|gap)(?:-(?:top|right|bottom|left))?:\s*([^;}!]+)(?:!important)?/g;
  let spaceVals: string[] = [];
  while ((match = spacingRegex.exec(css)) !== null) {
      let val = match[1].trim();
      if (/^(\d+(\.\d+)?(px|rem|em|vh|vw|%)|0)$/.test(val)) {
          spaceVals.push(val);
      }
  }
  
  const spaceCountMap: Record<string, number> = {};
  for (const v of spaceVals) { spaceCountMap[v] = (spaceCountMap[v] || 0) + 1; }
  
  const uniqueSpacing = Object.keys(spaceCountMap).sort((a,b) => spaceCountMap[b] - spaceCountMap[a]).slice(0, 15);
  const spacing: Record<string, string> = {};
  uniqueSpacing.forEach((val, i) => spacing[`space-${i+1}`] = val);

  // Extract Radii
  const radiusRegex = /border-radius:\s*([^;}!]+)/g;
  let radiusVals: string[] = [];
  while ((match = radiusRegex.exec(css)) !== null) {
      let val = match[1].trim();
      if (/^(\d+(\.\d+)?(px|rem|em)|0|50%)$/.test(val)) {
          if (val === '50%') val = '9999px'; // Normalise to pill since percentage isn't always useful for buttons unless they are perfectly square
          radiusVals.push(val);
      }
  }
  
  const countMap: Record<string, number> = {};
  for (const v of radiusVals) { countMap[v] = (countMap[v] || 0) + 1; }
  
  let uniqueRadii = Object.keys(countMap).sort((a,b) => countMap[b] - countMap[a]).slice(0, 10);

  const radii: Record<string, string> = {};
  uniqueRadii.forEach((val, i) => radii[`radius-${i+1}`] = val);

  // Extract Fonts
  const fontRegex = /font-family:\s*([^;}!]+)/g;
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

  const extractEl = (name: string, selectors: string) => {
    const els = doc.querySelectorAll(selectors);
    
    // Try to find an element that represents a solid component (has text, reasonable size)
    let bestEl: Element | null = null;
    let maxScore = -1;

    for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (!el || el.outerHTML.length > 50000) continue;
        
        // Exclude likely icon-only buttons if possible, prefer buttons with text context
        let score = 0;
        if (el.textContent && el.textContent.trim().length > 2) score += 5;
        if (el.className && typeof el.className === 'string') {
           if (el.className.includes('primary')) score += 10;
           if (el.className.includes('btn')) score += 5;
           if (el.className.includes('solid')) score += 5;
           score += el.classList.length;
        }

        if (score > maxScore) {
           maxScore = score;
           bestEl = el;
        }
    }

    if (!bestEl) return;
    const el = bestEl;

    const allClasses = Array.from(el.classList).filter(c => /^[a-zA-Z0-9-_:]+$/.test(c));
        const cleanClasses = allClasses.slice(0, 3);
        
        let displayHtml = el.outerHTML;
        let cleanHtml = displayHtml;
        cleanHtml = cleanHtml.replace(/class="([^"]+)"/g, (match, classes) => {
          const clsList = classes.split(/\s+/);
          if (clsList.length > 3) {
            return `class="${clsList.slice(0, 3).join(' ')} ..."`;
          }
          return match;
        });
        cleanHtml = cleanHtml.replace(/\s+(data|aria)-[a-zA-Z0-9-]+="[^"]*"/g, '');

        let foundRadius: string | undefined;
        if (allClasses.length > 0) {
            if (allClasses.some(c => c.includes('rounded-full') || c.includes('pill'))) {
                 foundRadius = '9999px';
            } else {
                for (const c of allClasses) {
                   // Escape colons for tailwind variants like sm:rounded-md
                   const escapedC = c.replace(/:/g, '\\\\:');
                   const regex = new RegExp(`\\.${escapedC}[^{]*\\{[^}]*border-radius:\\s*([^;}!]+)`, 'is');
                   const match = css.match(regex);
                   if (match) {
                       foundRadius = match[1].trim();
                       break;
                   }
                }
            }
        }

        components.push({
          name,
          selector: cleanClasses.length > 0 ? `.${cleanClasses.join('.')}` : el.tagName.toLowerCase(),
          html: displayHtml,
          cleanHtml: cleanHtml,
          styles: [],
          radius: foundRadius
        });
  };

  // Extract a few different semantic/interactive elements to serve as component reference
  extractEl('Action / Button', 'button, [role="button"], a.btn, a.button, a[class*="button" i], a[class*="btn" i], a[class*="hover:" i]:not(nav a), a.group.inline-flex');
  extractEl('Navigation', 'nav, header, [role="navigation"]');
  extractEl('Container / Section', 'article, section, .container, .card, [data-testid*="container"]');
  extractEl('Input / Form', 'input, textarea, select, [role="searchbox"], [role="textbox"]');

  // Extract simple transition info
  const transitionRegex = /transition:\s*([^;}!]+)/g;
  let transitions = [];
  while ((match = transitionRegex.exec(css)) !== null) {
      if (match[1].length < 30) transitions.push(match[1].trim());
  }
  const topTransitions = Array.from(new Set(transitions)).slice(0, 3);

  return {
    tokens: {
      colors: normalizedColors,
      fontSizes,
      spacing,
      radii,
      fonts: uniqueFontFamilies.length > 0 ? uniqueFontFamilies : ['Inter', 'sans-serif'],
      animations: topTransitions.length > 0 ? topTransitions : ['all 0.2s ease-in-out']
    },
    components,
  };
}

export function generateMarkdown(data: DesignSystemData & { tokens: DesignTokens & { animations?: string[] } }, title: string = 'Extracted Theme'): string {
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

  if (data.tokens.radii) {
    md += `rounded:\n`;
    Object.entries(data.tokens.radii).slice(0, 3).forEach(([name, val]) => {
      md += `  ${name}: ${val}\n`;
    });
  }

  if (data.tokens.animations) {
    md += `animations:\n`;
    data.tokens.animations.slice(0, 3).forEach((val, i) => {
      md += `  transition-${i+1}: "${val}"\n`;
    });
  }

  // Components
  md += `components:\n`;
  data.components.slice(0, 3).forEach((comp, i) => {
    const compName = comp.name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    md += `  ${compName}:\n`;
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

  md += `\n## Animation & Micro-Interactions\n\n`;
  md += `Common transitions observed:\n`;
  if (data.tokens.animations) {
    data.tokens.animations.forEach(a => md += `- \`${a}\`\n`);
  } else {
    md += `- Default smooth hover states on interactive elements.\n`;
  }
  
  md += `\n## Components\n\n`;
  data.components.forEach(comp => {
    md += `### ${comp.name}\n\n`;
    md += `Extracted from selector \`${comp.selector}\`.\n\n`;
    md += `\`\`\`html\n${comp.html}\n\`\`\`\n\n`;
  });

  return md;
}
