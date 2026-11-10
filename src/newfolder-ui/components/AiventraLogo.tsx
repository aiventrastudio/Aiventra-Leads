import React from 'react';

interface AiventraLogoProps {
  className?: string;
  iconOnly?: boolean;
  light?: boolean;
}

export const AiventraLogo: React.FC<AiventraLogoProps> = ({ className = '', iconOnly = false, light = false }) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Original ribbon mark inspired by the brand's flowing silhouette. */}
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 drop-shadow-xs transition-transform duration-200 group-hover:scale-105" aria-hidden="true">
        <path d="M3.5 25.5C8.8 15.8 10.4 7 16.4 6.2c4.8-.6 7.3 5.1 10.1 15.1" stroke="#54DDF5" strokeWidth="5.2" strokeLinecap="round" />
        <path d="M7.1 25.4c3.5-3.5 6.5-7.1 10-7.1 3.1 0 4.6 3.3 7.8 3.3 1.7 0 2.7-.8 3.6-1.8" stroke="#2478F2" strokeWidth="5.2" strokeLinecap="round" />
        <circle cx="28" cy="9" r="3" fill="#54DDF5" />
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

