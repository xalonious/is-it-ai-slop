import { chromium, type Browser, type BrowserContext, type Page, type Response as PlaywrightResponse } from 'playwright';
import { UnsafeUrlError, UrlGuard } from './urlSecurity';
import type { AnalysisContext, FrameworkFingerprints, PortfolioScan } from './types';

const VIEWPORT = { width: 1440, height: 1000 };
const NAVIGATION_TIMEOUT_MS = 15_000;
const SKIPPED_CRAWL_PATH = /\.(?:avif|css|csv|docx?|gif|ico|jpe?g|json|mp3|mp4|pdf|png|rss|svg|txt|webm|webp|xml|zip)$/i;
const SKIPPED_ROUTE = /^\/(?:api|admin|auth|login|logout|sign-?in|sign-?out|download|feed|rss)(?:\/|$)/i;

const installNetworkGuard = async (
  context: BrowserContext,
  guard: UrlGuard,
  onBlockedNavigation: (error: UnsafeUrlError) => void,
): Promise<void> => {
  await context.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    let parsed: URL;

    try {
      parsed = new URL(requestUrl);
    } catch {
      await route.abort('blockedbyclient');
      return;
    }

    if (['data:', 'blob:'].includes(parsed.protocol)) {
      await route.continue();
      return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      await route.abort('blockedbyclient');
      return;
    }

    try {
      let redirectCount = 0;
      for (let previous = route.request().redirectedFrom(); previous; previous = previous.redirectedFrom()) redirectCount += 1;
      if (redirectCount > 5) throw new UnsafeUrlError('The site redirected too many times.');
      await guard.assertPublic(requestUrl);
      const resourceType = route.request().resourceType();
      if (resourceType === 'media' || resourceType === 'font') {
        await route.abort('blockedbyclient');
      } else {
        await route.continue();
      }
    } catch (error) {
      if (route.request().isNavigationRequest() && error instanceof UnsafeUrlError) {
        onBlockedNavigation(error);
      }
      await route.abort('blockedbyclient');
    }
  });
};

