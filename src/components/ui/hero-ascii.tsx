
'use client';

import { Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Decodes random characters into final text
const ASCII_ART = `
            @@@@@@@@@@@@@@@@@@@@
          @@@@@@%          %@@@@@
         @@@@                  @@@@
        @@@   @@@          @@@   @@@
       @@@   @@@@@        @@@@@   @@@
       @@@   @@@@@   @@   @@@@@   @@@
       @@@          @@@@          @@@
       @@@@        @@@@@@        @@@@
        @@@@                    @@@@
         @@@@@                @@@@@
           @@@@@@@@@@@@@@@@@@@@@
               @@@@@@@@@@@@@

        [ MODEL: DESIGNYOURMD ]
        [ STATUS: ACTIVE      ]`;

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#%&*+-/[]";

function AsciiMatrixDecoder({ text }: { text: string }) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    let iteration = 0;
    const maxIterations = 30; // Total times it updates

    // Create initial random string same length as text
    const textLines = text.split('\n');

    const intervalId = setInterval(() => {
      setDisplay(
        textLines
          .map(line =>
             line
              .split('')
              .map((char, index) => {
                if (char === ' ' || char === '\n') return char;
                // Reveal from left to right, top to bottom
                if (iteration > (index / line.length) * maxIterations) {
                  return char;
                }
                return CHARS[Math.floor(Math.random() * CHARS.length)];
              })
              .join('')
          ).join('\n')
      );

      iteration++;
      if (iteration > maxIterations) {
        clearInterval(intervalId);
        setDisplay(text);
      }
    }, 50);

    return () => clearInterval(intervalId);
  }, [text]);

  // Initial random string to avoid flash of empty
  if (!display) {
    return (
       <pre className="font-mono text-[8px] sm:text-[10px] md:text-xs leading-[1.1] text-[#0047ab] select-none font-bold">
        {text.split('').map(c => c === ' ' || c === '\n' ? c : CHARS[Math.floor(Math.random() * CHARS.length)]).join('')}
       </pre>
    )
  }

  return (
    <pre className="font-mono text-[8px] sm:text-[10px] md:text-xs leading-[1.1] text-[#0047ab] select-none font-bold">
      {display}
    </pre>
  );
}


export default function HeroAscii() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fcfcf9] text-[#1a1a1a] isolation-isolate border-b-[12px] border-white">
      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 z-20 border-b border-[#0047ab]/10 bg-white/50 backdrop-blur-md">
        <div className="container mx-auto px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="font-mono text-[#0047ab] text-xl lg:text-2xl font-black tracking-widest italic transform -skew-x-12">
              DESIGN_YOUR_MD
            </div>
            <div className="h-3 lg:h-4 w-px bg-[#0047ab]/20"></div>
            <span className="text-[#0047ab]/60 text-[8px] lg:text-[10px] font-mono font-bold tracking-widest">EST. 2025</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono text-[#0047ab]/60 font-bold tracking-widest">
            <span>LAT: 37.7749°</span>
            <div className="w-1 h-1 bg-[#0047ab]/40 rounded-full"></div>
            <span>LONG: 122.4194°</span>
          </div>
        </div>
      </div>

      {/* Frame Accents */}
      <div className="absolute top-0 left-0 w-8 h-8 lg:w-12 lg:h-12 border-t border-l border-[#0047ab]/30 z-20"></div>
      <div className="absolute top-0 right-0 w-8 h-8 lg:w-12 lg:h-12 border-t border-r border-[#0047ab]/30 z-20"></div>

      <div className="relative z-10 flex flex-col lg:flex-row min-h-screen items-center pt-24 lg:pt-0">
        
        {/* Left Content */}
        <div className="container mx-auto px-6 lg:px-16 w-full lg:w-1/2 flex justify-center lg:justify-start">
          <div className="max-w-lg relative z-20">
            {/* Top decorative line */}
            <div className="flex items-center gap-2 mb-3 opacity-60">
              <div className="w-8 h-px bg-[#0047ab]"></div>
              <span className="text-[#0047ab] text-[10px] font-mono tracking-wider font-bold">001</span>
              <div className="flex-1 h-px bg-[#0047ab]/30"></div>
            </div>

            {/* Title */}
            <div className="relative">
              <h1 className="text-4xl lg:text-6xl font-black text-[#0047ab] mb-4 leading-[1.1] font-sans tracking-wide uppercase">
                Extract
                <span className="block mt-2 opacity-90 font-light text-[#1a1a1a]">
                  Design
                </span>
              </h1>
            </div>

            {/* Description */}
            <div className="relative">
              <p className="text-sm lg:text-base text-gray-500 mb-8 leading-relaxed font-mono opacity-90">
                Where algorithmic reasoning meets human intention — generating architectural design specs automatically from any website.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
              <button 
                onClick={() => {
                   document.getElementById('extractor-tool')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="relative px-6 py-4 lg:py-4 bg-[#0047ab] text-white font-mono text-xs lg:text-sm shadow-[6px_6px_0px_rgba(0,71,171,0.15)] hover:bg-[#0047ab]/90 hover:translate-y-px hover:translate-x-px hover:shadow-[4px_4px_0px_rgba(0,71,171,0.15)] transition-all duration-200 group flex items-center justify-center gap-2 font-bold tracking-widest uppercase">
                [ START_EXTRACTION ]
              </button>
            </div>

            {/* Bottom technical notation */}
            <div className="hidden lg:flex items-center gap-2 mt-8 opacity-40">
              <span className="text-[#0047ab] text-[9px] font-mono font-bold">∞</span>
              <div className="flex-1 h-px bg-[#0047ab]"></div>
              <span className="text-[#0047ab] text-[9px] font-mono font-bold tracking-widest">DESIGNYOURMD_ENGINE</span>
            </div>
          </div>
        </div>

        {/* Right Content - ASCII Character Art */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-0 opacity-80 mix-blend-multiply flex-shrink-0 min-h-[300px]">
           <AsciiMatrixDecoder text={ASCII_ART} />
        </div>
      </div>

      {/* Grid Background Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-multiply" style={{
        backgroundImage: 'linear-gradient(to right, #0047ab 1px, transparent 1px), linear-gradient(to bottom, #0047ab 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }}></div>
      
    </main>
  );
}
