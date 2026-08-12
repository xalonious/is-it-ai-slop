import { useEffect, useState } from 'react';

const messages = [
  'Inspecting suspicious pills…',
  'Counting rounded corners…',
  'Measuring Vercel aura…',
  'Searching for gradient text…',
  'Examining hero section formation…',
  'Looking for “crafting digital experiences”…',
  'Detecting excessive motion…',
];

export function AnalysisLoading({ url }: { url: string }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length);
    }, 1750);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="border-t border-line py-7" aria-labelledby="scan-heading">
      <div className="mb-7 h-0.5 overflow-hidden bg-line" aria-hidden="true">
        <span className="block h-full w-1/4 animate-scan-line bg-accent" />
      </div>
      <p className="mb-[18px] max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] font-bold leading-tight tracking-[.13em] text-accent">SCANNING {url}</p>
      <h2 className="m-0 text-[clamp(23px,4vw,36px)] leading-[1.1] font-medium tracking-[-.035em]" id="scan-heading" aria-live="polite">{messages[messageIndex]}</h2>
      <p className="mt-3 text-[13px] leading-normal text-muted">The rendered pages are being inspected. No invented progress percentage.</p>
    </section>
  );
}
