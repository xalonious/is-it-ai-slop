import type { AnalysisContext, ElementSnapshot, Finding, SignalMeasurement, SlopCategory } from '../types';

export const inHero = (element: ElementSnapshot): boolean =>
  element.rect.y >= -20 && element.rect.y < 900;

export const normalizedText = (value: string): string =>
  value.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9+#. ]+/g, ' ').replace(/\s+/g, ' ').trim();

export const isPill = (element: ElementSnapshot): boolean =>
  element.rect.height >= 18 &&
  element.rect.height <= 64 &&
  element.rect.width >= element.rect.height * 1.5 &&
  element.borderRadius >= element.rect.height * 0.42;

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const ramp = (value: number, startsAt: number, fullAt: number): number => {
  if (fullAt <= startsAt) return value >= fullAt ? 1 : 0;
  return clamp01((value - startsAt) / (fullAt - startsAt));
};

export const inverseRamp = (value: number, fullUntil: number, endsAt: number): number =>
  1 - ramp(value, fullUntil, endsAt);

export const weightedConfidence = (
  measurements: Array<{ confidence: number; weight: number }>,
): number => {
  const totalWeight = measurements.reduce((total, measurement) => total + Math.max(0, measurement.weight), 0);
  if (!totalWeight) return 0;
  return clamp01(measurements.reduce(
    (total, measurement) => total + clamp01(measurement.confidence) * Math.max(0, measurement.weight),
    0,
  ) / totalWeight);
};

export const pointsFromConfidence = (
  confidence: number,
  maximumPoints: number,
  minimumConfidence = 0.3,
): number => confidence >= minimumConfidence
  ? Math.max(1, Math.round(clamp01(confidence) * maximumPoints))
  : 0;

export const createFinding = (
  detectorId: string,
  category: SlopCategory,
  title: string,
  description: string,
  points: number,
  evidence: string[],
): Finding => ({ detectorId, category, title, description, points, evidence });

export const createMeasuredFinding = (
  detectorId: string,
  category: SlopCategory,
  title: string,
  description: string,
  measurement: SignalMeasurement,
): Finding[] => {
  const points = pointsFromConfidence(
    measurement.confidence,
    measurement.maximumPoints,
    measurement.minimumConfidence,
  );
  return points
    ? [createFinding(detectorId, category, title, description, points, measurement.evidence)]
    : [];
};

export const probableSurface = (element: ElementSnapshot): boolean =>
  element.rect.width >= 80 &&
  element.rect.height >= 32 &&
  (
    element.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
    element.backgroundImage !== 'none' ||
    element.borderTopWidth > 0 ||
    element.boxShadow !== 'none' ||
    /^(?:a|button|article|section)$/.test(element.tag)
  );

export const mainHeading = (context: AnalysisContext): ElementSnapshot | undefined =>
  context.headings
    .filter((heading) => heading.tag === 'h1' && inHero(heading))
    .sort((a, b) => b.fontSize - a.fontSize)[0];

export const near = (a: ElementSnapshot, b: ElementSnapshot, vertical = 240): boolean =>
  Math.abs(a.rect.y - b.rect.y) <= vertical;

export const uniqueTexts = (elements: ElementSnapshot[], limit = 8): string[] =>
  [...new Set(elements.map((element) => element.text).filter(Boolean))].slice(0, limit);
