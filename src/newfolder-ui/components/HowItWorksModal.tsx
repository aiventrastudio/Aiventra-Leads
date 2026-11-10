import React, { useState } from 'react';
import { X, Play, ArrowRight, CheckCircle2, Zap, Mail, BarChart3, Database } from 'lucide-react';
import { useThemeStyle } from '../context/ThemeStyleContext.tsx';

export const HowItWorksModal: React.FC = () => {
  const { isHowItWorksOpen, setIsHowItWorksOpen, style, activeStyleId, setActiveSlide, setIsCreateWorkspaceOpen } = useThemeStyle();
  const [activeTab, setActiveTab] = useState<number>(0);

  if (!isHowItWorksOpen) return null;

  const isDark = activeStyleId === 'linear-dark' || activeStyleId === 'sunset-nebula';

  const steps = [
    { title: '1. Define Your Search', badge: 'Workspace Settings', icon: <Database className="w-5 h-5 text-blue-500" />, desc: 'Choose the services, keywords, exclusions, budget guidance, and sources that fit your work. Source capture requires configured access.', metric: 'Your search criteria in one place' },
    { title: '2. Review Opportunities', badge: 'Review Queue', icon: <Zap className="w-5 h-5 text-sky-500" />, desc: 'Check project details and match context, then decide which opportunities deserve attention.', metric: 'You choose what moves forward' },
    { title: '3. Prepare an Outreach Draft', badge: 'Approval Required', icon: <Mail className="w-5 h-5 text-indigo-500" />, desc: 'Use opportunity details and reusable templates to prepare a draft. Nothing is sent from this preview.', metric: 'Review every message first' },
    { title: '4. Track Replies and Follow-Ups', badge: 'Integrations Needed', icon: <BarChart3 className="w-5 h-5 text-emerald-500" />, desc: 'Keep replies and follow-up timing visible. Automatic detection and delivery require connected providers.', metric: 'Conversation status at a glance' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl relative transition-all duration-300"
        style={{
          backgroundColor: isDark ? '#121420' : '#ffffff',
          border: `1px solid ${style.cardBorder}`,
          color: style.textPrimary,
        }}
      >
        {/* Close Button */}
        <button
          onClick={() => setIsHowItWorksOpen(false)}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Interactive Product Tour
          </span>
        </div>

        <h3 className="font-['Outfit'] font-bold text-2xl sm:text-3xl tracking-tight mb-2">
          How Aiventra Smart Outsourcing Supports Your Workflow
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
          See how search setup, opportunity review, outreach drafts, and follow-up tracking fit together.
        </p>

        {/* Segmented Step Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl">
          {steps.map((st, idx) => (
            <button
              key={st.title}
              onClick={() => setActiveTab(idx)}
              className={`p-2.5 rounded-xl text-xs font-medium transition-all text-center cursor-pointer ${
                activeTab === idx
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Stage {idx + 1}
            </button>
          ))}
        </div>

        {/* Active Stage Details Card */}
        <div className="p-6 rounded-2xl bg-blue-50/50 dark:bg-slate-900/60 border border-blue-100 dark:border-slate-800 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-xs shrink-0">
              {steps[activeTab].icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <h4 className="font-bold text-base sm:text-lg">{steps[activeTab].title}</h4>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {steps[activeTab].badge}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                {steps[activeTab].desc}
              </p>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{steps[activeTab].metric}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => {
              setIsHowItWorksOpen(false);
              setActiveSlide(2); // take to Opportunity Review
            }}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>Try Interactive Proposal Review</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              setIsHowItWorksOpen(false);
              setIsCreateWorkspaceOpen(true);
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#0055ff] hover:bg-[#0047db] text-white text-xs font-semibold shadow-md cursor-pointer transition-all"
          >
            Create My Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
