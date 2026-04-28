/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clipboard, 
  Check, 
  Zap, 
  Layout, 
  Type, 
  Palette, 
  ArrowRight, 
  FileCode,
  Sparkles,
  Search,
  Code,
  BrainCircuit,
  Terminal,
  Download,
  Play,
  X,
  ChevronDown,
  ChevronUp,
  LayoutTemplate,
  Type as TypeIcon,
  ToggleLeft
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import confetti from 'canvas-confetti';
import { GoogleGenAI } from "@google/genai";
import { extractDesignSystem, generateMarkdown, DesignSystemData } from './lib/extractor';
import { AsciiAnimation } from './components/AsciiAnimation';
import HeroAscii from './components/ui/hero-ascii';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const EXAMPLE_HTML = `<div class="container">
  <button class="btn btn-primary">Submit Order</button>
  <button class="btn btn-secondary">Cancel</button>
  <div class="card">
    <h1 class="heading-large">Welcome Back</h1>
    <p class="text-body">Your recent activity is listed below.</p>
  </div>
</div>`;

const EXAMPLE_CSS = `.container { padding: 2rem; max-width: 1200px; }
.btn { border-radius: 8px; font-weight: 500; font-size: 14px; padding: 0.5rem 1rem; cursor: pointer; transition: all 0.2s; }
.btn-primary { background-color: #3b82f6; color: white; border: none; }
.btn-secondary { background-color: transparent; border: 1px solid #d1d5db; color: #374151; }
.card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); margin-top: 1.5rem; }
.heading-large { font-size: 32px; color: #111827; margin-bottom: 8px; }
.text-body { font-size: 16px; color: #4b5563; }`;

