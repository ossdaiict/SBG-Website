import React from 'react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f7f9ff] dark:bg-[#060709] transition-colors duration-300 select-none overflow-hidden">
      {/* Background ambient radial glow matching the SBG theme */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#755a21]/10 via-[#d4af37]/15 to-[#1a3026]/10 dark:from-[#d4af37]/10 dark:via-[#f59e0b]/10 dark:to-[#52b788]/10 blur-[120px] pointer-events-none" />

      {/* Center SBG Logo (Exact match to LandingPage initial loader size & centering) */}
      <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 flex items-center justify-center">
        <img
          src="/sbg_logo.png"
          alt="Student Body Government"
          className="w-full h-full object-contain drop-shadow-md"
          width={400}
          height={430}
          loading="eager"
          decoding="sync"
        />
      </div>

      {/* Sleek Loading Bar */}
      <div className="absolute top-[calc(50%+80px)] sm:top-[calc(50%+100px)] md:top-[calc(50%+108px)] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 w-56 sm:w-64 pointer-events-none">
        <div className="w-full h-1 sm:h-1.5 rounded-full bg-[#051b12]/10 dark:bg-white/10 overflow-hidden relative shadow-inner">
          <div className="h-full w-2/5 bg-gradient-to-r from-[#755a21] via-[#d4af37] to-[#10b981] dark:from-[#d4af37] dark:via-[#fde047] dark:to-[#52b788] rounded-full animate-pulse shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
        </div>
        <div className="w-full flex items-center justify-between text-[10px] font-bold tracking-[0.2em] uppercase text-[#727974] dark:text-[#94a3b8] px-0.5">
          <span>Initializing...</span>
          <span className="font-mono text-[#755a21] dark:text-[#d4af37]">SBG</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