const extractContext = async (
  page: Page,
  requestedUrl: string,
  isEntryPage: boolean,
): Promise<AnalysisContext> => {
  const extracted = await page.evaluate(() => {
    const clean = (value: string | null | undefined, max = 240) =>
      (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    const number = (value: string) => Number.parseFloat(value) || 0;
    const radius = (value: string) =>
      Math.max(...value.split(/[ /]+/).map(number).filter(Number.isFinite), 0);
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 4 && rect.height > 4;
    };
    const documentElements = [
      document.documentElement,
      ...(document.body ? [document.body] : []),
      ...Array.from(document.body?.querySelectorAll('*') ?? []),
    ];
    const elementIndexes = new Map(documentElements.map((element, index) => [element, index]));
    const snapshot = (element: Element) => {
      const html = element as HTMLElement;
      const nodeIndex = elementIndexes.get(element) ?? -1;
      const style = getComputedStyle(element);
      const pseudoStyles = ['::before', '::after'].map((pseudo) => getComputedStyle(element, pseudo));
      const rect = element.getBoundingClientRect();
      const parentIndex = element.parentElement ? elementIndexes.get(element.parentElement) : undefined;
      return {
        nodeIndex,
        tag: element.tagName.toLowerCase(),
        text: clean(html.innerText || element.textContent, 1_500),
        ariaLabel: clean(element.getAttribute('aria-label')) || undefined,
        role: clean(element.getAttribute('role')) || undefined,
        ariaBusy: element.getAttribute('aria-busy') === 'true',
        href: element instanceof HTMLAnchorElement ? element.href : undefined,
        src:
          element instanceof HTMLImageElement || element instanceof HTMLScriptElement
            ? element.src
            : undefined,
        classes: Array.from(element.classList).slice(0, 24),
        parentIndex,
        childTags: Array.from(element.children).slice(0, 16).map((child) => child.tagName.toLowerCase()),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        fontSize: number(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
        fontFamily: clean(style.fontFamily, 300),
        whiteSpace: style.whiteSpace,
        borderRadius: radius(style.borderRadius),
        borderTopWidth: number(style.borderTopWidth),
        borderTopStyle: style.borderTopStyle,
        borderTopColor: clean(style.borderTopColor),
        backgroundImage: clean(style.backgroundImage, 1_000),
        backgroundSize: clean(style.backgroundSize),
        backgroundRepeat: clean(style.backgroundRepeat),
        pseudoBackgroundImage: clean(pseudoStyles.map((pseudo) => pseudo.backgroundImage).filter((value) => value !== 'none').join(', '), 1_000),
        pseudoBackgroundSize: clean(pseudoStyles.map((pseudo) => pseudo.backgroundSize).filter((value) => value !== 'auto').join(', ')),
        pseudoBackgroundRepeat: clean(pseudoStyles.map((pseudo) => pseudo.backgroundRepeat).filter(Boolean).join(', ')),
        backgroundColor: clean(style.backgroundColor),
        backdropFilter: clean(style.backdropFilter),
        boxShadow: clean(style.boxShadow, 1_000),
        textShadow: clean(style.textShadow, 1_000),
        filter: clean(style.filter, 500),
        position: style.position,
        pointerEvents: style.pointerEvents,
        contentEditable: html.isContentEditable,
        opacity: number(style.opacity),
        display: style.display,
        gridColumns: clean(style.gridTemplateColumns),
        textTransform: style.textTransform,
        animationName: clean(style.animationName),
        transitionProperty: clean(style.transitionProperty),
        transform: clean(style.transform),
      };
    };

    const allVisible = documentElements
      .filter(visible)
      .slice(0, 650);
    const select = (selector: string, limit: number) =>
      Array.from(document.querySelectorAll(selector)).filter(visible).slice(0, limit).map(snapshot);
    const scripts = Array.from(document.scripts).map((script) => script.src).filter(Boolean).slice(0, 100);
    const stylesheets = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
      .map((link) => link.href)
      .filter(Boolean)
      .slice(0, 100);
    const metadataEntries = (selector: string, attribute: 'name' | 'property') =>
      Object.fromEntries(
        Array.from(document.querySelectorAll<HTMLMetaElement>(selector))
          .map((meta) => [clean(meta.getAttribute(attribute), 100).toLowerCase(), clean(meta.content, 2_000)] as const)
          .filter(([key, content]) => key && content),
      );
    const description = clean(document.querySelector<HTMLMetaElement>('meta[name="description" i]')?.content, 2_000) || undefined;
    const generator = clean(document.querySelector<HTMLMetaElement>('meta[name="generator" i]')?.content, 300) || undefined;
    const canonicalUrl = document.querySelector<HTMLLinkElement>('link[rel="canonical" i]')?.href || undefined;
    const faviconUrls = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel*="icon" i]'))
      .map((link) => link.href)
      .filter(Boolean)
      .slice(0, 12);
    const openGraph = {
      ...metadataEntries('meta[name^="og:" i]', 'name'),
      ...metadataEntries('meta[property^="og:" i]', 'property'),
    };
    const twitter = {
      ...metadataEntries('meta[property^="twitter:" i]', 'property'),
      ...metadataEntries('meta[name^="twitter:" i]', 'name'),
    };

    const animations = document.getAnimations().slice(0, 100).map((animation) => {
      const effect = animation.effect as KeyframeEffect | null;
      const target = effect?.target as Element | null;
      const keyframes = (effect?.getKeyframes() ?? []).slice(0, 6).map((frame) => ({
        opacity: typeof frame.opacity === 'number' ? frame.opacity : Number.parseFloat(String(frame.opacity)),
        transform: clean(String(frame.transform ?? '')) || undefined,
      }));
      return {
        name: clean((animation as CSSAnimation).animationName || effect?.constructor.name),
        target: target ? `${target.tagName.toLowerCase()}.${Array.from(target.classList).slice(0, 3).join('.')}` : 'unknown',
        keyframes,
      };
    });

    const documentMarkers = [
      document.documentElement.className,
      document.body?.className ?? '',
      ...documentElements
        .slice(0, 1_000)
        .map((element) => `${element.id} ${Array.from(element.classList).slice(0, 8).join(' ')}`),
      ...Array.from(document.querySelectorAll('[data-radix-collection-item], [data-framer-name], [data-slot]'))
        .slice(0, 20)
        .map((element) => element.outerHTML.slice(0, 160)),
    ].join(' ').toLowerCase();
    const resources = [...scripts, ...stylesheets].join(' ').toLowerCase();
    const generatorMarker = generator?.toLowerCase() ?? '';

    return {
      title: clean(document.title, 300) || undefined,
      finalUrl: location.href,
      visibleText: clean(document.body?.innerText, 50_000),
      elements: allVisible.map(snapshot),
      headings: select('h1, h2, h3', 80),
      buttons: select('button, [role="button"], a[class*="button"], a[class*="btn"]', 100),
      links: select('a[href]', 180),
      images: select('img, picture, svg', 140),
      sections: select('main > section, body > section, section[id], [data-section]', 50),
      animations,
      scripts,
      stylesheets,
      metadata: {
        description,
        generator,
        canonicalUrl,
        faviconUrls,
        openGraph,
        twitter,
        htmlLang: clean(document.documentElement.lang, 40) || undefined,
      },
      markers: { documentMarkers, resources, generator: generatorMarker },
    };
  });

  const markers = `${extracted.markers.documentMarkers} ${extracted.markers.resources} ${extracted.markers.generator}`;
  const technologies: FrameworkFingerprints = {
    react: /react|__next|vite/.test(markers) || (await page.locator('#root, #__next').count()) > 0,
    next: /__next|_next\/static|next\.js/.test(markers),
    vite: /@vite|\/assets\/index-[\w-]+\.js/.test(markers),
    tailwind: /\b(sm|md|lg|xl):|\b(bg|text|grid|flex|rounded|px|py)-/.test(markers),
    shadcn: /data-slot|--radius|shadcn/.test(markers),
    radix: /data-radix|radix-ui/.test(markers),
    lucide: /lucide|iconify-tabler/.test(markers),
    framerMotion: /framer-motion|data-framer|motion-dom/.test(markers),
    vercel: /vercel|_vercel/.test(markers) || new URL(extracted.finalUrl).hostname.endsWith('.vercel.app'),
  };

  return {
    requestedUrl,
    finalUrl: extracted.finalUrl,
    isEntryPage,
    title: extracted.title,
    visibleText: extracted.visibleText,
    documentMarkers: extracted.markers.documentMarkers,
    viewport: VIEWPORT,
    elements: extracted.elements,
    headings: extracted.headings,
    buttons: extracted.buttons,
    links: extracted.links,
    images: extracted.images,
    sections: extracted.sections,
    animations: extracted.animations,
    scripts: extracted.scripts,
    stylesheets: extracted.stylesheets,
    technologies,
    metadata: extracted.metadata,
  };
};

