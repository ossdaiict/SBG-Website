import { motion } from 'framer-motion';
import React from 'react';

interface GradientBackgroundProps {
  className?: string;
  children?: React.ReactNode;
  /** Force dark style (useful when theme context not yet available) */
  forceDark?: boolean;
}

/**
 * Full-screen gradient background with 2–3 blurred radial gradient blobs.
 * Stripe-inspired: indigo → purple → blue glow accents.
 * In light mode: subtle gradient. In dark mode: deep navy with vibrant blobs.
 */
export function GradientBackground({ className = '', children, forceDark = false }: GradientBackgroundProps) {
  return (
    <div className={`fixed inset-0 -z-10 overflow-hidden ${className}`}>
      {/* Base - light in light mode, deep navy in dark */}
      <div className="absolute inset-0 bg-bgMain dark:bg-[#0A0F1F] transition-colors duration-300" />
      
      {/* Radial gradient blobs - visible in dark mode only */}
      <motion.div
        className="hidden dark:block absolute -top-1/2 -left-1/4 w-[80%] aspect-square rounded-full opacity-40 blur-[120px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(44, 62, 138, 0.4) 0%, rgba(232, 78, 54, 0.2) 40%, transparent 70%)',
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0)',
        }}
        animate={{
          x: [0, 30, 0],
          y: [0, -20, 0],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="hidden dark:block absolute top-1/2 -right-1/4 w-[60%] aspect-square rounded-full opacity-30 blur-[100px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(232, 78, 54, 0.35) 0%, rgba(253, 192, 47, 0.15) 50%, transparent 70%)',
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0)',
        }}
        animate={{
          x: [0, -25, 0],
          y: [0, 15, 0],
          scale: [1, 1.08, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
      />
      <motion.div
        className="hidden dark:block absolute -bottom-1/4 left-1/3 w-[50%] aspect-square rounded-full opacity-25 blur-[80px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(253, 192, 47, 0.3) 0%, rgba(44, 62, 138, 0.1) 50%, transparent 70%)',
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0)',
        }}
        animate={{
          x: [0, 20, 0],
          y: [0, -15, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
      />

      {children}
    </div>
  );
}
