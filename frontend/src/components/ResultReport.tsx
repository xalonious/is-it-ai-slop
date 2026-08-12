import type { AnalysisResult, Finding, SlopCategory } from '../types/analysis';

const CATEGORY_LABELS: Record<SlopCategory, string> = {
  layout: 'Layout',
  copy: 'Copy',
  stack: 'Stack signals',
  animation: 'Motion',
  template: 'Template energy',
};

const severityCode = (score: number) => {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'ELEVATED';
  if (score >= 20) return 'TRACE';
  return 'LOW';
};

function FindingRow({ finding, index }: { finding: Finding; index: number }) {
  return (
    <article className="grid grid-cols-[24px_minmax(0,1fr)_48px] border-b border-line sm:grid-cols-[34px_minmax(0,1fr)_58px]">
      <div className="pt-6 font-mono text-[9px] text-[#9a9c96]" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
      <div className="py-5.5 pr-2.5 sm:pr-5.5 sm:pb-6">
        <div className="mb-2 font-mono text-[9px] tracking-[.08em] text-accent uppercase">{finding.category}</div>
        <h3 className="mb-2 text-[clamp(18px,2.5vw,24px)] leading-[1.15] font-medium tracking-[-.025em]">{finding.title}</h3>
        <p className="m-0 max-w-[720px] text-sm leading-[1.55] text-muted">{finding.description}</p>
        {finding.evidence.length > 0 && (
          <div className="mt-4 max-w-[740px] border-t border-line pt-3.5">
            <p className="mb-2 font-mono text-[8px] tracking-[.08em] text-muted uppercase">Observed evidence</p>
            <ul className="m-0 list-none p-0 font-mono text-[10px] leading-[1.6] text-copy">
              {finding.evidence.map((evidence, evidenceIndex) => <li key={`${evidence}-${evidenceIndex}`}><span className="text-accent">— </span>{evidence}</li>)}
            </ul>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end pt-5.5 font-mono text-accent" aria-label={`${finding.points} points`}>
        <span className="text-xl font-bold">{finding.points > 0 ? `+${finding.points}` : '0'}</span>
        <small className="mt-1 text-[7px] tracking-[.1em]">PTS</small>
      </div>
    </article>
  );
}

export function ResultReport({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const hostname = (() => {
    try { return new URL(result.url).hostname; } catch { return result.url; }
  })();

  return (
    <main className="flex-1 py-13 sm:py-18" id="main-content">
      <header className="flex flex-col items-start gap-6 border-b border-line-strong pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-[18px] font-mono text-[10px] font-bold leading-tight tracking-[.13em] text-accent">SCAN COMPLETE</p>
          <h1 className="m-0 max-w-[760px] [overflow-wrap:anywhere] text-[clamp(34px,6vw,58px)] leading-none font-semibold tracking-[-.05em]">{hostname}</h1>
        </div>
        <button className="shrink-0 border-0 border-b border-line-strong bg-transparent py-2.5 font-mono text-[11px] text-muted hover:border-accent hover:text-accent" type="button" onClick={onReset}>New scan</button>
      </header>

      <section className="grid grid-cols-1 gap-8 border-b border-line py-11 md:grid-cols-[210px_minmax(0,1fr)] md:gap-11" aria-labelledby="score-label">
        <div>
          <span className="mb-3 block font-mono text-[10px] tracking-[.08em] text-muted uppercase" id="score-label">SlopScore</span>
          <strong className="block text-[clamp(72px,11vw,112px)] leading-[.78] font-semibold tracking-[-.075em] text-accent">{result.score}<small className="ml-1 font-mono text-[11px] tracking-normal text-muted">/100</small></strong>
        </div>
        <div className="self-center">
          <span className="font-mono text-[9px] font-bold tracking-[.12em] text-accent">{severityCode(result.score)} SIGNAL</span>
          <h2 className="my-2.5 text-[clamp(28px,4.5vw,48px)] leading-none font-medium tracking-[-.045em]">{result.severity}</h2>
          <p className="m-0 text-[13px] text-muted">This is a pattern reading, not proof that AI authored the site.</p>
        </div>
        <dl className="col-span-1 mt-0.5 flex flex-wrap gap-5.5 border-t border-line pt-5.5 md:col-span-2 md:gap-9">
          <div className="min-w-[110px] basis-full md:flex-1"><dt className="mb-1.5 font-mono text-[9px] text-muted uppercase">Page</dt><dd className="m-0 [overflow-wrap:anywhere] font-mono text-[11px] leading-normal text-copy">{result.metadata.title || hostname}</dd></div>
          <div className="min-w-[110px]"><dt className="mb-1.5 font-mono text-[9px] text-muted uppercase">Scan time</dt><dd className="m-0 font-mono text-[11px] text-copy">{(result.metadata.durationMs / 1000).toFixed(1)}s</dd></div>
          <div className="min-w-[110px]"><dt className="mb-1.5 font-mono text-[9px] text-muted uppercase">Pages</dt><dd className="m-0 font-mono text-[11px] text-copy">{result.metadata.pagesScanned ?? 1}</dd></div>
          <div className="min-w-[110px]"><dt className="mb-1.5 font-mono text-[9px] text-muted uppercase">Findings</dt><dd className="m-0 font-mono text-[11px] text-copy">{result.findings.filter((finding) => finding.points > 0).length}</dd></div>
        </dl>
      </section>

      <section className="border-b border-line pt-11.5 pb-12" aria-labelledby="category-heading">
        <div className="mb-5.5 flex items-baseline justify-between gap-5"><h2 className="m-0 text-[19px] font-medium tracking-[-.02em]" id="category-heading">Signals</h2></div>
        <div className="border-t border-line">
          {(Object.entries(result.categories) as Array<[SlopCategory, number]>).map(([category, score]) => (
            <div className="grid min-h-12 grid-cols-[105px_minmax(0,1fr)_28px] items-center gap-2.5 border-b border-line font-mono text-[9px] text-copy uppercase sm:grid-cols-[150px_minmax(0,1fr)_34px] sm:gap-4.5 sm:text-[10px]" key={category}>
              <span>{CATEGORY_LABELS[category]}</span>
              <div className="h-[3px] bg-line" aria-hidden="true"><i className="block h-full bg-accent transition-[width] duration-[350ms]" style={{ width: `${score}%` }} /></div>
              <strong className="text-right text-ink">{score}</strong>
              <span className="sr-only">out of 100</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pt-11.5" aria-labelledby="findings-heading">
        <div className="mb-5.5 flex items-baseline justify-between gap-5">
          <h2 className="m-0 text-[19px] font-medium tracking-[-.02em]" id="findings-heading">Findings</h2>
          <p className="m-0 font-mono text-[9px] text-muted uppercase">Highest impact first</p>
        </div>
        {result.findings.length > 0
          ? <div className="border-t border-line-strong">{result.findings.map((finding, index) => <FindingRow key={`${finding.detectorId}-${index}`} finding={finding} index={index} />)}</div>
          : <p className="m-0 py-6.5 text-sm text-muted">No recognizable template traits cleared the reporting threshold. Alarmingly tasteful.</p>}
      </section>

      <footer className="mt-12 flex flex-col items-start justify-between gap-2 border-t border-line pt-4.5 font-mono text-[9px] leading-normal text-muted uppercase sm:flex-row">
        <p className="m-0">Pattern analysis only. Not evidence of authorship.</p>
        <time dateTime={result.metadata.scannedAt}>{new Date(result.metadata.scannedAt).toLocaleString()}</time>
      </footer>
    </main>
  );
}
