import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Sparkles, Mail, BarChart3, Menu, X } from 'lucide-react';
import { AiventraLogo } from './AiventraLogo.tsx';
import { StyleSwitcherBar } from './StyleSwitcherBar.tsx';
import { useThemeStyle } from '../context/ThemeStyleContext.tsx';

export const Navbar: React.FC = () => {
  const {
    style,
    activeStyleId,
    setIsAuthModalOpen,
    setActiveSlide,
  } = useThemeStyle();

  const [activeMenu, setActiveMenu] = useState<'product' | 'workflow' | 'integrations' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDark = activeStyleId === 'linear-dark' || activeStyleId === 'sunset-nebula';

  const navigateToSection = (slideIndex: number) => {
    setActiveMenu(null);
    setMobileMenuOpen(false);
    setActiveSlide(slideIndex);
  };

  return (
    <header
      ref={navRef}
      className="sticky top-0 z-50 w-full transition-all duration-300 shrink-0"
      style={{
        backgroundColor: style.navBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${style.navBorder}`,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-6 shrink-0">
          <button
            onClick={() => navigateToSection(0)}
            className="flex items-center text-left focus:outline-none group cursor-pointer"
            aria-label="Aiventra Smart Outsourcing home"
          >
            <AiventraLogo light={isDark} />
          </button>
        </div>

        {/* Center Nav Zone - exact 3 dropdowns from screenshots: Product ⌵, Workflow ⌵, Integrations ⌵ */}
        <nav style={{ color: style.textPrimary, backgroundColor: mobileMenuOpen ? style.navBg : undefined }} className={`${mobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row items-stretch md:items-center gap-1 absolute top-16 left-0 right-0 p-3 md:p-0 md:static border-b md:border-0 border-slate-200 dark:border-white/10 md:bg-transparent shadow-lg md:shadow-none`}>
          {/* Product Dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'product' ? null : 'product')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-colors cursor-pointer ${
                activeMenu === 'product'
                  ? 'bg-black/5 dark:bg-white/10'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{ color: style.textPrimary }}
              aria-expanded={activeMenu === 'product'}
            >
              <span>Product</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  activeMenu === 'product' ? 'rotate-180' : ''
                }`}
                style={{ color: style.textMuted }}
              />
            </button>

            {activeMenu === 'product' && (
              <div
                className="absolute top-full left-0 mt-2 w-80 rounded-2xl p-3 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 z-50"
                style={{
                  backgroundColor: isDark ? '#141622' : '#ffffff',
                  border: `1px solid ${style.cardBorder}`,
                  color: style.textPrimary,
                }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider px-3 py-1 text-purple-400">
                  Aiventra Smart Outsourcing
                </div>
                <div className="space-y-1 mt-1">
                  <button
                    onClick={() => navigateToSection(1)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 flex items-start gap-3 transition-colors cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Smart Opportunity Matcher</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Match scores help you review opportunities against your criteria.
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigateToSection(2)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 flex items-start gap-3 transition-colors cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Outreach Draft Review</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Contextual proposal drafts ready to send in 1 click.
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => navigateToSection(3)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 flex items-start gap-3 transition-colors cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 shrink-0">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Live Follow-Up Stream</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Review replies and keep follow-up status organized.
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Workflow Dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'workflow' ? null : 'workflow')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-colors cursor-pointer ${
                activeMenu === 'workflow'
                  ? 'bg-black/5 dark:bg-white/10'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{ color: style.textPrimary }}
              aria-expanded={activeMenu === 'workflow'}
            >
              <span>Workflow</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  activeMenu === 'workflow' ? 'rotate-180' : ''
                }`}
                style={{ color: style.textMuted }}
              />
            </button>

            {activeMenu === 'workflow' && (
              <div
                className="absolute top-full left-0 mt-2 w-84 rounded-2xl p-3 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 z-50"
                style={{
                  backgroundColor: isDark ? '#141622' : '#ffffff',
                  border: `1px solid ${style.cardBorder}`,
                  color: style.textPrimary,
                }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider px-3 py-1 text-blue-600 dark:text-blue-400">
                  5-Step Pipeline Lifecycle
                </div>
                <div className="space-y-1.5 mt-2">
                  {[
                    { step: '01', title: 'Define Services', desc: 'Tag skills and ideal client profiles' },
                    { step: '02', title: 'Review Opportunities', desc: 'Review match details' },
                    { step: '03', title: 'Prepare Outreach', desc: 'Personalized pitch generation' },
                    { step: '04', title: 'Manage Follow-ups', desc: 'Configurable follow-up timing' },
                    { step: '05', title: 'Track Results', desc: 'Closed revenue and ROI dashboard' },
                  ].map((s, idx) => (
                    <button
                      key={s.step}
                      onClick={() => navigateToSection(0)}
                      className="w-full text-left p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between text-xs transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 flex items-center justify-center font-mono font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-medium">{s.title}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Integrations Dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'integrations' ? null : 'integrations')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-colors cursor-pointer ${
                activeMenu === 'integrations'
                  ? 'bg-black/5 dark:bg-white/10'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{ color: style.textPrimary }}
              aria-expanded={activeMenu === 'integrations'}
            >
              <span>Integrations</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  activeMenu === 'integrations' ? 'rotate-180' : ''
                }`}
                style={{ color: style.textMuted }}
              />
            </button>

            {activeMenu === 'integrations' && (
              <div
                className="absolute top-full left-0 mt-2 w-80 rounded-2xl p-3 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 z-50"
                style={{
                  backgroundColor: isDark ? '#141622' : '#ffffff',
                  border: `1px solid ${style.cardBorder}`,
                  color: style.textPrimary,
                }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider px-3 py-1 text-blue-600 dark:text-blue-400">
                  Available Integrations
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { name: 'Supabase', desc: 'Workspace data and authentication' },
                    { name: 'Gmail', desc: 'Email provider connection required' },
                    { name: 'Slack', desc: 'Team alerts after setup' },
                    { name: 'Notion', desc: 'Share briefs after setup' },
                    { name: 'Monday.com', desc: 'Project boards after setup' },
                    { name: 'Zapier / Webhooks', desc: 'Automation after setup' },
                  ].map((tool) => (
                    <button
                      key={tool.name}
                      onClick={() => navigateToSection(0)}
                      className="text-left p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="text-xs font-semibold">{tool.name}</div>
                      <div className="text-[10px] text-slate-400">{tool.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Right Zone: Style and Sign In */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            className="md:hidden p-2 rounded-lg border border-slate-200 dark:border-white/15"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <StyleSwitcherBar />
          {/* Exact "Sign in" Pill Button */}
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="px-4 sm:px-5 py-1.5 sm:py-2 text-xs font-semibold rounded-full transition-all duration-200 select-none cursor-pointer bg-[#081432] text-white hover:bg-slate-800 shadow-sm dark:bg-white dark:text-slate-900"
          >
            Sign in
          </button>
        </div>
      </div>
    </header>
  );
};
