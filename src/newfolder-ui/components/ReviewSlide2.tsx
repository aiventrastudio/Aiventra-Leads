import React, { useState } from 'react';
import { ArrowRight, Send, CheckCircle2, Globe, LineChart, Megaphone, Sparkles, RefreshCw, ShieldCheck } from 'lucide-react';
import { useThemeStyle } from '../context/ThemeStyleContext.tsx';

export const ReviewSlide2: React.FC = () => {
  const {
    style,
    activeStyleId,
    opportunities,
    selectedOppId,
    setSelectedOppId,
    selectedOpportunity,
    sendDraft,
    setIsCreateWorkspaceOpen,
  } = useThemeStyle();

  const [draftContent, setDraftContent] = useState<string>(
    selectedOpportunity?.sampleDraft ||
      "Hi there,\nI saw your project brief and would be glad to learn more about what you need. Would you be open to a short conversation?"
  );
  const [isSending, setIsSending] = useState<boolean>(false);

  // Update draft content when selected opportunity changes
  React.useEffect(() => {
    if (selectedOpportunity) {
      setDraftContent(selectedOpportunity.sampleDraft);
    }
  }, [selectedOpportunity]);

  const isDark = activeStyleId === 'linear-dark' || activeStyleId === 'sunset-nebula';

  const handleSend = () => {
    setIsSending(true);
    setTimeout(() => {
      sendDraft(selectedOppId, draftContent);
      setIsSending(false);
    }, 400);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 flex flex-col justify-center">
      {/* Top Split: Text (Left) + Interactive Opportunity Selection & Review Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Heading, Subtext, CTA */}
        <div className="lg:col-span-5 flex flex-col items-start space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Stage 2 · Opportunity review</span>
          </div>

          <h2
            className="font-['Outfit'] text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] leading-tight text-balance"
            style={{ color: style.textPrimary }}
          >
            Review <br />
            Opportunities
          </h2>

          <p
            className="text-base sm:text-lg max-w-md leading-relaxed font-normal"
            style={{ color: style.textSecondary }}
          >
            Compare the sample matches, review the suggested message, and prepare a draft for approval.
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

          {/* Quick stats callout */}
          <div className="pt-3 flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <span className="font-bold block text-lg font-mono" style={{ color: style.textPrimary }}>96%</span>
              <span className="text-xs">Example match score</span>
            </div>
            <div className="w-px h-8 bg-black/10 dark:bg-white/10" />
            <div>
              <span className="font-bold block text-lg font-mono" style={{ color: style.textPrimary }}>&lt; 30s</span>
              <span className="text-xs">Draft preview</span>
            </div>
          </div>
        </div>

      {/* Separate opportunity and draft cards, aligned beside the workspace action. */}
      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 items-start gap-4 lg:gap-5 relative">
          {/* Opportunity Queue */}
          <div
            className="w-full max-w-sm rounded-2xl p-3 sm:p-3.5 relative z-10 transition-all duration-300"
            style={{
              backgroundColor: isDark ? 'rgba(30, 16, 52, 0.75)' : 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${isDark ? 'rgba(216, 180, 254, 0.2)' : 'rgba(255, 255, 255, 0.9)'}`,
              boxShadow: style.cardShadow,
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <h3
                className="font-['Outfit'] font-bold text-sm sm:text-base tracking-tight"
                style={{ color: style.textPrimary }}
              >
                Opportunity Queue
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-pink-300 border border-purple-400/25">
                Sample data
              </span>
            </div>

            <div className="space-y-1.5">
              {opportunities.slice(0, 3).map((opp) => {
                const isSelected = opp.id === selectedOppId;
                const getIcon = () => {
                  if (opp.iconType === 'web') return <Globe className="w-3.5 h-3.5 text-blue-400" />;
                  if (opp.iconType === 'crm') return <LineChart className="w-3.5 h-3.5 text-pink-400" />;
                  return <Megaphone className="w-3.5 h-3.5 text-purple-400" />;
                };

                return (
                  <div key={opp.id} className="relative">
                    <button
                      onClick={() => setSelectedOppId(opp.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'bg-purple-900/60 ring-2 ring-pink-500/80 shadow-md scale-[1.01]'
                          : 'bg-white/5 hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-950/60 flex items-center justify-center shrink-0">
                          {getIcon()}
                        </div>
                        <div>
                          <div
                            className={`font-semibold text-xs ${
                              isSelected ? 'text-pink-300' : ''
                            }`}
                            style={{ color: isSelected ? undefined : style.textPrimary }}
                          >
                            {opp.title}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {opp.client} · {opp.budget}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          opp.scoreColor === 'green'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : opp.scoreColor === 'blue'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        }`}
                      >
                        {opp.score}%
                      </span>
                    </button>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Review Proposal Draft */}
          <div
            className="w-full max-w-sm rounded-2xl p-3.5 sm:p-4 relative z-20 transition-all duration-300"
            style={{
              backgroundColor: isDark ? 'rgba(30, 16, 52, 0.85)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${isDark ? 'rgba(216, 180, 254, 0.25)' : 'rgba(255, 255, 255, 0.95)'}`,
              boxShadow: style.cardShadow,
            }}
          >
            {/* Draft review is deliberately separate from delivery. */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-pink-500 text-white flex items-center justify-center shadow-xs">
                  <Send className="w-3 h-3 transform rotate-45" />
                </div>
                <h3
                  className="font-['Outfit'] font-bold text-base tracking-tight"
                  style={{ color: style.textPrimary }}
                >
                  Review
                </h3>
              </div>

              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Needs approval</span>
              </div>
            </div>

            <div className="mb-3 min-h-[92px] rounded-xl border p-3 text-xs leading-relaxed whitespace-pre-line" style={{ background: isDark ? 'rgba(8, 5, 20, .42)' : '#f7faff', color: style.textSecondary, borderColor: style.cardBorder }}>
              {draftContent}
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleSend}
              disabled={isSending || selectedOpportunity?.status === 'draft_ready'}
              className={`w-full py-2.5 rounded-full font-semibold text-xs flex items-center justify-center gap-2 transition-all duration-300 shadow-md cursor-pointer ${
                selectedOpportunity?.status === 'draft_ready'
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-95 text-white'
              }`}
            >
              {selectedOpportunity?.status === 'draft_ready' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Prepared · Awaiting Approval</span>
                </>
              ) : isSending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Preparing Draft...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 transform rotate-45" />
                  <span>Prepare for approval</span>
                </>
              )}
            </button>

            <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400"/><span>Approval required · Nothing is sent from this preview.</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
