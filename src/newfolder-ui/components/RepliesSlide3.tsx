import React from 'react';
import { ArrowRight, Mail, MessageSquare, RefreshCw, CheckCircle2, Briefcase, Trophy, Radio } from 'lucide-react';
import { useThemeStyle } from '../context/ThemeStyleContext.tsx';

export const RepliesSlide3: React.FC = () => {
  const {
    style,
    activeStyleId,
    activityFeed,
    setIsCreateWorkspaceOpen,
    stats,
    setActiveSlide,
  } = useThemeStyle();

  const isDark = activeStyleId === 'linear-dark' || activeStyleId === 'sunset-nebula';

  const getActivityIcon = (iconType: string) => {
    switch (iconType) {
      case 'email':
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Mail className="w-4 h-4" />
          </div>
        );
      case 'reply':
        return (
          <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <MessageSquare className="w-4 h-4" />
          </div>
        );
      case 'schedule':
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <RefreshCw className="w-4 h-4" />
          </div>
        );
      case 'update':
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 flex flex-col justify-center">
      {/* Top Split: Heading (Left) + Interactive Live Activity Feed Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center mb-12">
        {/* Left Column: Heading, Subtext, CTA */}
        <div className="lg:col-span-6 flex flex-col items-start space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-500" />
            <span>Stage 3 · Reply and follow-up review</span>
          </div>

          <h2
            className="font-['Outfit'] text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] leading-tight text-balance"
            style={{ color: style.textPrimary }}
          >
            Manage Replies <br />
            & Follow-Ups
          </h2>

          <p
            className="text-base sm:text-lg max-w-lg leading-relaxed font-normal"
            style={{ color: style.textSecondary }}
          >
            Review reply examples and planned follow-ups. Live updates require connected providers.
          </p>

          <div className="pt-2">
            <button
              onClick={() => setIsCreateWorkspaceOpen(true)}
              className={`px-6 py-3.5 rounded-full font-semibold text-sm sm:text-base flex items-center gap-2.5 transition-all duration-300 cursor-pointer ${style.primaryButton} ${style.primaryButtonHover}`}
            >
              <span>Create workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Exact Activity Feed Card with Live Indicator */}
        <div className="lg:col-span-6 flex flex-col items-center lg:items-end justify-center relative">
          <div
            className="w-full max-w-sm rounded-2xl p-3.5 sm:p-4 relative z-10 transition-all duration-300"
            style={{
              backgroundColor: isDark ? 'rgba(30, 16, 52, 0.75)' : 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${isDark ? 'rgba(216, 180, 254, 0.2)' : 'rgba(255, 255, 255, 0.9)'}`,
              boxShadow: style.cardShadow,
            }}
          >
            {/* Sample activity feed */}
            <div className="flex items-center justify-between mb-3">
              <h3
                className="font-['Outfit'] font-bold text-base sm:text-lg tracking-tight"
                style={{ color: style.textPrimary }}
              >
                Activity Feed
              </h3>

              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-slate-400">Sample activity</span>
            </div>

            {/* List of activities matching exact rows in screenshot */}
            <div className="space-y-1.5">
              {activityFeed.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getActivityIcon(item.icon)}
                    <div className="min-w-0">
                      <div
                        className="font-semibold text-xs truncate"
                        style={{ color: style.textPrimary }}
                      >
                        {item.text}
                      </div>
                      {item.client && (
                        <div className="text-[10px] text-slate-400 truncate">
                          {item.client}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                    {item.timeAgo}
                  </span>
                </div>
              ))}
            </div>

            {/* Bottom info link to workflow */}
            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span>Examples only · no messages sent</span>
              <button
                onClick={() => setActiveSlide(0)}
                className="text-pink-400 hover:text-pink-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View 5-Step Workflow</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="pt-6 sm:pt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-sm font-bold" style={{ color: style.textPrimary }}>Workspace snapshot</h3>
          <span className="rounded-full border px-2.5 py-1 text-[10px]" style={{ borderColor: style.cardBorder, color: style.textMuted }}>Sample metrics</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Opportunities', value: stats.opportunitiesCount, detail: 'Example items in review', icon: <Briefcase className="h-4 w-4" /> },
            { label: 'Replies', value: stats.repliesCount, detail: 'Example conversation events', icon: <MessageSquare className="h-4 w-4" /> },
            { label: 'Closed deals', value: stats.closedDealsCount, detail: 'Example outcome count', icon: <Trophy className="h-4 w-4" /> },
          ].map((metric) => (
            <div key={metric.label} className="flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 sm:px-5" style={{ background: style.cardBg, borderColor: style.cardBorder, boxShadow: style.cardShadow }}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: style.accentGlow, color: style.accentColor }}>{metric.icon}</span>
                <span className="min-w-0 text-left"><b className="block truncate text-xs sm:text-sm" style={{ color: style.textPrimary }}>{metric.label}</b><small className="mt-1 block truncate text-[10px]" style={{ color: style.textMuted }}>{metric.detail}</small></span>
              </div>
              <span className="font-display text-2xl font-bold tracking-tight" style={{ color: style.textPrimary }}>{metric.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
