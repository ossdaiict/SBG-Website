
export const LoadingScreen = () => {
  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center min-h-[70dvh] p-4 relative z-50">

      {/* Background ambient aurora glows - heavily blurred and subtle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-brand/10 blur-[80px] rounded-full animate-pulse"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-[#E84E36]/5 blur-[60px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>

      {/* Central Glass Card matching the premium theme */}
      <div className="glass-card p-10 flex flex-col items-center justify-center gap-8 min-w-[280px] relative z-10 border-white/20 dark:border-white/5">

        {/* Logo Container */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* Subtle spinning dashed rings around logo using brand colors */}
          <div className="absolute inset-0 rounded-full border border-dashed border-brand/40 animate-[spin_8s_linear_infinite]"></div>
          <div className="absolute inset-2 rounded-full border border-dashed border-[#E84E36]/30 animate-[spin_12s_linear_infinite_reverse]"></div>

          <img
            src="/sbg_logo.webp"
            alt="SBG Logo"
            width="80"
            height="80"
            fetchPriority="high"
            decoding="async"
            className="w-20 h-20 object-contain drop-shadow-md"
          />
        </div>

        <div className="flex flex-col items-center gap-4 w-full">
          {/* Text Gradient Title */}
          <h2 className="text-xl font-extrabold tracking-widest text-gradient uppercase">
            SBG DAU
          </h2>

          {/* Thematic Progress Bar */}
          <div className="w-full h-1 bg-borderSoft rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full w-full bg-linear-to-r from-brand to-[#E84E36] rounded-full opacity-70 animate-pulse"></div>
          </div>

          <div className="text-xs font-semibold tracking-widest text-textMuted uppercase mt-1">
            Loading Resources...
          </div>
        </div>

      </div>
    </div>
  );
};
