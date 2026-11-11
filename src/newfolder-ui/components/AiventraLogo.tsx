import React from 'react';

interface AiventraLogoProps {
  className?: string;
  iconOnly?: boolean;
  light?: boolean;
}

export const AiventraLogo: React.FC<AiventraLogoProps> = ({ className = '', iconOnly = false, light = false }) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <img src="/assets/logo_original_transparent.png" alt="" aria-hidden="true" draggable={false} className="h-7 w-12 object-contain" />

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

