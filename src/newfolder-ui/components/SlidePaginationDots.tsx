import React from 'react';
import { useThemeStyle } from '../context/ThemeStyleContext.tsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const SlidePaginationDots: React.FC = () => {
  const { activeSlide, setActiveSlide, style } = useThemeStyle();

  const slides = [
    { title: 'Powerful Workflow' },
    { title: 'Smart Outsourcing' },
    { title: 'Review Opportunities' },
    { title: 'Manage Replies' },
  ];

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 flex flex-col items-center gap-1">
      {/* Floating Pill Bar */}
      <div role="group" aria-label={`Page ${activeSlide + 1} of ${slides.length}: ${slides[activeSlide].title}`} className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-white/10 shadow-xl transition-all">
        <button onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))} disabled={activeSlide === 0} className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30" aria-label="Previous page" title="Previous page"><ChevronLeft className="w-4 h-4" /></button>
        <div className="flex items-center gap-2.5">
          {slides.map((_, idx) => {
            const isActive = activeSlide === idx;
            return (
              <button
                key={idx}
                onClick={() => setActiveSlide(idx)}
                aria-label={`Go to ${slides[idx].title}`}
                className={`relative rounded-full border-0 transition-all duration-300 flex items-center justify-center ${
                  isActive
                    ? 'w-3.5 h-3.5 scale-110 shadow-xs'
                    : 'w-2 h-2 opacity-40 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: isActive ? style.accentColor : style.textMuted,
                }}
              >
              </button>
            );
          })}
        </div>
        <button onClick={() => setActiveSlide(Math.min(slides.length - 1, activeSlide + 1))} disabled={activeSlide === slides.length - 1} className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30" aria-label="Next page" title="Next page"><ChevronRight className="w-4 h-4" /></button>

      </div>

    </div>
  );
};
