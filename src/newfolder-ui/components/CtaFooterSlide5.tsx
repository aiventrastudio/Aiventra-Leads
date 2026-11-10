import React from 'react';
import { ArrowRight, Shield, Star, Lock } from 'lucide-react';
import { AiventraLogo } from './AiventraLogo.tsx';
import { useThemeStyle } from '../context/ThemeStyleContext.tsx';

export const CtaFooterSlide5: React.FC = () => {
  const { style, activeStyleId, setIsCreateWorkspaceOpen, setActiveSlide, addToast } = useThemeStyle();

  const isDark = activeStyleId === 'linear-dark' || activeStyleId === 'sunset-nebula';

  return (
    <div className="w-full flex flex-col justify-between">
      {/* Top CTA & 3D Laptop Section */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center mb-12">
          {/* Left Column: Heading, Subtext, CTA */}
          <div className="lg:col-span-6 flex flex-col items-start space-y-4 sm:space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Lock className="w-3.5 h-3.5 text-blue-500" />
              <span>Stage 5 · Enterprise Workspace</span>
            </div>

            <h2
              className="font-['Outfit'] text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] leading-tight text-balance"
              style={{ color: style.textPrimary }}
            >
              Ready to Find <br />
              More Opportunities?
            </h2>

            <p
              className="text-base sm:text-lg max-w-lg leading-relaxed font-normal"
              style={{ color: style.textSecondary }}
            >
              Bring your search, opportunity review, and outreach drafts into one focused workspace.
            </p>

            <div className="pt-2">
              <button
                onClick={() => setIsCreateWorkspaceOpen(true)}
                className={`px-7 py-3.5 rounded-full font-semibold text-sm sm:text-base flex items-center gap-2.5 transition-all duration-300 cursor-pointer ${style.primaryButton} ${style.primaryButtonHover}`}
              >
                <span>Create workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Column: 3D Laptop with Glowing Screen */}
          <div className="lg:col-span-6 flex items-center justify-center relative">
            <div
              className="absolute w-72 h-72 rounded-full blur-[90px] pointer-events-none -z-10"
              style={{ backgroundColor: isDark ? 'rgba(236,72,153,0.25)' : 'rgba(0,145,255,0.35)' }}
            />

            {/* Floating 3D Bar Chart Badge (matching screenshot aiven6) */}
            <div className="absolute -top-3 right-6 sm:right-12 z-20 animate-float">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/95 dark:bg-slate-800/95 p-2.5 shadow-2xl border border-white/80 dark:border-white/10 flex items-center justify-center transform rotate-6">
                <div className="flex items-end gap-1.5 h-8">
                  <div className="w-2 h-3.5 bg-blue-400 rounded-t-xs" />
                  <div className="w-2 h-5.5 bg-blue-500 rounded-t-xs" />
                  <div className="w-2 h-7 bg-blue-600 rounded-t-xs" />
                  <div className="w-2 h-8 bg-[#0055ff] rounded-t-xs" />
                </div>
              </div>
            </div>

            {/* 3D Laptop Container */}
            <div className="w-full max-w-sm sm:max-w-md relative z-10 pt-2">
              <div className="relative mx-auto w-[90%] sm:w-[340px] h-[190px] rounded-t-2xl bg-gradient-to-b from-slate-800 to-slate-950 p-3 shadow-2xl border border-slate-700/80">
                <div className="w-2 h-2 rounded-full bg-slate-700 mx-auto mb-2" />

                <div className="w-full h-[150px] rounded-xl bg-gradient-to-br from-[#060B1A] via-[#0B1530] to-[#040814] flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
                  {/* Glowing Screen Aura */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,145,255,0.35)_0%,transparent_70%)]" />

                  {/* Centered Glowing Aiventra Monogram */}
                  <div className="relative z-10 flex flex-col items-center gap-1.5">
                    <AiventraLogo iconOnly={true} className="scale-125 drop-shadow-[0_0_15px_rgba(0,145,255,0.8)]" />
                    <span className="text-[10px] tracking-widest uppercase font-mono text-cyan-300 font-semibold">
                      Aiventra Smart Outsourcing
                    </span>
                  </div>

                  {/* Subtle code/terminal grid lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
                </div>
              </div>

              {/* Laptop Keyboard Base & Hinge */}
              <div className="relative mx-auto w-full h-[14px] bg-gradient-to-b from-slate-700 to-slate-900 rounded-b-xl shadow-2xl flex items-center justify-center border-t border-slate-600">
                <div className="w-16 h-1 bg-slate-500/80 rounded-full" />
              </div>

              {/* Electric blue glow ellipse below base */}
              <div className="w-[85%] mx-auto h-2.5 bg-blue-500/40 blur-md rounded-full mt-0.5" />
            </div>
          </div>
        </div>

        {/* Trust & Rating Strip (matching screenshot aiven6) */}
        <div
          className="w-full max-w-4xl mx-auto rounded-3xl p-4 sm:p-5 transition-all duration-300"
          style={{
            backgroundColor: isDark ? 'rgba(30, 16, 52, 0.75)' : 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${isDark ? 'rgba(216, 180, 254, 0.2)' : 'rgba(255, 255, 255, 0.9)'}`,
            boxShadow: style.cardShadow,
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center divide-y sm:divide-y-0 sm:divide-x divide-slate-200/60 dark:divide-white/10 text-left">
            {/* Left: Secure & Trusted */}
            <div className="flex items-center gap-3 sm:pr-6">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 fill-blue-500/20" />
              </div>
              <div>
                <div
                  className="font-bold text-sm sm:text-base"
                  style={{ color: style.textPrimary }}
                >
                  Secure & Trusted
                </div>
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Workspace records are stored in your authenticated Supabase account.
                </div>
              </div>
            </div>

            {/* Right: 4.9/5 Rating */}
            <div className="flex items-center gap-3 pt-3 sm:pt-0 sm:pl-6">
              <div className="w-11 h-11 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                <Star className="w-6 h-6 fill-current text-amber-400" />
              </div>
              <div>
                <div
                  className="font-bold text-sm sm:text-base"
                  style={{ color: style.textPrimary }}
                >
                  Human review
                </div>
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  You stay in control of every outreach draft.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Bleed Authentic Dark Navy Footer (matching screenshot aiven6 exactly) */}
      <footer className="w-full bg-[#060B1A] text-white pt-14 pb-10 border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
            {/* Column 1: Brand & Tagline */}
            <div className="md:col-span-5 flex flex-col items-start space-y-3">
              <AiventraLogo light={true} />
              <p className="text-sm text-slate-400 max-w-xs">
                Smarter Outsourcing, Bigger Opportunities.
              </p>
            </div>

            {/* Column 2: Product */}
            <div className="md:col-span-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Product
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <button onClick={() => setActiveSlide(0)} className="hover:text-blue-400 transition-colors cursor-pointer">
                    Product Tour
                  </button>
                </li>
                <li>
                  <button onClick={() => addToast({ type: 'info', title: 'Pricing', message: 'Starter $0 · Pro $49 · Enterprise' })} className="hover:text-blue-400 transition-colors cursor-pointer">
                    Pricing
                  </button>
                </li>
                <li>
                  <button onClick={() => addToast({ type: 'info', title: 'FAQ', message: 'Frequently asked questions loaded.' })} className="hover:text-blue-400 transition-colors cursor-pointer">
                    FAQ
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Company */}
            <div className="md:col-span-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Company
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <button onClick={() => addToast({ type: 'info', title: 'About Aiventra Smart Outsourcing', message: 'Leading AI outsourcing discovery engine.' })} className="hover:text-blue-400 transition-colors cursor-pointer">
                    About
                  </button>
                </li>
                <li>
                  <button onClick={() => addToast({ type: 'info', title: 'Blog', message: 'Read latest agency growth insights.' })} className="hover:text-blue-400 transition-colors cursor-pointer">
                    Blog
                  </button>
                </li>
                <li>
                  <button onClick={() => addToast({ type: 'info', title: 'Careers', message: 'We are hiring across engineering and sales!' })} className="hover:text-blue-400 transition-colors cursor-pointer">
                    Careers
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Resources & Socials */}
            <div className="md:col-span-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Resources
              </div>
              <ul className="space-y-2 text-sm text-slate-300 mb-4">
                <li>
                  <button onClick={() => addToast({ type: 'info', title: 'Help Center', message: 'Documentation and tutorials.' })} className="hover:text-blue-400 transition-colors cursor-pointer">
                    Help Center
                  </button>
                </li>
                <li>
                  <button onClick={() => addToast({ type: 'info', title: 'Docs', message: 'Developer API and webhooks guide.' })} className="hover:text-blue-400 transition-colors cursor-pointer">
                    Docs
                  </button>
                </li>
                <li>
                  <button onClick={() => addToast({ type: 'info', title: 'Community', message: 'Join 10k+ founders on Discord.' })} className="hover:text-blue-400 transition-colors cursor-pointer">
                    Community
                  </button>
                </li>
              </ul>

              {/* Social icons */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  onClick={() => addToast({ type: 'info', title: 'LinkedIn', message: 'Navigating to LinkedIn.' })}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors text-xs font-bold cursor-pointer"
                  aria-label="LinkedIn"
                >
                  in
                </button>
                <button
                  onClick={() => addToast({ type: 'info', title: 'X', message: 'Navigating to @aiventra.' })}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors text-xs font-bold cursor-pointer"
                  aria-label="X"
                >
                  𝕏
                </button>
                <button
                  onClick={() => addToast({ type: 'info', title: 'YouTube', message: 'Opening product walkthroughs.' })}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors text-xs font-bold cursor-pointer"
                  aria-label="YouTube"
                >
                  ▶
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Divider & Copyright Strip */}
          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div>© {new Date().getFullYear()} Aiventra Smart Outsourcing</div>
            <div className="flex items-center gap-6">
              <button onClick={() => addToast({ type: 'info', title: 'Privacy Policy', message: 'Enterprise data compliance and privacy.' })} className="hover:text-white transition-colors cursor-pointer">
                Privacy Policy
              </button>
              <button onClick={() => addToast({ type: 'info', title: 'Terms of Service', message: 'Standard platform agreement.' })} className="hover:text-white transition-colors cursor-pointer">
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
