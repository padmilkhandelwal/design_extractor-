import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export function AsciiAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<HTMLSpanElement[]>([]);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Grid parameters
    const cols = 50;
    const rows = 20;
    const total = cols * rows;
    const chars: HTMLSpanElement[] = [];
    
    // Clear existing
    containerRef.current.innerHTML = '';
    
    // "UNIFIED BLOCK" structure
    const initialChar = '#';

    // The target "CORE" or "DESIGN.MD" block will form in Phase 2
    const targetText = "[ DESIGN.MD ]";
    // We'll place targetText in the center
    const startCol = Math.floor((cols - targetText.length) / 2);
    const startRow = Math.floor(rows / 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const span = document.createElement('span');
        // Initial character
        span.textContent = initialChar;
        span.style.position = 'absolute';
        // Some base offset to center the grid
        span.style.left = `${c * 8}px`;
        span.style.top = `${r * 12}px`;
        span.style.color = '#0047ab'; // blueprint
        span.style.opacity = '1';
        
        // Store original position and target character
        const isCore = r === startRow && c >= startCol && c < startCol + targetText.length;
        const targetChar = isCore ? targetText[c - startCol] : '.';
        
        span.dataset.targetChar = targetChar;
        span.dataset.ox = String(c * 8);
        span.dataset.oy = String(r * 12);
        span.dataset.isCore = String(isCore);

        chars.push(span);
        containerRef.current.appendChild(span);
      }
    }
    
    charsRef.current = chars;

    // Timeline
    const tl = gsap.timeline();

    // Phase 1: Fragment and Explode
    // To make it look like 3D clusters, we give them random z-translates, x/y shifts, and rotations.
    tl.to(chars, {
      duration: 2,
      x: () => (Math.random() - 0.5) * 800,
      y: () => (Math.random() - 0.5) * 600,
      z: () => (Math.random() - 0.5) * 1000,
      rotationX: () => Math.random() * 360,
      rotationY: () => Math.random() * 360,
      rotationZ: () => Math.random() * 360,
      opacity: () => Math.random() * 0.5 + 0.1,
      ease: "power2.inOut",
      stagger: {
        amount: 1,
        from: "center"
      },
      onUpdate: function() {
        // Half-way through breaking, change characters randomly to create noise
        if (this.progress() > 0.5 && phase === 0) {
           setPhase(1);
           chars.forEach(span => {
             if (Math.random() > 0.8) {
               span.textContent = Math.random() > 0.5 ? '*' : '+';
             }
           });
        }
      }
    });

    // Phase 2: Converge into Final File Structure
    tl.to(chars, {
      duration: 2,
      x: 0,
      y: 0,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      opacity: (index, target) => {
        return target.dataset.isCore === 'true' ? 1 : 0.1;
      },
      color: (index, target) => {
        return target.dataset.isCore === 'true' ? '#ffffff' : '#0047ab'; // Pop the core
      },
      ease: "power3.inOut",
      stagger: {
        amount: 1,
        from: "edges"
      },
      onStart: () => {
        setPhase(2);
        // Change text to target chars
        chars.forEach(span => {
          span.textContent = span.dataset.targetChar || '.';
          span.style.textShadow = span.dataset.isCore === 'true' ? '0 0 8px rgba(255,255,255,0.8)' : 'none';
        });
      }
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div className="w-full relative flex items-center justify-center p-12 overflow-hidden" style={{ perspective: '800px', height: '400px' }}>
      <div className="relative font-mono text-[10px] leading-none" style={{ transformStyle: 'preserve-3d', width: '400px', height: '240px' }} ref={containerRef}>
      </div>
      {phase === 2 && (
         <div className="absolute top-8 left-8 text-blueprint font-mono font-bold text-xs opacity-70 uppercase tracking-widest bg-white/50 px-4 py-2 border border-blueprint/20">
           System Reconfiguration Complete // DESIGN.MD Generated
         </div>
      )}
    </div>
  );
}
