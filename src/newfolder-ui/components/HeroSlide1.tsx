import React from 'react';
import { ArrowRight, Play, Globe, LineChart, Megaphone, Target, Zap, BarChart3, ShieldCheck } from 'lucide-react';
import { useThemeStyle } from '../context/ThemeStyleContext.tsx';

export const HeroSlide1: React.FC = () => {
  const {
    style,
    activeStyleId,
    opportunities,
    setSelectedOppId,
    setIsCreateWorkspaceOpen,
    setIsHowItWorksOpen,
    setActiveSlide,
  } = useThemeStyle();

  const isDark = activeStyleId === 'linear-dark' || activeStyleId === 'sunset-nebula';

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20 flex flex-col justify-center">
      {/* Top Split: Value Proposition (Left) + Interactive Opportunity Showcase (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center mb-12 lg:mb-16">
        {/* Left Column: Heading & CTAs */}
        <div className="lg:col-span-6 flex flex-col items-start space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Target className="w-3.5 h-3.5 text-blue-500" />
            <span>Product overview · Smart Outsourcing</span>
          </div>

          <h1
            className="font-['Outfit'] text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] leading-[1.1] text-balance"
            style={{ color: style.textPrimary }}
          >
            Aiventra Smart <br />
            Outsourcing
          </h1>

          <p
            className="text-base sm:text-lg max-w-xl leading-relaxed font-normal"
            style={{ color: style.textSecondary }}
          >
            Find and manage the best outsourcing opportunities — all in one powerful workspace.
          </p>

          {/* Action Button Row */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <button
              onClick={() => setIsCreateWorkspaceOpen(true)}
              className={`px-6 py-3.5 rounded-full font-semibold text-sm sm:text-base flex items-center gap-2.5 transition-all duration-300 cursor-pointer ${style.primaryButton} ${style.primaryButtonHover}`}
            >
              <span>Create workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsHowItWorksOpen(true)}
              className="px-5 py-3.5 rounded-full font-medium text-sm sm:text-base flex items-center gap-2.5 transition-all duration-300 cursor-pointer bg-white text-slate-800 hover:bg-slate-50 border border-slate-200/80 shadow-xs dark:bg-white/10 dark:text-white dark:border-white/15"
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
              </div>
              <span>See how it works</span>
            </button>
          </div>
        </div>

        {/* Right Column: Exact 3D Floating Icon + Opportunity Queue Card */}
        <div className="lg:col-span-6 flex flex-col items-center lg:items-end justify-center relative">
          {/* Ambient luminous glow behind the card */}
          <div className="absolute -top-6 -right-4 w-72 h-72 rounded-full bg-blue-500/20 blur-[80px] pointer-events-none -z-10" />

          {/* Floating 3D Paper Airplane Icon Tile (Exact visual motif from screenshot) */}
          <div className="relative mb-[-16px] mr-4 z-20 animate-float">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-[#EC4899] via-[#8B5CF6] to-[#6366F1] p-0.5 shadow-[0_15px_30px_-5px_rgba(236,72,153,0.5)] flex items-center justify-center transform rotate-[-6deg]">
              <div className="absolute inset-0.5 rounded-2xl bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
              <svg
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-md text-white fill-white"
              >
                <path
                  d="M6 22.5L42 7.5L25.5 40.5L20 28.5L6 22.5Z"
                  fill="white"
                  fillOpacity="0.95"
                />
                <path
                  d="M20 28.5L42 7.5L25.5 40.5"
                  stroke="#FAF5FF"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Opportunity Queue Frosted Card */}
          <div
            className="w-full max-w-sm rounded-2xl p-4 sm:p-5 relative z-10 transition-all duration-300"
            style={{
              backgroundColor: isDark ? 'rgba(30, 16, 52, 0.75)' : 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${isDark ? 'rgba(216, 180, 254, 0.2)' : 'rgba(255, 255, 255, 0.9)'}`,
              boxShadow: style.cardShadow,
            }}
          >
            {/* Card Header: Title + Demo Data badge */}
            <div className="flex items-center justify-between mb-3">
              <h2
                className="font-['Outfit'] font-bold text-base sm:text-lg tracking-tight"
                style={{ color: style.textPrimary }}
              >
                Opportunity Queue
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-pink-300 border border-purple-400/25 select-none">
              Sample data
              </span>
            </div>

            {/* List of Opportunities with match scores */}
            <div className="space-y-2">
              {opportunities.slice(0, 3).map((opp) => {
                const getIcon = () => {
                  if (opp.iconType === 'web') return <Globe className="w-4 h-4 text-blue-400" />;
                  if (opp.iconType === 'crm') return <LineChart className="w-4 h-4 text-pink-400" />;
                  return <Megaphone className="w-4 h-4 text-purple-400" />;
                };

                const getBadgeStyle = () => {
                  if (opp.scoreColor === 'green') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold';
                  if (opp.scoreColor === 'blue') return 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold';
                  return 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold';
                };

                return (
                  <button
                    key={opp.id}
                    onClick={() => {
                      setSelectedOppId(opp.id);
                      setActiveSlide(2); // Opportunity review is page 3
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-950/60 flex items-center justify-center shrink-0">
                        {getIcon()}
                      </div>
                      <div>
                        <div
                          className="font-semibold text-xs sm:text-sm group-hover:text-pink-300 transition-colors"
                          style={{ color: style.textPrimary }}
                        >
                          {opp.title}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {opp.budget} · {opp.country}
                        </div>
                      </div>
                    </div>

                    <div className={`px-2.5 py-0.5 rounded-full text-xs font-mono tracking-tight ${getBadgeStyle()}`}>
                      {opp.score}%
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Hint link to Review slide */}
            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span>Click opportunity to generate draft</span>
              <button
                onClick={() => setActiveSlide(2)}
                className="text-pink-400 hover:text-pink-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Review draft</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 4 Feature Cards */}
      <div className="pt-2 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              title: 'Find the right leads',
              desc: 'Targeted opportunity filtering',
              icon: <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
              action: () => setActiveSlide(1),
            },
            {
              title: 'Prepare outreach',
              desc: 'Contextual drafts for review',
              icon: <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
              action: () => setActiveSlide(2),
            },
            {
              title: 'Review activity',
              desc: 'Follow opportunity updates',
              icon: <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
              action: () => setActiveSlide(3),
            },
            {
              title: 'Grow revenue',
              desc: 'Higher win rates on closed briefs',
              icon: <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
              action: () => setActiveSlide(0),
            },
          ].map((item) => (
            <button
              key={item.title}
              onClick={item.action}
              className="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl transition-all duration-300 transform hover:-translate-y-0.5 group text-left cursor-pointer"
              style={{
                backgroundColor: isDark ? 'rgba(30, 16, 52, 0.75)' : 'rgba(255, 255, 255, 0.88)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${isDark ? 'rgba(216, 180, 254, 0.2)' : 'rgba(255, 255, 255, 0.9)'}`,
                boxShadow: style.cardShadow,
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-white/10 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                {item.icon}
              </div>
              <div className="min-w-0">
                <h3
                  className="font-semibold text-xs sm:text-sm truncate"
                  style={{ color: style.textPrimary }}
                >
                  {item.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                  {item.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
