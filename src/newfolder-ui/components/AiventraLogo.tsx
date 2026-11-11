import React from 'react';

interface AiventraLogoProps {
  className?: string;
  iconOnly?: boolean;
  light?: boolean;
}

export const AiventraLogo: React.FC<AiventraLogoProps> = ({ className = '', iconOnly = false, light = false }) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Clean vector redraw of the supplied cyan arch and blue wave mark. */}
      <svg viewBox="0 0 106 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-7 transition-transform duration-200 group-hover:scale-105" aria-hidden="true">
        <path d="M15 55C26 35 38 8 52 5C63 3 69 15 75 29L67 35C62 22 58 14 53 14C46 14 36 41 28 55H15Z" fill="#55DDF1" />
        <path d="M57 10C66 14 70 32 76 45C81 54 89 50 94 39L102 44C96 57 86 61 77 55C67 48 63 28 57 17C55 13 53 11 51 11Z" fill="#1267E8" />
        <circle cx="95" cy="29" r="8" fill="#55DDF1" />
      </svg>

      {!iconOnly && (
        <span
          className={`font-['Outfit'] font-bold text-xl sm:text-[22px] tracking-[-0.03em] ${
            light ? 'text-white' : 'text-[#081432] dark:text-white'
          }`}
        >
          Aiventra
        </span>
      )}
    </div>
  );
};