interface CrawlCandidate {
  url: string;
  priority: number;
}

const normalizeCrawlUrl = (input: string, origin: string): string | undefined => {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return undefined;
  }

  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) return undefined;
  if (SKIPPED_CRAWL_PATH.test(url.pathname) || SKIPPED_ROUTE.test(url.pathname)) return undefined;

  url.hash = '';
  url.search = '';
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
};

const crawlPriority = (url: string, text: string): number => {
  const value = `${new URL(url).pathname} ${text}`.toLowerCase();
  if (/project|portfolio|case.?stud|selected.?work/.test(value)) return 0;
  if (/\bwork\b|about/.test(value)) return 1;
  if (/experience|resume|career/.test(value)) return 2;
  if (/contact/.test(value)) return 3;
  return 10;
};

const discoverCrawlCandidates = (
  context: AnalysisContext,
  origin: string,
  seen: Set<string>,
): CrawlCandidate[] => {
  const candidates: CrawlCandidate[] = [];
  for (const link of context.links) {
    if (!link.href) continue;
    const url = normalizeCrawlUrl(link.href, origin);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    candidates.push({ url, priority: crawlPriority(url, `${link.text} ${link.ariaLabel ?? ''}`) });
  }
  return candidates.sort((a, b) => a.priority - b.priority || a.url.localeCompare(b.url));
};

