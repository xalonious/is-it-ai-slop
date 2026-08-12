import { useState } from 'react';
import { AnalysisLoading } from './components/AnalysisLoading';
import { ResultReport } from './components/ResultReport';
import { UrlAnalyzerForm } from './components/UrlAnalyzerForm';
import { analysisApi } from './api/analysisApi';
import type { AnalysisError, AnalysisResult } from './types/analysis';

type AppState =
  | { status: 'idle' }
  | { status: 'loading'; url: string }
  | { status: 'success'; result: AnalysisResult }
  | { status: 'error'; url: string; error: AnalysisError };

function Brand() {
  return (
    <a className="inline-flex items-center gap-3 text-xs font-bold tracking-[.08em] text-ink no-underline" href="/" aria-label="Is It AI Slop? home">
      <span className="grid size-7 place-items-center border border-accent text-base leading-none" aria-hidden="true">🤖</span>
      <span>IS IT AI SLOP?</span>
    </a>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-auto flex flex-col items-start gap-3 border-t border-line-strong py-6 font-mono text-[9px] leading-relaxed tracking-[.035em] text-muted uppercase sm:flex-row sm:items-center sm:justify-between sm:gap-7">
      <p className="m-0"><span className="font-bold text-ink">IS IT AI SLOP?</span> A lovingly unscientific portfolio pattern scanner.</p>
      <div className="flex flex-col items-start gap-2 whitespace-nowrap sm:flex-row sm:items-center sm:gap-6">
        <a className="text-ink underline decoration-line-strong underline-offset-4 hover:text-accent hover:decoration-accent" href="https://whoisxander.dev" target="_blank" rel="noreferrer">Made by Xander</a>
      </div>
    </footer>
  );
}

function Home({ state, onAnalyze }: { state: AppState; onAnalyze: (url: string) => void }) {
  const loading = state.status === 'loading';
  const previousUrl = state.status === 'loading' || state.status === 'error' ? state.url : '';

  return (
    <main id="main-content" className="w-full max-w-[820px] flex-1 py-20 sm:py-[clamp(90px,15vh,160px)] sm:pb-16">
      <section className="mb-10 sm:mb-13" aria-labelledby="intro-heading">
        <p className="mb-[18px] font-mono text-[10px] font-bold leading-tight tracking-[.13em] text-accent">PORTFOLIO PATTERN CHECK</p>
        <h1 id="intro-heading" className="m-0 max-w-[760px] text-[clamp(42px,7vw,72px)] leading-[.98] font-semibold tracking-[-.055em]">How familiar does this portfolio feel?</h1>
        <p className="mt-6 max-w-[630px] text-[clamp(17px,2.3vw,21px)] leading-[1.55] text-copy">Paste a public developer portfolio. We’ll look for recognizable AI-era layout, copy, and motion patterns.</p>
      </section>

      <section className="border-y border-line-strong" aria-label="Portfolio analyzer">
        <UrlAnalyzerForm busy={loading} initialUrl={previousUrl} onAnalyze={onAnalyze} />
        {state.status === 'loading' && <AnalysisLoading url={state.url} />}
        {state.status === 'error' && (
          <div className="border-t border-line py-7" role="alert">
            <span className="mb-3.5 block font-mono text-[10px] font-bold tracking-[.08em] text-danger">SCAN ABORTED / {state.error.code}</span>
            <h2 className="m-0 text-[clamp(23px,4vw,36px)] leading-[1.1] font-medium tracking-[-.035em]">{state.error.message}</h2>
            <p className="mt-3 text-[13px] leading-normal text-muted">Check the address, confirm the site is public, then submit it again.</p>
          </div>
        )}
      </section>

      <p className="mt-5 max-w-[560px] font-mono text-[10px] leading-[1.55] text-muted">SlopScore measures observable template patterns. It cannot prove a site was made with AI.</p>
    </main>
  );
}

export default function App() {
  const [state, setState] = useState<AppState>({ status: 'idle' });

  const analyze = async (url: string) => {
    setState({ status: 'loading', url });
    try {
      const result = await analysisApi.analyze({ url });
      setState({ status: 'success', result });
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }));
    } catch (error) {
      setState({ status: 'error', url, error: error as AnalysisError });
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1168px] flex-col px-[15px] sm:px-6">
      <a className="fixed top-3 left-3 z-20 -translate-y-[150%] bg-accent px-3.5 py-2.5 text-white focus:translate-y-0" href="#main-content">Skip to main content</a>
      <header className="flex min-h-18 items-center border-b border-line">
        <Brand />
      </header>
      {state.status === 'success'
        ? <ResultReport result={state.result} onReset={() => setState({ status: 'idle' })} />
        : <Home state={state} onAnalyze={analyze} />}
      <SiteFooter />
    </div>
  );
}
