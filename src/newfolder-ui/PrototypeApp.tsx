import React, { useEffect } from 'react';
import { ThemeStyleProvider, useThemeStyle } from './context/ThemeStyleContext.tsx';
import { FluidBackground } from './components/FluidBackground.tsx';
import { Navbar } from './components/Navbar.tsx';
import { HeroSlide1 } from './components/HeroSlide1.tsx';
import { ReviewSlide2 } from './components/ReviewSlide2.tsx';
import { RepliesSlide3 } from './components/RepliesSlide3.tsx';
import { WorkflowSlide4 } from './components/WorkflowSlide4.tsx';
import { SlidePaginationDots } from './components/SlidePaginationDots.tsx';
import { HowItWorksModal } from './components/HowItWorksModal.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';

const AppContent: React.FC<{ authOverlay?: React.ReactNode }> = ({ authOverlay }) => {
  const { activeSlide, setActiveSlide, activeStyleId } = useThemeStyle();

  // Keyboard navigation for slides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setActiveSlide(Math.min(3, activeSlide + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setActiveSlide(Math.max(0, activeSlide - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSlide, setActiveSlide]);

  // Scroll to top when active slide changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const el = document.getElementById('slide-scroll-viewport');
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSlide]);

  // Keep dark class on html element in sync when dark styles are active
  useEffect(() => {
    if (activeStyleId === 'linear-dark' || activeStyleId === 'sunset-nebula') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return () => document.documentElement.classList.remove('dark');
  }, [activeStyleId]);

  return (
    <div className="min-h-screen flex flex-col relative font-sans selection:bg-[#0055ff] selection:text-white transition-colors duration-500 overflow-x-hidden">
      {/* Dynamic Fluid Aura Mesh Background */}
      <FluidBackground />

      {/* Top Bar matching screenshot */}
      <Navbar />

      <main id="slide-scroll-viewport" className="flex-1 w-full min-h-[calc(100vh-64px)] relative flex flex-col justify-between pb-28">
        <div className="w-full flex-1 flex flex-col justify-start">
          {activeSlide === 0 && <WorkflowSlide4 />}
          {activeSlide === 1 && <HeroSlide1 />}
          {activeSlide === 2 && <ReviewSlide2 />}
          {activeSlide === 3 && <RepliesSlide3 />}
        </div>
        <SlidePaginationDots />
      </main>

      {/* Modals & Dialogs */}
      <HowItWorksModal />
      {authOverlay}

      {/* In-App Notifications Toast */}
      <ToastContainer />
    </div>
  );
};

export default function App({ onGetStarted, onSignIn, authOverlay }: { onGetStarted: () => void; onSignIn: () => void; authOverlay?: React.ReactNode }) {
  return (
    <ThemeStyleProvider onGetStarted={onGetStarted} onSignIn={onSignIn} externalAuthOpen={Boolean(authOverlay)}>
      <AppContent authOverlay={authOverlay} />
    </ThemeStyleProvider>
  );
}
