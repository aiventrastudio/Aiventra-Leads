import React, { createContext, useContext, useState, useEffect } from 'react';
import { SaasStyleConfig, SaasStyleId, Opportunity, ActivityFeedItem } from '../types.ts';
import { SAAS_STYLES, INITIAL_OPPORTUNITIES, INITIAL_ACTIVITY_FEED } from '../data/mockData.ts';
import confetti from 'canvas-confetti';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'action';
  title: string;
  message: string;
}

interface ThemeStyleContextType {
  activeStyleId: SaasStyleId;
  style: SaasStyleConfig;
  setSaasStyle: (id: SaasStyleId) => void;
  // Slides & Auto-Play
  activeSlide: number;
  setActiveSlide: (index: number) => void;
  opportunities: Opportunity[];
  selectedOppId: string;
  setSelectedOppId: (id: string) => void;
  selectedOpportunity: Opportunity | undefined;
  activityFeed: ActivityFeedItem[];
  sendDraft: (oppId: string, customDraft?: string) => void;
  addOpportunity: (opp: Partial<Opportunity>) => void;
  // Modals
  isCreateWorkspaceOpen: boolean;
  setIsCreateWorkspaceOpen: (open: boolean) => void;
  isHowItWorksOpen: boolean;
  setIsHowItWorksOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  // Toasts
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  // Stats
  stats: {
    opportunitiesCount: number;
    repliesCount: number;
    closedDealsCount: number;
  };
}

const ThemeStyleContext = createContext<ThemeStyleContextType | undefined>(undefined);

