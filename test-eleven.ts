import axios from 'axios';
import { extractDesignSystem } from './src/lib/extractor';
import { JSDOM } from 'jsdom';
import fs from 'fs';

const { window } = new JSDOM();
global.DOMParser = window.DOMParser as any;

async function test(url: string) {
    try {
        const res = await axios.post(`http://localhost:3000/api/fetch-site`, { url }, { headers: { 'Content-Type': 'application/json' } });
        console.log("Analyzing:", url);
        const css = res.data.css;
        const radiusRegex = /border-radius:\s*([^;}]+)/g;
        let radiusVals: string[] = [];
        let match;
        while ((match = radiusRegex.exec(css)) !== null) {
            radiusVals.push(match[1].trim());
        }
        
        const countMap: Record<string, number> = {};
        for (const v of radiusVals) { countMap[v] = (countMap[v] || 0) + 1; }
        
        let uniqueRadii = Object.keys(countMap).sort((a,b) => countMap[b] - countMap[a]).slice(0, 5);

        const radii: Record<string, string> = {};
        uniqueRadii.forEach((val, i) => radii[`radius-${i+1}`] = val);

        console.log("Extracted Radii:", radii);
    } catch (e: any) {
        console.error("error for", url, e.response?.data || e.message);
    }
}
test('https://elevenlabs.io');
