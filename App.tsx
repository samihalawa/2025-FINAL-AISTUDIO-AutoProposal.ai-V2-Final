import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { AGENTS } from './constants';
import { ProposalOutput, AnyProposalSection, InvestmentSection, TimelineSection, ExecutiveSummarySection, ProposalTheme, MockupSection, InvestmentLineItem, TimelineMilestone } from './types';
import { runAgent, generateImage } from './services/geminiService';

// --- Reusable Form Field Components ---
const FormField = ({ id, label, children }: { id: string; label: string; children?: React.ReactNode }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-2">
            {label}
        </label>
        {children}
    </div>
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} className="w-full p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition duration-200 text-sm bg-slate-50" />
);

// --- Specific Section Renderer Components ---

const PullQuote = ({ quote }: { quote: string }) => (
    <blockquote>
       <p>"{quote}"</p>
    </blockquote>
);

const InvestmentTable = ({ items }: { items: InvestmentLineItem[] }) => (
    <div className="overflow-x-auto mt-10 border border-slate-200 rounded-lg">
        <table className="w-full text-left">
            <thead className="bg-slate-50/70">
                <tr className="border-b-2 border-slate-200">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Cost</th>
                </tr>
            </thead>
            <tbody className="bg-white">
                {items.map((item, index) => (
                    <tr key={index} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/50 transition-colors duration-200">
                        <td className="px-6 py-5 font-semibold text-slate-800 align-top">{item.item}</td>
                        <td className="px-6 py-5 text-sm text-slate-600 align-top">{item.description}</td>
                        <td className="px-6 py-5 text-right font-mono text-slate-800 align-top whitespace-nowrap">{item.cost}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);


const TimelineVisual = ({ items }: { items: TimelineMilestone[] }) => (
  <div className="relative mt-12 border-l-2 border-teal-200/50 ml-3 pl-12 space-y-20">
    {items.map((item, index) => (
      <div key={index} className="relative">
        <div className="timeline-marker absolute -left-[54px] top-1.5 h-6 w-6 rounded-full bg-white flex items-center justify-center">
            <div className="inner-marker h-4 w-4 rounded-full bg-teal-500 ring-4 ring-white"></div>
        </div>
        <p className="font-bold brand-text text-lg font-sans">{item.phase}</p>
        <p className="text-sm text-slate-500 font-medium mb-2">({item.duration})</p>
        <p className="text-slate-600 mt-1">{item.description}</p>
      </div>
    ))}
  </div>
);

const MockupVisual = ({ imageUrl, prompt }: { imageUrl?: string; prompt: string }) => (
  <div className="mt-10">
    <div className="relative mx-auto border-slate-800 bg-slate-800 border-[8px] rounded-t-xl h-[172px] max-w-[301px] md:h-[294px] md:max-w-[512px]">
        <div className="rounded-xl overflow-hidden h-[156px] md:h-[278px] bg-white">
             {imageUrl ? (
                <img src={imageUrl} alt={prompt} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full bg-slate-200 animate-pulse flex items-center justify-center">
                    <p className="text-slate-400">Generating mockup image...</p>
                </div>
            )}
        </div>
    </div>
    <div className="relative mx-auto bg-slate-700 rounded-b-xl rounded-t-sm h-[17px] max-w-[351px] md:h-[21px] md:max-w-[597px]">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 rounded-b-xl w-[56px] h-[5px] md:w-[96px] md:h-[8px] bg-slate-600"></div>
    </div>
  </div>
);


const SectionContent = ({ section }: { section: AnyProposalSection }) => {
    // Type guard functions
    const isExecSummary = (s: AnyProposalSection): s is ExecutiveSummarySection => s.heading === 'Executive Summary' && 'pullQuote' in s;
    const isInvestment = (s: AnyProposalSection): s is InvestmentSection => s.heading === 'Investment';
    const isTimeline = (s: AnyProposalSection): s is TimelineSection => s.heading === 'Project Timeline & Milestones';
    const isMockup = (s: AnyProposalSection): s is MockupSection => 'mockupImagePrompt' in s;

    if (isExecSummary(section)) {
        return (
            <div>
                 <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: section.content }} />
                 <PullQuote quote={section.pullQuote} />
            </div>
        );
    }
    if (isInvestment(section)) {
        return <InvestmentTable items={section.items} />;
    }
    if (isTimeline(section)) {
        return <TimelineVisual items={section.items} />;
    }
    if (isMockup(section)) {
        return (
             <div>
                {section.content && <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: section.content }} />}
                <MockupVisual imageUrl={section.mockupImageUrl} prompt={section.mockupImagePrompt} />
            </div>
        );
    }
    // Default for TextSection
    return <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: (section as any).content }} />;
};