export const ThemeStyleProvider: React.FC<{
  children: React.ReactNode;
  onGetStarted?: () => void;
  onSignIn?: () => void;
  externalAuthOpen?: boolean;
}> = ({ children, onGetStarted, onSignIn, externalAuthOpen = false }) => {
  const [activeStyleId, setActiveStyleId] = useState<SaasStyleId>(() => {
    try {
      const savedStyle = localStorage.getItem('aiventra:saas-style');
      if (savedStyle === 'sunset-nebula' || savedStyle === 'aura-cyan') return savedStyle;
    } catch {}
    return 'sunset-nebula';
  });
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [slideProgress, setSlideProgress] = useState<number>(0);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(INITIAL_OPPORTUNITIES);
  const [selectedOppId, setSelectedOppId] = useState<string>('opp-1');
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>(INITIAL_ACTIVITY_FEED);
  
  // Modals
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState<boolean>(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    try { localStorage.setItem('aiventra:saas-style', activeStyleId); } catch {}
  }, [activeStyleId]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const style = SAAS_STYLES[activeStyleId] || SAAS_STYLES['aura-cyan'];

  const setSaasStyle = (id: SaasStyleId) => {
    setActiveStyleId(id);
    addToast({
      type: 'info',
      title: `Switched to ${SAAS_STYLES[id].name}`,
      message: `Visual theme updated with custom tokens and typography weighting.`,
    });
  };

  const selectedOpportunity = opportunities.find((o) => o.id === selectedOppId) || opportunities[0];

  const stats = {
    opportunitiesCount: opportunities.length + 9, // matching 12 in the screenshot
    repliesCount: 8,
    closedDealsCount: 4,
  };

  const sendDraft = (oppId: string, customDraft?: string) => {
    const targetOpp = opportunities.find((o) => o.id === oppId);
    if (!targetOpp) return;

    // Trigger confetti
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#0055ff', '#38bdf8', '#4ade80', '#ffffff'],
      });
    } catch {
      // fallback if confetti fails
    }

    // Update opportunity status
    setOpportunities((prev) =>
      prev.map((o) =>
        o.id === oppId
          ? {
              ...o,
              status: 'draft_ready',
              sampleDraft: customDraft || o.sampleDraft,
            }
          : o
      )
    );

    // Add to activity feed
    const newActivity: ActivityFeedItem = {
      id: `act-${Date.now()}`,
      icon: 'email',
      text: `Outreach draft prepared for ${targetOpp.client}`,
      client: targetOpp.client,
      timeAgo: 'Just now',
      timestamp: Date.now(),
      highlight: true,
    };

    setActivityFeed((prev) => [newActivity, ...prev.slice(0, 5)]);

    addToast({
      type: 'success',
      title: 'Draft ready for review',
      message: `Your personalized draft is ready for ${targetOpp.client}. Nothing was sent.`,
    });
  };

  const addOpportunity = (newOppData: Partial<Opportunity>) => {
    const newOpp: Opportunity = {
      id: `opp-${Date.now()}`,
      title: newOppData.title || 'Mobile App Architecture',
      category: newOppData.category || 'Engineering & Cloud',
      score: newOppData.score || 94,
      scoreColor: 'green',
      budget: newOppData.budget || '$12,000 - $18,000',
      client: newOppData.client || 'Apex Ventures EU',
      country: newOppData.country || 'Germany',
      description: newOppData.description || 'Target opportunity matched by AI workspace criteria.',
      postedAgo: 'Just now',
      iconType: 'web',
      status: 'new',
      sampleDraft: `Hi ${newOppData.client || 'there'},\nI saw your project brief and would be glad to learn more about what you need. Would you be open to a short conversation?`,
    };

    setOpportunities((prev) => [newOpp, ...prev]);
    setSelectedOppId(newOpp.id);

    try {
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.5 },
      });
    } catch {}

    addToast({
      type: 'success',
      title: 'Workspace Configured & Opportunity Ingested',
      message: `Added "${newOpp.title}" with a ${newOpp.score}% match score to your queue.`,
    });
  };

  // Auto-advance the presentation every eight seconds.
  const SLIDE_DURATION_MS = 8000;
  const TICK_INTERVAL_MS = 100;

  useEffect(() => {
    // Pause auto-sliding while a modal dialog is actively open
    if (isCreateWorkspaceOpen || isHowItWorksOpen || isAuthModalOpen || externalAuthOpen) return;

    const interval = setInterval(() => {
      setSlideProgress((prev) => {
        const next = prev + (TICK_INTERVAL_MS / SLIDE_DURATION_MS) * 100;
        if (next >= 100) {
          return 100;
        }
        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isCreateWorkspaceOpen, isHowItWorksOpen, isAuthModalOpen, externalAuthOpen]);

  // Trigger slide transition when progress hits 100%
  useEffect(() => {
    if (slideProgress >= 100) {
      setActiveSlide((curr) => (curr + 1) % 4);
      setSlideProgress(0);
    }
  }, [slideProgress]);

  const handleSetActiveSlide = (index: number) => {
    setActiveSlide(index);
    setSlideProgress(0);
  };

  return (
    <ThemeStyleContext.Provider
      value={{
        activeStyleId,
        style,
        setSaasStyle,
        activeSlide,
        setActiveSlide: handleSetActiveSlide,
        opportunities,
        selectedOppId,
        setSelectedOppId,
        selectedOpportunity,
        activityFeed,
        sendDraft,
        addOpportunity,
        isCreateWorkspaceOpen,
        setIsCreateWorkspaceOpen: (open) => {
          if (open && onGetStarted) onGetStarted();
          else setIsCreateWorkspaceOpen(open);
        },
        isHowItWorksOpen,
        setIsHowItWorksOpen,
        isAuthModalOpen: isAuthModalOpen || externalAuthOpen,
        setIsAuthModalOpen: (open) => {
          if (open && onSignIn) onSignIn();
          else setIsAuthModalOpen(open);
        },
        toasts,
        addToast,
        removeToast,
        stats,
      }}
    >
      {children}
    </ThemeStyleContext.Provider>
  );
};

export const useThemeStyle = () => {
  const context = useContext(ThemeStyleContext);
  if (!context) {
    throw new Error('useThemeStyle must be used within a ThemeStyleProvider');
  }
  return context;
};
