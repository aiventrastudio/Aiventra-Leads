import React from 'react';
import { useThemeStyle } from '../context/ThemeStyleContext.tsx';

export const FluidBackground: React.FC = () => {
  const { activeStyleId } = useThemeStyle();

  if (activeStyleId === 'linear-dark') {
    return (
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#08090E] transition-colors duration-700">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
        {/* Deep ambient glowing orbs */}
        <div className="absolute -top-[20%] left-[15%] w-[600px] h-[600px] rounded-full bg-indigo-600/15 blur-[120px] animate-fluid" />
        <div className="absolute top-[40%] -right-[10%] w-[550px] h-[550px] rounded-full bg-cyan-600/12 blur-[130px] animate-fluid-delayed" />
        <div className="absolute -bottom-[15%] left-[25%] w-[500px] h-[500px] rounded-full bg-purple-700/10 blur-[140px]" />
      </div>
    );
  }

  if (activeStyleId === 'stripe-enterprise') {
    return (
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#F8FAFC] transition-colors duration-700">
        <div className="absolute -top-40 right-0 w-[800px] h-[600px] bg-gradient-to-bl from-sky-100/60 via-blue-50/40 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[500px] bg-gradient-to-tr from-slate-200/50 via-sky-50/30 to-transparent blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(#0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>
    );
  }

  if (activeStyleId === 'vercel-mono') {
    return (
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#FAFAFA] transition-colors duration-700">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-70" />
        <div className="absolute top-0 right-1/4 w-[500px] h-[400px] bg-gradient-to-b from-zinc-200/40 to-transparent blur-3xl" />
      </div>
    );
  }

  if (activeStyleId === 'sunset-nebula') {
    return (
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#0f071e] transition-colors duration-700">
        <div className="absolute -top-[10%] left-[10%] w-[700px] h-[700px] rounded-full bg-pink-600/20 blur-[130px] animate-fluid" />
        <div className="absolute top-[30%] -right-[10%] w-[650px] h-[650px] rounded-full bg-purple-600/25 blur-[140px] animate-fluid-delayed" />
        <div className="absolute -bottom-[20%] left-[30%] w-[600px] h-[600px] rounded-full bg-indigo-600/20 blur-[130px]" />
      </div>
    );
  }

  // DEFAULT & EXACT MATCH TO SCREENSHOTS: 'aura-cyan'
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#eaf4fe] transition-colors duration-700">
      {/* Upper fluid cyan aura */}
      <div
        className="absolute -top-[15%] left-[5%] w-[80vw] max-w-[1100px] h-[700px] rounded-full blur-[90px] opacity-75 animate-fluid"
        style={{
          background: 'radial-gradient(circle at 40% 40%, rgba(135, 206, 250, 0.75) 0%, rgba(94, 186, 255, 0.45) 45%, rgba(199, 235, 255, 0.15) 80%, transparent 100%)',
        }}
      />

      {/* Right side turquoise & azure luminous swirl (matching right-side glow behind the cards) */}
      <div
        className="absolute top-[10%] -right-[10%] w-[65vw] max-w-[850px] h-[800px] rounded-full blur-[80px] opacity-85 animate-fluid-delayed"
        style={{
          background: 'radial-gradient(circle at 60% 50%, rgba(38, 172, 255, 0.55) 0%, rgba(56, 189, 248, 0.4) 40%, rgba(45, 212, 191, 0.25) 70%, transparent 100%)',
        }}
      />

      {/* Center organic watercolor light diffusion */}
      <div
        className="absolute top-[35%] left-[25%] w-[50vw] max-w-[650px] h-[650px] rounded-full blur-[100px] opacity-60"
        style={{
          background: 'radial-gradient(circle, rgba(224, 242, 254, 0.9) 0%, rgba(186, 230, 253, 0.5) 50%, transparent 80%)',
        }}
      />

      {/* Bottom subtle azure wash */}
      <div
        className="absolute -bottom-[10%] left-[10%] w-[80vw] h-[500px] rounded-full blur-[95px] opacity-70 animate-subtle-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(147, 197, 253, 0.45) 0%, rgba(191, 219, 254, 0.25) 60%, transparent 100%)',
        }}
      />

      {/* Delicate iridescent noise & light refractive edge */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-blue-50/20 mix-blend-overlay pointer-events-none" />
    </div>
  );
};
