export type SaasStyleId = 'aura-cyan' | 'linear-dark' | 'stripe-enterprise' | 'vercel-mono' | 'sunset-nebula';

export interface SaasStyleConfig {
  id: SaasStyleId;
  name: string;
  tagline: string;
  badge: string;
  bgGradient: string;
  bgPage: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  primaryButton: string;
  primaryButtonHover: string;
  secondaryButton: string;
  accentColor: string;
  accentGlow: string;
  navBg: string;
  navBorder: string;
  footerBg: string;
  footerBorder: string;
}

export interface Opportunity {
  id: string;
  title: string;
  category: string;
  score: number;
  scoreColor: 'green' | 'blue' | 'purple' | 'amber';
  budget: string;
  client: string;
  country: string;
  description: string;
  postedAgo: string;
  iconType: 'web' | 'crm' | 'marketing' | 'design' | 'ai';
  status: 'new' | 'reviewed' | 'draft_ready' | 'replied';
  sampleDraft: string;
}

export interface ActivityFeedItem {
  id: string;
  icon: 'email' | 'reply' | 'schedule' | 'update' | 'deal';
  text: string;
  client?: string;
  timeAgo: string;
  timestamp: number;
  highlight?: boolean;
}

export interface WorkflowStep {
  step: number;
  title: string;
  iconName: string;
  description: string;
  outcome: string;
}

export interface IntegrationTool {
  name: string;
  category: string;
  status: 'connected' | 'available';
  description: string;
  logoType: string;
  bgColor: string;
}