export default function App() {
  const [siteUrl, setSiteUrl] = useState('');
  const [siteTitle, setSiteTitle] = useState('My Brand');
  const [htmlInput, setHtmlInput] = useState(EXAMPLE_HTML);
  const [cssInput, setCssInput] = useState(EXAMPLE_CSS);
  const [data, setData] = useState<DesignSystemData | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [showPreview, setShowPreview] = useState(false);
  const [isSourceOpen, setIsSourceOpen] = useState(false);

  const handleDownload = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    let filename = 'design-system';
    if (siteUrl) {
      try {
        const urlObj = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
        filename = urlObj.hostname.replace('www.', '');
      } catch (e) {}
    }
    a.download = `${filename}-system.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleProcess = () => {
    const extractedData = extractDesignSystem(htmlInput, cssInput);
    const md = generateMarkdown(extractedData);
    setData(extractedData);
    setMarkdown(md);
  };

  const handleFetchAndProcess = async () => {
    if (!siteUrl) return;
    setIsFetching(true);
    setData(null);
    setMarkdown('');
    
    let extractedDataCache: DesignSystemData | null = null;
    let baseMdCache = '';

    try {
      // 1. Fetch raw assets
      const response = await fetch('/api/fetch-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: siteUrl }),
      });
      const result = await response.json();
      
      if (result.error) {
        alert(result.error);
        setIsFetching(false);
        return;
      }

      setHtmlInput(result.html);
      setCssInput(result.css);
      if (result.title) setSiteTitle(result.title);

      // 2. Initial Structural Extraction
      const extractedData = extractDesignSystem(result.html, result.css);
      extractedDataCache = extractedData;
      setData(extractedData);
      const baseMd = generateMarkdown(extractedData, result.title || siteTitle);
      baseMdCache = baseMd;
      setMarkdown(baseMd);
      
      // 3. AI Enhancement (Gemini)
      setIsAIProcessing(true);
      const prompt = `
        You are a Senior Design Engineer. I am building a "design.md" file for an AI agent (DesignYourMD) to use as a source of truth.
        
        Website URL: ${siteUrl}
        
        I have already performed a basic extraction of tokens and components.
        Raw Data Summary:
        - Colors: ${JSON.stringify(extractedData.tokens.colors)}
        - Typography: ${JSON.stringify(extractedData.tokens.fontSizes)}
        - Found Components: ${extractedData.components.map(c => c.name).join(', ')}

        TASK:
        Refine this into a professional-grade "design.md" file. 
        CRITICAL: Your output MUST strictly follow the DESIGN.md format specification below:

        1. Provide YAML frontmatter bounded by \`---\` at the top of the file containing design tokens.
          - version: "alpha"
          - name: The brand name
          - colors: key-value pairs of color names and HEX values. (e.g. primary: "#1A1C1E")
          - typography: key-value pairs defining fontFamily and fontSize
          - spacing: key-value pairs defining standard margins/padding (e.g., base: 16px)
          - rounded: key-value pairs defining border radius (e.g., md: 8px)
        2. Put the human-readable Markdown body below the frontmatter. MUST include these exact sections in order:
           ## Overview
           ## Colors
           ## Typography
           ## Layout
           ## Elevation & Depth
           ## Shapes
           ## Components
        3. Summarize the Brand Identity and Visual Direction of ${siteUrl}.
        4. Normalize the color tokens and give them semantic names (primary, secondary, neutral, text, surface, etc). Ensure contrast in descriptions.
        
        Raw HTML Context (Sample): ${result.html.substring(0, 3000)}
        Raw CSS Context (Sample): ${result.css.substring(0, 3000)}

        Return ONLY the raw DESIGN.md file content (YAML frontmatter + Markdown). Do not include conversational text.
      `;

      try {
        const aiResponse = await ai.models.generateContent({
          model: "gemini-2.5-pro",
          contents: prompt
        });

        if (aiResponse.text) {
          setMarkdown(aiResponse.text);
        }
      } catch (aiError: any) {
        console.warn("AI enhancement failed, falling back to algorithmic extraction:", aiError);
        // Note: we already set baseMd to markdown above, so we don't need to do anything else.
      }

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0047ab', '#333333', '#fcfcf9']
      });

    } catch (error: any) {
      console.error("Fetch error:", error);
      alert("Failed during extraction:\n" + (error.message || String(error)));
      // Keep whatever we managed to extract so far
      if (!markdown && extractedDataCache) {
         setMarkdown(baseMdCache);
      }
    } finally {
      setIsFetching(false);
      setIsAIProcessing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setIsCopied(true);
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0047ab', '#333333', '#fcfcf9']
    });
    setTimeout(() => setIsCopied(false), 2000);
  };

  useEffect(() => {
    handleProcess();
  }, []);

  return (
    <>
      <HeroAscii />
      <div id="extractor-tool" className="min-h-screen font-sans selection:bg-blue-100 selection:text-blue-900 border-[12px] border-paper bg-[#fcfcf9]">
        {/* Drafting Frame Container */}
        <div className="min-h-[calc(100vh-24px)] border border-blueprint/20 relative m-4">
          
          {/* Frame Markers */}
          <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-blueprint/40 -translate-x-1 -translate-y-1" />
          <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-blueprint/40 translate-x-1 -translate-y-1" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-blueprint/40 -translate-x-1 translate-y-1" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-blueprint/40 translate-x-1 translate-y-1" />

          {/* ASCII Header */}
          <header className="p-8 border-b border-blueprint/10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="space-y-4">
                <pre className="text-[10px] leading-[1.1] text-blueprint font-mono opacity-80 select-none">
{` _____           _             __  __ _____  
|  __ \\         (_)           |  \\/  |  __ \\ 
| |  | | ___ ___ _  __ _ _ __ | \\  / | |  | |
| |  | |/ _ \\/ __| |/ _\` | '_ \\| |\\/| | |  | |
| |__| |  __/\\__ \\ | (_| | | | | |  | | |__| |
|_____/ \\___||___/_|\\__, |_| |_|_|  |_|_____/
                     __/ |                   
                    |___/                    
                                             
 [ DESIGNYOURMD_ENGINE_v1.0 // P-ARCH_SPEC ]`}
                </pre>
                <div>
                  <h1 className="text-2xl font-light tracking-widest text-blueprint uppercase">Create a Design file from any website</h1>
                  <p className="font-mono text-[10px] text-gray-500 mt-1 uppercase tracking-tight">DESIGN.md gives agents a persistent, structured understanding of a design system.</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 text-right font-mono text-[10px]">
                <div className="text-gray-400">SCALE: 1:1 // REF_MD</div>
                <div className="text-gray-400">PROJECT: {new Date().getFullYear()}-SPEC-AUTO</div>
                
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setShowPreview(true)}
                    disabled={!data}
                    className="group flex items-center gap-2 px-4 py-2 border transition-all active:scale-95 bg-blueprint text-white hover:bg-blueprint/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-[4px_4px_0px_rgba(0,0,0,0.1)]"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span className="uppercase text-[10px] font-bold tracking-widest hidden sm:inline">[ TRY_IT_NOW ]</span>
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={!markdown}
                    className="group flex items-center gap-2 px-3 py-2 border transition-all active:scale-95 bg-paper border-blueprint/20 text-blueprint hover:border-blueprint disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Download .md file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="uppercase text-[10px] font-bold tracking-widest">DL</span>
                  </button>

                  <button
                    onClick={handleCopy}
                    disabled={!markdown}
                    className={`group flex items-center gap-2 px-3 py-2 border transition-all active:scale-95 ${
                      isCopied 
                        ? 'bg-green-50 border-green-200 text-green-700' 
                        : 'bg-paper border-blueprint/20 text-blueprint hover:border-blueprint disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                    title="Copy to clipboard"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
                    <span className="uppercase text-[10px] font-bold tracking-widest hidden sm:inline">Copy</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="p-8">
            {/* Main Action Bar */}
            <div className="mb-12 max-w-4xl mx-auto space-y-4">
              <div className="flex items-center gap-4">
                <span className="font-mono text-[10px] text-blueprint/40 bg-blueprint/5 px-2 py-1 border border-blueprint/10 whitespace-nowrap">START_HERE</span>
                <div className="h-px bg-blueprint/10 flex-1" />
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blueprint/30" />
                  <input 
                    type="text"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="Enter website URL (e.g. google.com or https://stripe.com)"
                    className="w-full pl-12 pr-6 py-4 bg-white border border-blueprint/20 font-mono text-sm focus:border-blueprint outline-none shadow-inner text-[#1a1a1a]"
                  />
                </div>
                <button 
                  onClick={handleFetchAndProcess}
                  disabled={isFetching || isAIProcessing || !siteUrl}
                  className="px-8 py-4 bg-blueprint text-white font-bold uppercase text-xs tracking-widest hover:bg-blueprint/90 transition-all flex items-center justify-center gap-3 shadow-[6px_6px_0px_rgba(0,71,171,0.1)] disabled:opacity-50 disabled:shadow-none"
                >
                  {isFetching || isAIProcessing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isFetching ? 'Fetching Content...' : isAIProcessing ? 'AI Synthesis...' : 'Create design.md'}
                </button>
              </div>
              <p className="text-[10px] font-mono text-gray-400 text-center uppercase tracking-tighter">
                {isAIProcessing ? 'Gemini 3.1 is reasoning over the DOM architecture...' : 'Input URL to analyze architecture. The engine will extract tokens and components into a structured specification.'}
              </p>
            </div>

            {isFetching || isAIProcessing ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <AsciiAnimation />
                <p className="mt-8 text-xs font-mono text-blueprint/50 uppercase tracking-widest animate-pulse">
                  {isFetching ? 'Parsing DOM Architecture...' : 'Synthesizing Mathematical Tokens...'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                
                {/* Left Col: Drafting Inputs (5 cols) */}
                <div className="lg:col-span-5 space-y-12">
                  <section className="space-y-6">
                    <button 
                      onClick={() => setIsSourceOpen(!isSourceOpen)}
                      className="w-full flex items-center justify-between gap-4 group"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <span className="font-mono text-[10px] text-blueprint/40 bg-blueprint/5 px-2 py-1 border border-blueprint/10 transition-colors group-hover:bg-blueprint/10 group-hover:text-blueprint">SECTION_01</span>
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-blueprint">Source Material</h2>
                        <div className="h-px bg-blueprint/10 flex-1 transition-colors group-hover:bg-blueprint/30" />
                      </div>
                      <div className="p-1 border border-blueprint/10 text-blueprint/40 group-hover:text-blueprint transition-colors">
                        {isSourceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>
                    
                    <AnimatePresence>
                      {isSourceOpen && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden space-y-8"
                        >
                          {/* HTML Input */}
                          <div className="relative mt-2">
                            <label className="absolute -top-3 left-4 px-2 bg-paper text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
                              [01.A] Base HTML
                            </label>
                            <textarea
                              value={htmlInput}
                              onChange={(e) => setHtmlInput(e.target.value)}
                              className="w-full h-40 p-6 bg-transparent border border-blueprint/20 font-mono text-xs focus:border-blueprint transition-colors outline-none resize-none shadow-inner text-[#1a1a1a]"
                              placeholder="Input Raw Source..."
                            />
                          </div>

                          {/* CSS Input */}
                          <div className="relative">
                            <label className="absolute -top-3 left-4 px-2 bg-paper text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
                              [01.B] Logic Definitions (CSS)
                            </label>
                            <textarea
                              value={cssInput}
                              onChange={(e) => setCssInput(e.target.value)}
                              className="w-full h-40 p-6 bg-transparent border border-blueprint/20 font-mono text-xs focus:border-blueprint transition-colors outline-none resize-none shadow-inner text-[#1a1a1a]"
                              placeholder="Input Style Rules..."
                            />
                          </div>

                          <button
                            onClick={handleProcess}
                            className="w-full py-5 bg-blueprint text-white font-bold uppercase text-xs tracking-[0.3em] hover:bg-blueprint/90 transition-all flex items-center justify-center gap-4 shadow-[6px_6px_0px_#0047ab22]"
                          >
                            <Code className="w-4 h-4 opacity-50" />
                            Process Schematic
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>

                  {/* Statistical Metadata */}
                  {data && (
                    <motion.section 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid grid-cols-3 border border-blueprint/10 bg-white/50"
                    >
                      <div className="p-6 border-r border-blueprint/10">
                        <div className="text-[10px] font-mono text-gray-400 mb-1">TOK_COLORS</div>
                        <div className="text-xl font-light text-blueprint">{String(Object.keys(data.tokens.colors).length).padStart(2, '0')}</div>
                      </div>
                      <div className="p-6 border-r border-blueprint/10">
                        <div className="text-[10px] font-mono text-gray-400 mb-1">TOK_TYPO</div>
                        <div className="text-xl font-light text-blueprint">{String(Object.keys(data.tokens.fontSizes).length).padStart(2, '0')}</div>
                      </div>
                      <div className="p-6">
                        <div className="text-[10px] font-mono text-gray-400 mb-1">TOK_SPACE</div>
                        <div className="text-xl font-light text-blueprint">{String(Object.keys(data.tokens.spacing).length).padStart(2, '0')}</div>
                      </div>
                    </motion.section>
                  )}
                </div>

                {/* Right Col: Blueprint Output (7 cols) */}
                <div className="lg:col-span-7 flex flex-col min-h-[700px]">
                  <div className="flex items-center justify-between border-y border-blueprint/10 bg-blueprint/5 px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blueprint/20 animate-pulse" />
                      <h2 className="text-[10px] font-bold uppercase tracking-widest text-blueprint/60">Final Specification Output // Output_Buffer</h2>
                    </div>
                    <div className="flex bg-white/50 p-1 border border-blueprint/10">
                      <button 
                        onClick={() => setActiveTab('preview')}
                        className={`px-4 py-1 text-[10px] uppercase font-bold tracking-wider transition-all ${activeTab === 'preview' ? 'bg-blueprint text-white' : 'text-blueprint/40'}`}
                      >
                        Schematic
                      </button>
                      <button 
                        onClick={() => setActiveTab('code')}
                        className={`px-4 py-1 text-[10px] uppercase font-bold tracking-wider transition-all ${activeTab === 'code' ? 'bg-blueprint text-white' : 'text-blueprint/40'}`}
                      >
                        Raw Script
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 border-x border-b border-blueprint/10 bg-white relative overflow-hidden">
                    <AnimatePresence mode="wait">
                      {activeTab === 'preview' ? (
                        <motion.div
                          key="preview"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 p-10 overflow-y-auto prose prose-sm max-w-none prose-headings:text-blueprint prose-headings:font-light prose-headings:uppercase prose-headings:tracking-widest"
                        >
                          <ReactMarkdown>{markdown}</ReactMarkdown>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="code"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 p-10 font-mono text-xs overflow-y-auto bg-slate-50 text-blueprint/80"
                        >
                          <pre className="whitespace-pre-wrap">{markdown}</pre>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* Visual Scale Indicator */}
                    <div className="absolute bottom-4 right-4 pointer-events-none flex items-center gap-2">
                      <div className="h-4 w-px bg-blueprint/20" />
                      <div className="h-px w-20 bg-blueprint/20 relative">
                        <div className="absolute left-0 top-0 h-1.5 w-px bg-blueprint/20" />
                        <div className="absolute center top-0 h-1.5 w-px bg-blueprint/20 left-1/2" />
                        <div className="absolute right-0 top-0 h-1.5 w-px bg-blueprint/20" />
                      </div>
                      <div className="h-4 w-px bg-blueprint/20" />
                      <span className="text-[8px] font-mono text-blueprint/20 uppercase">Scale 100%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* Footer Technical Block */}
          <footer className="mt-auto p-8 border-t border-blueprint/10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-blueprint p-2 flex items-center justify-center">
                  <div className="w-full h-full border border-white/20 flex items-center justify-center">
                      <Zap className="text-white w-8 h-8 opacity-40" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-blueprint tracking-tighter italic">"Precision is the only architecture."</div>
                  <div className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">Built to standard P-7 // AI-Agent Ready</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[9px] font-mono text-gray-400 uppercase">
                <span className="text-blueprint/40">Lat: 0.0000</span>
                <span className="text-blueprint/40">Lon: 0.0000</span>
                <span className="text-blueprint/40">Mode: Auto-Gen</span>
                <span className="text-blueprint/40">Status: Nominal</span>
              </div>
            </div>
          </footer>
        </div>

        {/* Decorative Frame Elements */}
        <div className="fixed bottom-12 right-12 text-[8px] font-mono text-blueprint/10 select-none pointer-events-none md:block hidden">
          [ SYSTEM_ID: ALPHA_XRAY_SPEC_44 ]<br />
          [ ENCRYPTION: NONE // PUBLIC_DRAFT ]<br />
          [ AUTH: AGENT_DESIGNYOURMD ]
        </div>

        {/* Try It Now Preview Overlay */}
        <AnimatePresence>
          {showPreview && data && (
            <ThemePreviewOverlay 
                data={data} 
                title={siteTitle} 
                siteUrl={siteUrl}
                html={htmlInput}
                css={cssInput}
                onClose={() => setShowPreview(false)} 
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// -----------------------------------------------------
// Feature: Live Extracted Theme Preview
// -----------------------------------------------------
function ThemePreviewOverlay({ data, title, siteUrl, html, css, onClose }: { data: DesignSystemData, title: string, siteUrl: string, html: string, css: string, onClose: () => void }) {
  const colors = data.tokens.colors;
  
  const safeSiteUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
  
  // Extract primary colors for dynamic theming
  const bg = colors['bg-primary'] || '#ffffff';
  let text = colors['text-primary'] || '#1a1a1a';
  if (bg === text) text = bg === '#ffffff' ? '#1a1a1a' : '#ffffff';
  
  // Contrast helper
  const getContrast = (c1: string, c2: string) => {
    const toRgb = (color: string) => {
      let c = color.trim();
      if (c.startsWith('rgb')) {
        const match = c.match(/[\d.]+/g);
        if (match && match.length >= 3) return [parseFloat(match[0]), parseFloat(match[1]), parseFloat(match[2])];
      }
      if (c.startsWith('hsl')) return [0, 0, 0]; // fallback for hsl
      if (c.startsWith('var')) return [0, 0, 0]; // fallback for css vars
      
      let h = c.replace('#', '');
      if (h.length === 3 || h.length === 4) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      if (h.length < 6) return [0,0,0];
      return [parseInt(h.slice(0,2), 16), parseInt(h.slice(2,4), 16), parseInt(h.slice(4,6), 16)];
    };
    const lum = ([r,g,b]: number[]) => {
      const a = [r,g,b].map(v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
      return a[0]*0.2126 + a[1]*0.7152 + a[2]*0.0722;
    };
    const rgb1 = toRgb(c1);
    const rgb2 = toRgb(c2);
    if (isNaN(rgb1[0]) || isNaN(rgb2[0])) return 1;
    const l1 = lum(rgb1);
    const l2 = lum(rgb2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  let brandColors = Object.values(colors).filter(c => c !== bg && c !== text && c !== '#ffffff' && c !== '#000000');
  brandColors = brandColors.filter(c => getContrast(c, bg) > 1.2);
  
  const getSaturation = (color: string) => {
    let c = color.trim();
    if (c.startsWith('var') || c.startsWith('hsl') || c.startsWith('rgb')) return 0;
    let h = c.replace('#', '');
    if (h.length === 3 || h.length === 4) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if (h.length < 6) return 0;
    const r = parseInt(h.slice(0,2), 16) / 255;
    const g = parseInt(h.slice(2,4), 16) / 255;
    const b = parseInt(h.slice(4,6), 16) / 255;
    if (isNaN(r)) return 0;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  };
  
  brandColors.sort((a, b) => getSaturation(String(b)) - getSaturation(String(a)));
  
  const brand = brandColors[0] || text; // Fallback to text color if no distinctive contrasting color
  
  const isBrandDark = getContrast(brand, '#ffffff') > getContrast(brand, '#000000');
  const brandText = isBrandDark ? '#ffffff' : '#000000';

  const fontFam = (data.tokens.fonts && data.tokens.fonts.length > 0) ? `"${data.tokens.fonts[0]}", sans-serif` : 'sans-serif';
  let baseRadius = '0px';
  let btnRadius = '0px';
  if (data.tokens.radii) {
      // Access values in insertion order (which is frequency order from extractor)
      const rList = Array.from({length: 10}, (_, i) => data.tokens.radii[`radius-${i+1}`]).filter(Boolean);
      const isPxRem = (v: string) => /^\d+(\.\d+)?(px|rem)$/.test(v);
      const getVal = (v: string) => parseFloat(v) * (v.includes('rem') ? 16 : 1);
      
      const freqSizes = rList.filter(isPxRem);
      if (freqSizes.length > 0) {
          baseRadius = freqSizes[0];
          btnRadius = baseRadius;
          
          const btnComp = data.components?.find(c => c.name.includes('Button') || c.name.includes('Action'));
          let compRadius = btnComp?.radius;
          
          if (compRadius) {
              // Extract fallback from var() if possible
              if (compRadius.includes('var(')) {
                  const match = compRadius.match(/,\s*([^)]+)\)/);
                  if (match) compRadius = match[1].trim();
              }
              if (compRadius && isPxRem(compRadius) || compRadius === '50%' || compRadius === '9999px' || compRadius === '0') {
                  btnRadius = compRadius;
                  if (btnRadius === '50%') btnRadius = '9999px';
               }
          }
          
          if (!btnComp?.radius || (!isPxRem(btnRadius) && btnRadius !== '9999px')) {
              const top3 = rList.slice(0, 3);
              if (top3.includes('9999px') && !top3.includes('0px') && !top3.includes('0')) {
                  btnRadius = '9999px';
              } else if (getVal(baseRadius) === 0) {
                  btnRadius = freqSizes.find(v => getVal(v) > 0) || '0px';
              }
              
              if (getVal(btnRadius) > 32 && btnRadius !== '9999px') {
                  const smaller = freqSizes.find(v => getVal(v) <= 32 && getVal(v) > 0);
                  if (smaller) btnRadius = smaller;
              }
          }
      }
  }

  // Extract font-face and imports to apply fonts to the overlay globally
  const fontStyles = css.match(/@(?:font-face|import)[^;{]+(?:{[^}]+})?;?/g)?.join('\n') || '';

  // Create a theme style object
  const themeStyle = {
    '--theme-bg': bg,
    '--theme-text': text,
    '--theme-text-10': text.startsWith('#') && text.length === 7 ? `${text}1a` : `color-mix(in srgb, ${text} 10%, transparent)`,
    '--theme-text-20': text.startsWith('#') && text.length === 7 ? `${text}33` : `color-mix(in srgb, ${text} 20%, transparent)`,
    '--theme-text-30': text.startsWith('#') && text.length === 7 ? `${text}4d` : `color-mix(in srgb, ${text} 30%, transparent)`,
    '--theme-brand': brand,
    '--theme-brand-text': brandText,
    '--theme-brand-10': brand.startsWith('#') && brand.length === 7 ? `${brand}1a` : `color-mix(in srgb, ${brand} 10%, transparent)`,
    '--theme-brand-20': brand.startsWith('#') && brand.length === 7 ? `${brand}33` : `color-mix(in srgb, ${brand} 20%, transparent)`,
    '--theme-brand-30': brand.startsWith('#') && brand.length === 7 ? `${brand}4d` : `color-mix(in srgb, ${brand} 30%, transparent)`,
    '--theme-font': fontFam,
    '--theme-radius': baseRadius,
    '--theme-btn-radius': btnRadius,
    backgroundColor: 'var(--theme-bg)',
    color: 'var(--theme-text)',
    fontFamily: 'var(--theme-font)',
  } as React.CSSProperties;

  // Build the sandboxed iframe source
  const iframeSrcDoc = `
    <html>
      <head>
        <base href="${safeSiteUrl}" />
        <style>
          /* Injected Extracted CSS */
          ${css}
          
          /* Read-only overlay and scrollbar styling */
          body { 
            margin: 0;
            padding: 0;
            overflow-x: hidden;
            background-color: transparent !important;
          }
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `;

  return (
    <div 
      className="fixed inset-0 z-[100] overflow-y-auto"
      style={themeStyle}
    >
      <style>{fontStyles}</style>
      <div className="min-h-full bg-white transition-colors duration-500" style={{ backgroundColor: 'var(--theme-bg)' }}>
        
        {/* Header */}
        <div className="sticky top-0 z-50 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b/50" style={{ borderColor: 'var(--theme-text-10)', backgroundColor: 'var(--theme-bg)' }}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center text-lg font-bold" style={{ backgroundColor: 'var(--theme-text)', color: 'var(--theme-bg)', borderRadius: 'var(--theme-radius)', fontFamily: 'var(--theme-font)' }}>
              {title.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-lg leading-none" style={{ color: 'var(--theme-text)', fontFamily: 'var(--theme-font)' }}>{title}</div>
              <div className="text-xs opacity-60 mt-1" style={{ fontFamily: 'var(--theme-font)' }}>Live Preview</div>
            </div>
          </div>
          <button onClick={onClose} className="px-6 py-2.5 font-medium transition-all hover:-translate-y-0.5" style={{ color: 'var(--theme-text)', backgroundColor: 'var(--theme-text-10)', borderRadius: 'var(--theme-btn-radius)', fontFamily: 'var(--theme-font)' }}>
             Exit Preview
          </button>
        </div>

        <div className="max-w-7xl mx-auto p-6 md:p-12 space-y-12">
          
          {/* Main Hero */}
          <div className="pt-8 pb-12 flex flex-col gap-6 max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]" style={{ color: 'var(--theme-text)', fontFamily: 'var(--theme-font)' }}>
              Bringing<br/>technology to life
            </h1>
            <p className="text-lg md:text-xl opacity-70 leading-relaxed max-w-2xl mt-4" style={{ fontFamily: 'var(--theme-font)' }}>
              The extracted tokens from {title} have been mapped to standardized primitives. UI elements are dynamically structured using the extracted palette.
            </p>
            <div className="flex flex-wrap gap-4 pt-6">
              <button className="px-8 py-3.5 font-medium transition-transform hover:-translate-y-0.5 shadow-md shadow-black/5" style={{ backgroundColor: 'var(--theme-brand)', color: 'var(--theme-brand-text)', borderRadius: 'var(--theme-btn-radius)', fontFamily: 'var(--theme-font)' }}>
                Start Building
              </button>
              <button className="px-8 py-3.5 font-medium transition-transform hover:-translate-y-0.5 border" style={{ borderColor: 'var(--theme-text-20)', backgroundColor: 'transparent', color: 'var(--theme-text)', borderRadius: 'var(--theme-btn-radius)', fontFamily: 'var(--theme-font)' }}>
                Contact Sales
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            
            {/* Main Content Area */}
            <div className="md:col-span-8 space-y-10">
               {/* Read-Only Website Preview */}
               <div className="space-y-4">
                  <h3 className="text-xl font-semibold opacity-90" style={{ fontFamily: 'var(--theme-font)' }}>Extracted Representation</h3>
                  <div className="w-full h-[600px] relative overflow-hidden shadow-2xl" style={{ backgroundColor: 'var(--theme-bg)', borderRadius: 'var(--theme-radius)', borderColor: 'var(--theme-text-10)', borderWidth: '1px' }}>
                     <div className="absolute inset-0 z-10" />
                     <iframe 
                       srcDoc={iframeSrcDoc}
                       className="w-full h-full border-0 relative z-0"
                       title="Website Preview"
                       sandbox="allow-same-origin"
                     />
                  </div>
               </div>
               
               {/* Tokens Showcase */}
               <div className="space-y-6 pt-10">
                 <h3 className="text-xl font-semibold opacity-90" style={{ fontFamily: 'var(--theme-font)' }}>Color Schema Reference</h3>
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {Object.entries(colors).map(([name, val], i) => (
                      <div key={i} className="flex flex-col gap-3 group">
                        <div className="w-full aspect-square border shadow-sm transition-transform group-hover:scale-105" style={{ borderColor: 'var(--theme-text-10)', borderRadius: 'var(--theme-radius)', backgroundColor: val as string }} />
                        <div className="text-sm flex flex-col gap-1" style={{ fontFamily: 'var(--theme-font)' }}>
                          <span className="font-medium opacity-90 truncate" title={name}>{name}</span>
                          <span className="opacity-60">{val as string}</span>
                        </div>
                      </div>
                    ))}
                 </div>
               </div>
               
               {/* Extracted Components Showcase */}
               <div className="space-y-6 pt-10">
                 <h3 className="text-xl font-semibold opacity-90" style={{ fontFamily: 'var(--theme-font)' }}>Extracted HTML Primitives</h3>
                 <div className="space-y-4">
                    {data.components && data.components.length > 0 ? data.components.map((c, i) => (
                      <div key={i} className="p-5 border shadow-sm" style={{ borderColor: 'var(--theme-text-10)', borderRadius: 'var(--theme-radius)' }}>
                         <div className="text-xs font-semibold opacity-60 mb-3" style={{ fontFamily: 'var(--theme-font)' }}>{c.selector}</div>
                         <div className="w-full relative bg-transparent rounded" style={{ minHeight: '120px', maxHeight: '300px', backgroundColor: 'var(--theme-bg)' }}>
                           <iframe 
                             srcDoc={`<html><head><base href="${safeSiteUrl}" /><style>${css}</style></head><body style="margin:0;padding:1rem;display:flex;align-items:center;justify-content:center;background:transparent;">${c.html}</body></html>`}
                             className="w-full h-full border-0 absolute inset-0"
                             title={c.name}
                             sandbox="allow-same-origin allow-scripts"
                           />
                         </div>
                         <div className="mt-4">
                           <div className="text-[10px] font-semibold opacity-40 uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--theme-font)' }}>HTML Source</div>
                           <pre className="text-xs overflow-x-auto whitespace-pre-wrap p-3 opacity-60" style={{ backgroundColor: 'var(--theme-text-10)', color: 'var(--theme-text)', borderRadius: 'var(--theme-radius)', fontFamily: 'var(--theme-font)' }}>
                             {((c.cleanHtml || c.html).length > 400 ? (c.cleanHtml || c.html).substring(0, 400) + '...' : (c.cleanHtml || c.html)).trim()}
                           </pre>
                         </div>
                      </div>
                    )) : (
                      <div className="text-sm opacity-60" style={{ fontFamily: 'var(--theme-font)' }}>No distinct primitives extracted...</div>
                    )}
                 </div>
               </div>
            </div>

            {/* Sidebar / Mock App */}
            <div className="md:col-span-4 space-y-10">
              
              <div className="space-y-6">
                 <h3 className="text-xl font-semibold opacity-90" style={{ fontFamily: 'var(--theme-font)' }}>Form Demo</h3>
                 <div className="space-y-5">
                   <div>
                     <label className="block text-sm font-medium mb-2 opacity-80" style={{ fontFamily: 'var(--theme-font)' }}>Email Address</label>
                     <input type="text" className="w-full px-4 py-3 border outline-none transition-colors focus:border-current" style={{ borderColor: 'var(--theme-text-20)', backgroundColor: 'transparent', color: 'var(--theme-text)', borderRadius: 'var(--theme-radius)', fontFamily: 'var(--theme-font)' }} placeholder="dev@example.com" />
                   </div>
                   <div>
                     <label className="block text-sm font-medium mb-2 opacity-80" style={{ fontFamily: 'var(--theme-font)' }}>Company Name</label>
                     <input type="text" className="w-full px-4 py-3 border outline-none transition-colors focus:border-current" style={{ borderColor: 'var(--theme-text-20)', backgroundColor: 'transparent', color: 'var(--theme-text)', borderRadius: 'var(--theme-radius)', fontFamily: 'var(--theme-font)' }} placeholder="Acme Corp" />
                   </div>
                   <button className="w-full py-4 font-medium mt-2 transition-transform hover:-translate-y-0.5 shadow-md shadow-black/5" style={{ backgroundColor: 'var(--theme-brand)', color: 'var(--theme-brand-text)', borderRadius: 'var(--theme-btn-radius)', fontFamily: 'var(--theme-font)' }}>
                     Submit Details
                   </button>
                 </div>
              </div>

              {/* Typography Spec Showcase */}
               <div className="space-y-6 pt-4">
                 <h3 className="text-xl font-semibold opacity-90" style={{ fontFamily: 'var(--theme-font)' }}>Typography Scale</h3>
                 <div className="space-y-6">
                   <div>
                     <div className="text-xs opacity-60 mb-2" style={{ fontFamily: 'var(--theme-font)' }}>Heading 1</div>
                     <div className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--theme-font)' }}>System Specs</div>
                   </div>
                   <div>
                     <div className="text-xs opacity-60 mb-2" style={{ fontFamily: 'var(--theme-font)' }}>Heading 2</div>
                     <div className="text-xl font-semibold" style={{ fontFamily: 'var(--theme-font)' }}>Base Tokens</div>
                   </div>
                   <div>
                     <div className="text-xs opacity-60 mb-2" style={{ fontFamily: 'var(--theme-font)' }}>Body Copy</div>
                     <div className="text-base opacity-80 leading-relaxed" style={{ fontFamily: 'var(--theme-font)' }}>
                       This is a rendering of the typography system. The sizes and line heights map to extracted algorithmic parameters seamlessly.
                     </div>
                   </div>
                 </div>
               </div>
               
               {/* Spacing Matrix Showcase */}
               <div className="space-y-6 pt-4">
                 <h3 className="text-xl font-semibold opacity-90" style={{ fontFamily: 'var(--theme-font)' }}>Spacing Scale</h3>
                 <div className="flex flex-col gap-4">
                   {Object.entries(data.tokens.spacing).slice(0,6).map(([name, s], idx) => {
                     const numTokens = s.match(/[\d.]+/g);
                     const parseVal = numTokens ? parseFloat(numTokens[0]) : (idx + 1) * 8;
                     const sizeVal = parseVal * (s.includes('rem') || s.includes('em') ? 16 : 1);
                     return (
                       <div key={idx} className="flex items-center gap-4">
                         <div className="w-16 text-xs opacity-60 text-right" style={{ fontFamily: 'var(--theme-font)' }}>{s}</div>
                         <div className="h-5 shadow-sm" style={{ width: `${Math.min(sizeVal, 200)}px`, backgroundColor: 'var(--theme-text-10)', borderRadius: 'var(--theme-radius)' }} />
                       </div>
                     )
                   })}
                 </div>
               </div>
               
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
