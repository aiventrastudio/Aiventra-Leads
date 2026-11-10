import React, { useState } from 'react';
import { Palette, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { useThemeStyle } from '../context/ThemeStyleContext.tsx';
import { SAAS_STYLES } from '../data/mockData.ts';
import { SaasStyleId } from '../types.ts';

export const StyleSwitcherBar: React.FC = () => {
  const { activeStyleId, style, setSaasStyle } = useThemeStyle();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <aside
      aria-label="SaaS Theme Controls"
      className="relative z-[60] shrink-0"
    >
      <div className="relative rounded-full border border-white/15 bg-white/10 backdrop-blur-md shadow-sm transition-all">
        {/* Toggle Header Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex max-w-[142px] sm:max-w-[190px] items-center gap-1.5 sm:gap-2 px-2 py-1.5 text-[10px] sm:text-[11px] font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/10 transition-colors cursor-pointer rounded-full"
          aria-expanded={isExpanded}
        >
          <div className="w-5 h-5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Palette className="w-3.5 h-3.5" />
          </div>
          <span className="hidden whitespace-nowrap sm:inline">Style:</span>
          <span className="truncate">{style.name}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
        </button>

        {/* Expanded Style Picker Drawer */}
        {isExpanded && (
          <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-white/10 bg-[#151125]/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in duration-150">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Choose a style
            </div>

            <div className="space-y-1.5">
              {Object.values(SAAS_STYLES).filter((s) => s.id === 'sunset-nebula' || s.id === 'aura-cyan').map((s) => {
                const isSelected = s.id === activeStyleId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSaasStyle(s.id as SaasStyleId)}
                    className={`w-full text-left p-2.5 rounded-xl flex items-start gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? activeStyleId === 'linear-dark' || activeStyleId === 'sunset-nebula'
                          ? 'bg-purple-950/70 border border-purple-500/40 text-purple-200'
                          : 'bg-blue-50 border border-blue-200 text-blue-900 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full mt-0.5 shrink-0 border border-black/15 shadow-2xs"
                      style={{ backgroundColor: s.accentColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate">{s.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-purple-400 shrink-0 ml-1" />}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-400 leading-tight">
                        {s.tagline}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
