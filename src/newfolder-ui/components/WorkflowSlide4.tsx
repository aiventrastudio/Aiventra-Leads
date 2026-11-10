import React, { useEffect, useState } from 'react';
import { Search, Star, Mail, RefreshCw, BarChart3, CheckCircle2, Database, MessageSquare, FileText, Users, Zap, Table2, CreditCard, GitBranch, Bell, CalendarDays, Cloud, LayoutGrid, ChartNoAxesColumnIncreasing, Workflow } from 'lucide-react';
import { useThemeStyle } from '../context/ThemeStyleContext.tsx';
import { WORKFLOW_STEPS, INTEGRATION_TOOLS } from '../data/mockData.ts';

export const WorkflowSlide4: React.FC = () => {
  const { style, activeStyleId } = useThemeStyle();
  const [selectedStep, setSelectedStep] = useState<number>(3);
  const [highlightedTool, setHighlightedTool] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setHighlightedTool((index) => (index + 1) % INTEGRATION_TOOLS.length), 2400);
    return () => window.clearInterval(timer);
  }, []);

  const isDark = activeStyleId === 'linear-dark' || activeStyleId === 'sunset-nebula';

  const getStepIcon = (iconName: string) => {
    switch (iconName) {
      case 'Search':
        return <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'Star':
        return <Star className="w-5 h-5 text-blue-600 dark:text-blue-400 fill-blue-600 dark:fill-blue-400" />;
      case 'Mail':
        return <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 fill-blue-600/30" />;
      case 'RefreshCw':
        return <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'BarChart3':
      default:
        return <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getToolLogo = (logoType: string) => {
    const icons: Record<string, React.ComponentType<{ className?: string }>> = {
      supabase: Database, monday: LayoutGrid, gmail: Mail, slack: MessageSquare, notion: FileText,
      hubspot: Users, zapier: Zap, airtable: Table2, trello: LayoutGrid, drive: Cloud,
      stripe: CreditCard, calendar: CalendarDays, teams: Users, github: GitBranch,
      linear: Workflow, sheets: ChartNoAxesColumnIncreasing, discord: MessageSquare,
    };
    const ToolIcon = icons[logoType] ?? Bell;
    return <ToolIcon className="h-6 w-6" aria-hidden="true" />;
  };

  const currentStepData = WORKFLOW_STEPS.find((s) => s.step === selectedStep) || WORKFLOW_STEPS[0];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 flex flex-col justify-center">
      {/* Top Header */}
      <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20 shrink-0">
        <h2
          className="font-['Outfit'] text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] leading-tight mb-3"
          style={{ color: style.textPrimary }}
        >
          Powerful Workflow in 5 Simple Steps
        </h2>
        <p className="text-base sm:text-lg font-normal" style={{ color: style.textSecondary }}>
          From defining your services to reviewing matched opportunities and preparing outreach.
        </p>
      </div>

      {/* Five independent step markers with breathing room above. */}
      <div className="relative mt-2 w-full max-w-4xl mx-auto mb-12 px-2 shrink-0">
        <div className="absolute left-[10%] right-[10%] top-6 sm:top-8 z-0 h-px" style={{ backgroundColor: isDark ? 'rgba(216, 180, 254, 0.24)' : 'rgba(0, 85, 255, 0.18)' }} aria-hidden="true">
          <span className="block h-full transition-[width] duration-500 ease-out" style={{ width: `${((selectedStep - 1) / (WORKFLOW_STEPS.length - 1)) * 100}%`, backgroundColor: style.accentColor, boxShadow: `0 0 10px ${style.accentGlow}` }} />
        </div>

        {/* 5 Step Nodes */}
        <div className="grid grid-cols-5 gap-2 relative z-10">
          {WORKFLOW_STEPS.map((step) => {
            const isSelected = selectedStep === step.step;
            return (
              <button
                key={step.step}
                onClick={() => setSelectedStep(step.step)}
                className="flex flex-col items-center group cursor-pointer text-center focus:outline-none"
              >
                {/* Outer Circular Icon Node */}
                <div
                  className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isSelected
                      ? isDark
                        ? 'bg-purple-900/90 ring-4 ring-pink-500 shadow-[0_0_25px_rgba(236,72,153,0.5)] scale-110'
                        : 'bg-white ring-4 ring-[#0055ff] shadow-[0_0_25px_rgba(0,85,255,0.25)] scale-110'
                      : 'bg-white/90 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 shadow-xs border border-slate-200/60 dark:border-white/10 hover:scale-105'
                  }`}
                >
                  {getStepIcon(step.iconName)}
                </div>

                {/* Number Badge (1, 2, 3, 4, 5 in circle matching screenshot) */}
                <div
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full text-white flex items-center justify-center font-bold text-[10px] sm:text-xs my-1.5 shadow-xs ${
                    isDark ? 'bg-gradient-to-r from-pink-500 to-purple-600' : 'bg-[#0055ff]'
                  }`}
                >
                  {step.step}
                </div>

                {/* Step Title matching screenshot */}
                <span
                  className={`text-[10px] sm:text-xs font-semibold tracking-tight transition-colors line-clamp-1 ${
                    isSelected
                      ? isDark
                        ? 'text-pink-400 font-bold'
                        : 'text-[#0055ff] font-bold'
                      : 'text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-white'
                  }`}
                >
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Step Detail Drawer / Card */}
        <div
          className="mt-2.5 sm:mt-3 p-3 sm:p-3.5 rounded-2xl transition-all duration-300 max-w-xl mx-auto"
          style={{
            backgroundColor: isDark ? 'rgba(30, 16, 52, 0.75)' : 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${isDark ? 'rgba(216, 180, 254, 0.2)' : 'rgba(255, 255, 255, 0.9)'}`,
            boxShadow: style.cardShadow,
          }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div>
              <div
                className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
                  isDark ? 'text-pink-400' : 'text-[#0055ff]'
                }`}
              >
                Step {currentStepData.step} Focus
              </div>
              <div
                className="font-semibold text-xs sm:text-sm"
                style={{ color: style.textPrimary }}
              >
                {currentStepData.title}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-md">
                {currentStepData.description}
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-400/25 text-[11px] font-medium text-pink-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{currentStepData.outcome}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Slow, continuous integration showcase */}
      <div className="integration-showcase text-center pt-1 shrink-0">
        <h3
          className="font-['Outfit'] font-bold text-xs sm:text-sm tracking-tight mb-2"
          style={{ color: style.textPrimary }}
        >
          Integrate with the tools you love
        </h3>

        <div className="integration-marquee" aria-label="Integration tools">
          <div className="integration-marquee-track">
            {[...INTEGRATION_TOOLS, ...INTEGRATION_TOOLS].map((tool, index) => {
              const active = index % INTEGRATION_TOOLS.length === highlightedTool;
              return (
                <div className={`integration-tool ${active ? 'is-highlighted' : ''}`} key={`${tool.name}-${index}`} aria-label={tool.name}>
                  <span className="integration-tool-icon" style={{ color: active ? style.accentColor : style.textSecondary, background: style.cardBg, borderColor: active ? style.accentColor : style.cardBorder }}>
                    {getToolLogo(tool.logoType)}
                  </span>
                  <span className="integration-tool-name" style={{ color: style.textSecondary }}>{tool.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
