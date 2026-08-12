import ServiceError from '../core/ServiceError';
import { getLogger } from '../core/logging';
import { detectors } from '../scanner/detectors';
import { calculateScore } from '../scanner/scoring';
import { scanPortfolio } from '../scanner/scanner';
import type { AnalysisResult, Finding } from '../scanner/types';
import { UnsafeUrlError, UrlGuard } from '../scanner/urlSecurity';

const logger = getLogger();
let activeScans = 0;

const positiveSetting = (value: string | undefined, fallback: number, minimum: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
};

const safeErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message.replace(/[\r\n]+/g, ' ').slice(0, 240) : 'Unknown scanner failure';

const pageEvidence = (pageUrl: string): string => {
  const url = new URL(pageUrl);
  return `Page: ${url.pathname}${url.search}`;
};

const mergeFindings = (findings: Finding[]): Finding[] => {
  const merged = new Map<string, Finding>();
  for (const finding of findings) {
    const existing = merged.get(finding.detectorId);
    if (!existing) {
      merged.set(finding.detectorId, { ...finding, evidence: [...finding.evidence] });
      continue;
    }

    existing.points = Math.max(existing.points, finding.points);
    const evidence = [...new Set([...existing.evidence, ...finding.evidence])];
    const pageEntries = evidence.filter((item) => item.startsWith('Page: '));
    const observedEntries = evidence.filter((item) => !item.startsWith('Page: '));
    existing.evidence = [...pageEntries.slice(0, 8), ...observedEntries.slice(0, 12)];
  }
  return [...merged.values()];
};

export const analyzePortfolio = async (inputUrl: string): Promise<AnalysisResult> => {
  const maxConcurrentScans = positiveSetting(process.env.MAX_CONCURRENT_SCANS, 2, 1);
  const overallTimeoutMs = positiveSetting(process.env.ANALYSIS_TIMEOUT_MS, 25_000, 5_000);
  const maxPages = positiveSetting(process.env.MAX_PAGES_PER_SCAN, 4, 1);
  if (activeScans >= maxConcurrentScans) {
    throw ServiceError.serviceUnavailable('The scanner is at capacity. Please try again shortly.');
  }

  const startedAt = Date.now();
  const guard = new UrlGuard();
  let normalizedUrl: URL;
  try {
    normalizedUrl = await guard.assertPublic(inputUrl);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      logger.warn(`Analysis blocked: ${safeErrorMessage(error)}`);
      throw ServiceError.blockedUrl(error.message);
    }
    throw error;
  }

  activeScans += 1;
  logger.info(`Analysis started for host=${normalizedUrl.hostname}`);

  try {
    const scan = await scanPortfolio(normalizedUrl, guard, overallTimeoutMs, maxPages);
    const detectorResults = await Promise.all(
      scan.pages.flatMap((page) =>
        detectors.map(async (detector) => {
          const pageFindings = await detector.analyze(page);
          return pageFindings.map((finding) => ({
            ...finding,
            evidence: [pageEvidence(page.finalUrl), ...finding.evidence],
          }));
        }),
      ),
    );
    const findings = mergeFindings(detectorResults.flat());
    const score = calculateScore(findings);
    const durationMs = Date.now() - startedAt;

    logger.info(`Analysis completed host=${normalizedUrl.hostname} durationMs=${durationMs} pages=${scan.pages.length} detectors=${detectors.length} findings=${score.findings.length} score=${score.score}`);
    return {
      url: scan.finalUrl,
      score: score.score,
      severity: score.severity,
      categories: score.categories,
      findings: score.findings,
      metadata: {
        title: scan.title,
        scannedAt: new Date().toISOString(),
        durationMs,
        pagesScanned: scan.pages.length,
      },
    };
  } catch (error) {
    const message = safeErrorMessage(error);
    if (error instanceof UnsafeUrlError) {
      logger.warn(`Redirect blocked host=${normalizedUrl.hostname}: ${message}`);
      throw ServiceError.blockedUrl(error.message);
    }
    if (/SCAN_TIMEOUT|timeout/i.test(message)) {
      logger.warn(`Analysis timed out host=${normalizedUrl.hostname}`);
      throw ServiceError.scanTimeout('The site took too long to analyze.');
    }
    logger.warn(`Page load failed host=${normalizedUrl.hostname}: ${message}`);
    throw ServiceError.siteUnreachable("We couldn't reach or inspect that site.");
  } finally {
    activeScans -= 1;
  }
};

export const portfolioAnalysisService = { analyze: analyzePortfolio };