// --- Proposal Preview Component ---
const ProposalPreview = ({ proposal, isLoading }: { proposal: ProposalOutput | null, isLoading: boolean }) => {
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Initializing...');

    useEffect(() => {
        if (isLoading) {
            setProgress(0);
            setStatusText('Analyzing input...');
            let currentProgress = 0;
            const statuses = [
                { p: 20, text: 'Extracting project details...' },
                { p: 40, text: 'Determining optimal theme...' },
                { p: 60, text: 'Generating content sections...' },
                { p: 80, text: 'Creating visual mockups...' },
                { p: 95, text: 'Finalizing formatting...' },
            ];

            const interval = setInterval(() => {
                currentProgress += 1;
                const status = statuses.find(s => currentProgress === s.p);
                if (status) {
                    setStatusText(status.text);
                }
                setProgress(currentProgress);
                if (currentProgress >= 99) {
                    clearInterval(interval);
                }
            }, 80); // Simulate progress over ~8 seconds

            return () => clearInterval(interval);
        }
    }, [isLoading]);


    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50/50 rounded-lg p-8">
                <div className="text-center w-full max-w-md">
                     <svg className="animate-spin mx-auto h-12 w-12 text-teal-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <h3 className="text-xl font-bold text-slate-800 mb-2 font-sans">Crafting Your Proposal</h3>
                    <p className="text-sm text-slate-500 mb-6">{statusText}</p>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                        <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!proposal) {
        return (
            <div className="flex items-center justify-center h-full bg-white/50 rounded-lg border border-dashed border-slate-300">
                <div className="text-center text-slate-500 p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="mt-4 font-semibold font-sans">Your proposal will appear here.</p>
                    <p className="text-sm mt-1">Provide your project details to get started.</p>
                </div>
            </div>
        );
    }

    const themes: Record<ProposalTheme, Record<string, string>> = {
      CORPORATE_FORMAL: {
        '--brand-color': '#1e40af' /* blue-700 */,
        '--heading-font': "'Poppins', sans-serif",
        '--body-font': "'Lora', serif",
        '--cover-sidebar-bg': '#1e293b' /* slate-800 */,
        '--cover-sidebar-text': '#f1f5f9' /* slate-100 */,
      },
      TECH_MODERN: {
        '--brand-color': '#0d9488' /* teal-600 */,
        '--heading-font': "'Poppins', sans-serif",
        '--body-font': "'Lora', serif",
        '--cover-sidebar-bg': '#18181b' /* zinc-900 */,
        '--cover-sidebar-text': '#f4f4f5' /* zinc-100 */,
      },
      CREATIVE_VIBRANT: {
        '--brand-color': '#be185d' /* pink-700 */,
        '--heading-font': "'Poppins', sans-serif",
        '--body-font': "'Lora', serif",
        '--cover-sidebar-bg': '#581c87' /* purple-900 */,
        '--cover-sidebar-text': '#ffffff',
      },
      ACADEMIC_CLASSIC: {
        '--brand-color': '#881337' /* rose-900 */,
        '--heading-font': "'Poppins', sans-serif",
        '--body-font': "'Lora', serif",
        '--cover-sidebar-bg': '#fdf2f8' /* rose-50 */,
        '--cover-sidebar-text': '#881337' /* rose-900 */,
      }
    };
    
    const currentTheme = themes[proposal.theme] || themes.TECH_MODERN;
    const themeVariables = Object.entries(currentTheme)
        .map(([key, value]) => `${key}: ${value};`)
        .join(' ');

    const totalPages = proposal.sections.length + 1; // +1 for cover page
    
    const pageStyles = `
      :root {
        ${themeVariables}
        --text-color: #334155; /* slate-700 */
        --light-text-color: #64748b; /* slate-500 */
        --heading-color: #0f172a; /* slate-900 */
        --border-color: #e2e8f0; /* slate-200 */
        --page-bg: #ffffff;
        --spacing-unit: 2.5cm;
      }
      .a4-page {
          background: var(--page-bg);
          width: 21cm;
          min-height: 29.7cm;
          display: flex;
          flex-direction: column;
          margin: 0 auto 2.5rem auto;
          box-shadow: 0 20px 50px -10px rgba(0,0,0,0.08);
          color: var(--text-color);
          font-family: var(--body-font);
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid var(--border-color);
      }
      .page-content {
          padding: var(--spacing-unit);
          flex-grow: 1;
      }
      .page-footer {
          flex-shrink: 0;
          padding: 0 var(--spacing-unit);
          height: 1.5cm;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
          font-family: var(--heading-font);
          color: var(--light-text-color);
          border-top: 1px solid var(--border-color);
      }
      .cover-page {
          padding: 0;
          flex-direction: row;
          background-color: var(--cover-sidebar-bg);
          color: var(--cover-sidebar-text);
      }
      .cover-sidebar {
          width: 38%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: var(--spacing-unit);
      }
      .cover-logo {
          font-family: var(--heading-font);
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          opacity: 0.9;
      }
      .cover-sidebar-footer p {
         font-size: 0.8rem;
         opacity: 0.7;
         margin: 0;
      }
      .cover-main {
          width: 62%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 3cm;
          background-color: var(--page-bg);
      }
      .prose {
         line-height: 1.8; color: var(--text-color); font-family: var(--body-font); font-size: 11pt;
      }
      .prose p { margin-bottom: 1.25em; word-wrap: break-word; }
      .prose strong { font-weight: 600; color: var(--heading-color); }
      .content-page-heading {
          font-family: var(--heading-font);
          font-size: 2rem;
          font-weight: 700;
          color: var(--heading-color);
          margin-bottom: 2rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border-color);
          position: relative;
      }
      .content-page-heading::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        width: 60px;
        height: 3px;
        background-color: var(--brand-color);
        border-radius: 2px;
      }
      blockquote {
        margin: 2.5rem 0;
        padding: 1.5rem;
        background-color: #f8fafc; /* slate-50 */
        border-left: 4px solid var(--brand-color);
        border-radius: 0 4px 4px 0;
      }
      blockquote p {
          font-size: 1.3rem; font-style: italic; color: var(--text-color); line-height: 1.6; margin: 0;
      }
      .brand-text { color: var(--brand-color); }
      .timeline-marker { border-color: var(--brand-color); }
      .timeline-marker .inner-marker { background-color: var(--brand-color); }

      .cover-title {
        font-family: var(--heading-font);
        font-size: 3.5rem; 
        font-weight: 700;
        color: var(--heading-color);
        line-height: 1.15;
        margin-bottom: 3rem;
      }
      .cover-client-info { font-family: var(--heading-font); }
      .cover-client-info .prepared-for {
        text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.8rem; font-weight: 600; color: var(--light-text-color); margin-bottom: 0.5rem;
      }
      .cover-client-info .client-name {
        font-size: 1.75rem; font-weight: 600; color: var(--heading-color); margin: 0;
      }
      .cover-client-info .client-attn {
        font-size: 1rem; color: var(--text-color); margin-top: 0.25rem;
      }

      @media (max-width: 768px) {
        .a4-page {
          width: 100%;
          min-height: auto;
          height: auto;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          margin-bottom: 1rem;
          border-radius: 0;
        }
        .page-content, .cover-main, .cover-sidebar {
          padding: 1.5rem;
        }
        .page-footer {
          padding: 1rem 1.5rem;
          height: auto;
        }
        .cover-title {
          font-size: 2.5rem;
          margin-bottom: 2rem;
        }
        .content-page-heading {
          font-size: 1.75rem;
        }
        .cover-page {
          flex-direction: column;
        }
        .cover-sidebar, .cover-main {
          width: 100%;
        }
      }

      @media print {
          body, .bg-slate-100 { background: white !important; }
          .proposal-print-area {
            padding: 0;
            margin: 0;
            box-shadow: none;
            border-radius: 0;
          }
          .a4-page {
              margin: 0;
              box-shadow: none;
              border: none;
              page-break-after: always;
              border-radius: 0;
              overflow: visible;
          }
          .a4-page:last-of-type {
              page-break-after: auto;
          }
      }
    `;

    return (
        <div id="proposal-render-area" className="bg-white shadow-lg rounded-lg md:p-8 overflow-auto h-full proposal-print-area">
             <style>{pageStyles}</style>
            {/* Cover Page */}
            <div className="a4-page cover-page">
              <div className="cover-sidebar">
                  <div className="cover-logo">{proposal.branding.companyLogoText}</div>
                  <div className="cover-sidebar-footer">
                    <p>{proposal.date}</p>
                    <p>{proposal.branding.projectTagline}</p>
                  </div>
              </div>
              <div className="cover-main">
                  <h1 className="cover-title">{proposal.title}</h1>
                  <div className="cover-client-info">
                      <p className="prepared-for">Prepared for</p>
                      <p className="client-name">{proposal.client.companyName}</p>
                      {proposal.client.preparedFor && <p className="client-attn">Attn: {proposal.client.preparedFor}</p>}
                  </div>
              </div>
            </div>

            {/* Content Pages */}
            {proposal.sections.map((section, index) => (
                <div key={index} className="a4-page content-page">
                    <div className="page-content">
                        <h2 className="content-page-heading">{section.heading}</h2>
                        <SectionContent section={section} />
                    </div>
                    <div className="page-footer">
                        <span>{proposal.branding.projectTagline}</span>
                        <span>Page {index + 2} of {totalPages}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};


const App: React.FC = () => {
  const [unstructuredInput, setUnstructuredInput] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposalOutput | null>(null);
  
  const isFormValid = useMemo(() => {
    return unstructuredInput.trim() !== '';
  }, [unstructuredInput]);

  const handleGenerate = useCallback(async () => {
    if (!isFormValid) return;
    setError(null);
    setIsLoading(true);
    setProposal(null);
    try {
      const proposalAgent = AGENTS.find(a => a.name === 'ProposalAgent');
      if (!proposalAgent) {
        throw new Error('ProposalAgent not found');
      }
      const inputs = {
        unstructured: unstructuredInput,
      };
      const prompt = proposalAgent.getPrompt(inputs);
      const result = await runAgent<ProposalOutput>(prompt);

      // --- NEW: Image Generation Step ---
      const imageGenerationPromises = result.sections.map((section, index) => {
        if ('mockupImagePrompt' in section && section.mockupImagePrompt) {
          // It's a MockupSection, let's generate an image
          return generateImage((section as MockupSection).mockupImagePrompt).then(imageUrl => ({
            index,
            imageUrl,
          })).catch(err => {
            console.error(`Failed to generate image for section ${index}:`, err);
            return null; // Don't fail the whole proposal if one image fails
          });
        }
        return Promise.resolve(null);
      });

      const generatedImages = await Promise.all(imageGenerationPromises);

      const updatedSections = [...result.sections];
      generatedImages.forEach(imageResult => {
        if (imageResult) {
          (updatedSections[imageResult.index] as MockupSection).mockupImageUrl = imageResult.imageUrl;
        }
      });

      const finalProposal = {
        ...result,
        sections: updatedSections,
      };
      
      setProposal(finalProposal);

    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [unstructuredInput, isFormValid]);
  
  const handleDownloadHtml = () => {
    if (!proposal) return;

    const renderArea = document.getElementById('proposal-render-area');
    if (!renderArea) {
      console.error('Render area not found');
      return;
    }

    // Clone the node to avoid modifying the live DOM
    const clone = renderArea.cloneNode(true) as HTMLElement;

    // Find all images and replace src with base64 data URL if it's a generated image
    const imagePromises = Array.from(clone.getElementsByTagName('img')).map(img => {
        if (img.src.startsWith('data:image')) {
            return Promise.resolve();
        }
        return fetch(img.src)
            .then(response => response.blob())
            .then(blob => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        img.src = reader.result as string;
                        resolve(null);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            })
            .catch(error => console.error('Error converting image to base64:', error));
    });

    Promise.all(imagePromises).then(() => {
        const styles = clone.querySelector('style')?.innerHTML || '';
        const content = Array.from(clone.children).filter(el => el.tagName !== 'STYLE').map(el => el.outerHTML).join('');

        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${proposal.title}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>${styles}</style>
            </head>
            <body class="bg-slate-100">
                <div class="proposal-print-area md:p-8">${content}</div>
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${proposal.title.replace(/ /g, '_')}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800">
      <style>
        {`
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
            }
            header, aside { display: none !important; }
            main {
              width: 100% !important; height: auto !important; padding: 0 !important; margin: 0 !important; overflow-y: visible !important; background: white !important;
            }
            div.lg\\:h-\\[calc\\(100vh-88px\\)\\] { height: auto !important; }
          }
        `}
      </style>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 h-22">
        <div className="container mx-auto px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold text-slate-900">AI Proposal Generator</h1>
            <p className="text-sm text-slate-500">Generate comprehensive proposals from any project notes.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
                onClick={handleDownloadHtml}
                disabled={!proposal || isLoading}
                className="px-4 py-2 rounded-md font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0 text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /> </svg>
                <span className="hidden sm:inline">Download HTML</span>
            </button>
            <button
                onClick={() => window.print()}
                disabled={!proposal || isLoading}
                className="px-4 py-2 rounded-md font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0 text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v3a2 2 0 002 2h6a2 2 0 002-2v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>
                <span className="hidden sm:inline">Print to PDF</span>
            </button>
           </div>
        </div>
      </header>
      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-88px)]">
        {/* Left Panel: Form */}
        <aside className="w-full lg:w-1/3 bg-white p-8 border-b lg:border-r lg:border-b-0 border-slate-200 flex flex-col">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Project Details</h2>
          <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="space-y-6 flex-grow flex flex-col">
            <div className="flex-grow">
              <FormField id="unstructuredInput" label="Provide any project details">
                    <Textarea 
                        id="unstructuredInput"
                        value={unstructuredInput}
                        onChange={(e) => setUnstructuredInput(e.target.value)}
                        placeholder="Paste meeting notes, a client brief, or any project description. The AI will do the rest."
                        rows={15}
                        required
                    />
                </FormField>
            </div>

            {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
            
            <div className="pt-4 sticky bottom-0 bg-white">
              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="w-full px-6 py-3.5 rounded-lg font-semibold text-white bg-teal-500 hover:bg-teal-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing...
                  </>
                ) : 'Generate Proposal'}
              </button>
            </div>
          </form>
        </aside>

        {/* Right Panel: Preview */}
        <main className="w-full lg:w-2/3 p-4 sm:p-8 lg:p-12 bg-slate-100 overflow-y-auto">
          <ProposalPreview proposal={proposal} isLoading={isLoading} />
        </main>
      </div>
    </div>
  );
};

export default App;