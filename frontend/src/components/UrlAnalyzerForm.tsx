import { type FormEvent, useId, useState } from 'react';

interface Props {
  busy: boolean;
  initialUrl?: string;
  onAnalyze: (url: string) => void;
}

export function UrlAnalyzerForm({ busy, initialUrl = '', onAnalyze }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [localError, setLocalError] = useState('');
  const inputId = useId();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = url.trim();
    if (!value || !value.includes('.')) {
      setLocalError('Enter a public portfolio address, such as example.dev.');
      return;
    }
    setLocalError('');
    onAnalyze(value);
  };

  return (
    <form className="py-7" onSubmit={submit} noValidate>
      <label className="mb-2.5 block font-mono text-[10px] tracking-[.08em] text-muted uppercase" htmlFor={inputId}>Portfolio URL</label>
      <div className="grid grid-cols-1 border border-line-strong bg-surface focus-within:border-copy focus-within:ring-3 focus-within:ring-accent/10 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input
          className="min-h-16 w-full min-w-0 bg-transparent px-5 font-mono text-base text-ink outline-none placeholder:text-[#999b95] disabled:opacity-55"
          id={inputId}
          name="url"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          placeholder="example.dev"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={busy}
          aria-describedby={`${inputId}-note${localError ? ` ${inputId}-error` : ''}`}
        />
        <button className="min-h-12 border-t border-line-strong bg-accent px-5.5 text-xs font-bold text-white transition hover:-translate-y-px hover:bg-[#bd3827] disabled:cursor-wait disabled:bg-[#dedbd2] disabled:text-[#777b76] sm:m-1.5 sm:min-w-[138px] sm:border-0" type="submit" disabled={busy}>{busy ? 'Scanning' : 'Analyze'}</button>
      </div>
      {localError && <p className="mt-2.5 font-mono text-[10px] leading-normal text-danger" id={`${inputId}-error`}>{localError}</p>}
      <p className="mt-2.5 font-mono text-[10px] leading-normal text-muted" id={`${inputId}-note`}>Public HTTP or HTTPS addresses only.</p>
    </form>
  );
}
