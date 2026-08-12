import type { AnalysisContext, ElementSnapshot, Finding, SlopCategory } from '../types';

export const inHero = (element: ElementSnapshot): boolean =>
  element.rect.y >= -20 && element.rect.y < 900;

export const normalizedText = (value: string): string =>
  value.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9+#. ]+/g, ' ').replace(/\s+/g, ' ').trim();

export const isPill = (element: ElementSnapshot): boolean =>
  element.rect.height >= 18 &&
  element.rect.height <= 64 &&
  element.rect.width >= element.rect.height * 1.5 &&
  element.borderRadius >= element.rect.height * 0.42;

export const createFinding = (
  detectorId: string,
  category: SlopCategory,
  title: string,
  description: string,
  points: number,
  evidence: string[],
): Finding => ({ detectorId, category, title, description, points, evidence });

export const mainHeading = (context: AnalysisContext): ElementSnapshot | undefined =>
  context.headings
    .filter((heading) => heading.tag === 'h1' && inHero(heading))
    .sort((a, b) => b.fontSize - a.fontSize)[0];

export const near = (a: ElementSnapshot, b: ElementSnapshot, vertical = 240): boolean =>
  Math.abs(a.rect.y - b.rect.y) <= vertical;

export const uniqueTexts = (elements: ElementSnapshot[], limit = 8): string[] =>
  [...new Set(elements.map((element) => element.text).filter(Boolean))].slice(0, limit);