export const scanPortfolio = async (
  url: URL,
  guard: UrlGuard,
  overallTimeoutMs = 25_000,
  maxPages = 4,
): Promise<PortfolioScan> => {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let timedOut = false;
  const overallTimer = setTimeout(() => {
    timedOut = true;
    if (context) void context.close();
    if (browser) void browser.close();
  }, overallTimeoutMs);

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--disable-background-networking'],
    });
    context = await browser.newContext({
      viewport: VIEWPORT,
      acceptDownloads: false,
      javaScriptEnabled: true,
      serviceWorkers: 'block',
    });
    await context.addInitScript({
      content: `globalThis.__name ??= (target, value) => Object.defineProperty(target, "name", { value, configurable: true });`,
    });
    let blockedNavigation: UnsafeUrlError | undefined;
    await installNetworkGuard(context, guard, (error) => {
      blockedNavigation = error;
    });
    const page = await context.newPage();
    page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    page.on('download', (download) => void download.cancel());

    const navigateAndExtract = async (
      targetUrl: string,
      isEntryPage: boolean,
      expectedOrigin?: string,
    ): Promise<AnalysisContext> => {
      blockedNavigation = undefined;
      let response: PlaywrightResponse | null;
      try {
        response = await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: NAVIGATION_TIMEOUT_MS,
        });
      } catch (error) {
        if (blockedNavigation) throw blockedNavigation;
        throw error;
      }
      if (!response) throw new Error('The site did not return a document response.');
      if (response.status() >= 400) throw new Error(`The site returned HTTP ${response.status()}.`);

      await guard.assertPublic(page.url());
      if (expectedOrigin && new URL(page.url()).origin !== expectedOrigin) {
        throw new Error('A discovered page redirected away from the scanned site.');
      }
      await page.waitForTimeout(500);
      return extractContext(page, targetUrl, isEntryPage);
    };

    const entryPage = await navigateAndExtract(url.toString(), true);
    const origin = new URL(entryPage.finalUrl).origin;
    const normalizedEntryUrl = normalizeCrawlUrl(entryPage.finalUrl, origin) ?? entryPage.finalUrl;
    const seen = new Set<string>([normalizedEntryUrl]);
    const visitedFinalUrls = new Set<string>([normalizedEntryUrl]);
    const pages: AnalysisContext[] = [entryPage];
    const queue = discoverCrawlCandidates(entryPage, origin, seen);
    const boundedMaxPages = Math.max(1, Math.min(8, Math.floor(maxPages)));

    while (queue.length > 0 && pages.length < boundedMaxPages) {
      if (timedOut) throw new Error('SCAN_TIMEOUT');
      const candidate = queue.shift()!;
      try {
        const scannedPage = await navigateAndExtract(candidate.url, false, origin);
        const finalUrl = normalizeCrawlUrl(scannedPage.finalUrl, origin);
        if (!finalUrl || visitedFinalUrls.has(finalUrl)) continue;

        visitedFinalUrls.add(finalUrl);
        pages.push(scannedPage);
        queue.push(...discoverCrawlCandidates(scannedPage, origin, seen));
        queue.sort((a, b) => a.priority - b.priority || a.url.localeCompare(b.url));
      } catch (error) {
        if (timedOut) throw new Error('SCAN_TIMEOUT');
        continue;
      }
    }

    return {
      requestedUrl: url.toString(),
      finalUrl: entryPage.finalUrl,
      title: entryPage.title,
      pages,
    };
  } catch (error) {
    if (timedOut) throw new Error('SCAN_TIMEOUT');
    if (error instanceof UnsafeUrlError) throw error;
    if (error instanceof Error && /timeout/i.test(error.message)) {
      throw new Error('SCAN_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(overallTimer);
    if (context) await context.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
  }
};
