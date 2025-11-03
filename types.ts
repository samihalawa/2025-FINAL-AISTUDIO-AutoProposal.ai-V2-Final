
export interface InvestmentLineItem {
  item: string;
  description: string;
  cost: string;
}

export interface TimelineMilestone {
  phase: string;
  description: string;
  duration: string;
}

// A generic section with paragraph content
export interface TextSection {
  heading: string;
  content: string;
}

// A special section for the executive summary with a pull quote
export interface ExecutiveSummarySection extends TextSection {
  heading: 'Executive Summary';
  pullQuote: string;
}

// A section for the investment table
export interface InvestmentSection {
  heading: 'Investment';
  items: InvestmentLineItem[];
}

// A section for the timeline
export interface TimelineSection {
  heading: 'Project Timeline & Milestones';
  items: TimelineMilestone[];
}

// A section for a visual mockup/preview
export interface MockupSection {
  heading: string;
  content?: string; // Optional descriptive text for the mockup
  mockupImagePrompt: string;
  mockupImageUrl?: string; // Will be populated after generation
}


export type AnyProposalSection = TextSection | ExecutiveSummarySection | InvestmentSection | TimelineSection | MockupSection;

export interface Branding {
  companyLogoText: string;
  projectTagline: string;
}

export type ProposalTheme = 'CORPORATE_FORMAL' | 'TECH_MODERN' | 'CREATIVE_VIBRANT' | 'ACADEMIC_CLASSIC';

export interface ProposalOutput {
  title: string;
  client: {
    companyName: string;
    preparedFor?: string; // Optional contact person
  };
  date: string;
  branding: Branding;
  theme: ProposalTheme;
  sections: AnyProposalSection[];
}