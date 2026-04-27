import axios from 'axios';
import { extractDesignSystem } from './src/lib/extractor';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM();
global.DOMParser = window.DOMParser as any;

async function test(url: string) {
    const res = await axios.post(`http://localhost:3000/api/fetch-site`, { url }, { headers: { 'Content-Type': 'application/json' } });
    const data = extractDesignSystem(res.data.html, res.data.css);
    console.log("Colors:", data.tokens.colors);
}
test('https://elevenlabs.io');
