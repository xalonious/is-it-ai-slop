import type { Detector, ElementSnapshot } from '../types';
import { createFinding, createMeasuredFinding, mainHeading, normalizedText, ramp, weightedConfidence } from './helpers';

const elementMarkers = (element: ElementSnapshot): string =>
  `${element.classes.join(' ')} ${element.text}`.toLowerCase();

const credentialTerms = (value: string): string[] =>
  [...new Set(value.match(/founder|director|head of|lead|designer|developer|engineer|client|partner/gi) ?? [])];

const gradientDirections = (images: string): number[] =>
  [...images.matchAll(/(?:repeating-)?linear-gradient\(\s*([^,]+)/gi)].map((match) => {
    const prelude = match[1].trim().toLowerCase();
    const degrees = prelude.match(/^(-?[\d.]+)deg\b/);
    if (degrees) return ((Number(degrees[1]) % 180) + 180) % 180;
    if (/^to\s+(?:left|right)\b/.test(prelude)) return 90;
    return 0;
  });

const hasPerpendicularDirections = (directions: number[]): boolean =>
  directions.some((direction, index) => directions.slice(index + 1).some((other) => {
    const difference = Math.abs(direction - other);
    return Math.abs(difference - 90) <= 5;
  }));

const embeddedSvgSources = (images: string): string[] =>
  [...images.matchAll(/data:image\/svg\+xml([^,]*),([^"')]+)/gi)].map((match) => {
    try {
      return /;base64/i.test(match[1])
        ? Buffer.from(match[2], 'base64').toString('utf8')
        : decodeURIComponent(match[2]);
    } catch {
      return '';
    }
  });

const hasSvgGridGeometry = (svg: string): boolean => {
  if (!svg) return false;
  const normalized = svg.toLowerCase();
  const namedGrid = /\b(?:grid|graph|crosshatch|square-pattern)\b/.test(normalized);
  const patternTile = /<pattern\b/.test(normalized);
  const lineTags = normalized.match(/<line\b/g)?.length ?? 0;
  const axisPath = /<path\b[^>]*\bd=["'][^"']*(?:\bh\s*-?[\d.]|\bv\s*-?[\d.])[^"']*["']/i.test(normalized);
  const cornerPath = /<path\b[^>]*\bd=["'][^"']*\bm\s*-?[\d.]+(?:[ ,]+)-?[\d.]+[^"']*\bl\s*-?[\d.]+(?:[ ,]+)-?[\d.]+(?:[ ,]+)-?[\d.]+(?:[ ,]+)-?[\d.]+/i.test(normalized);
  const lineGeometry = lineTags >= 2 || axisPath || cornerPath;
  return lineGeometry && (namedGrid || patternTile);
};

export const editorialDetectors: Detector[] = [
  {
    id: 'technical-grid-background',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const matches = context.elements.map((element) => {
        const images = `${element.backgroundImage} ${element.pseudoBackgroundImage}`;
        const sizes = `${element.backgroundSize} ${element.pseudoBackgroundSize}`;
        const directions = gradientDirections(images);
        const largeSurface = element.rect.width >= context.viewport.width * 0.9 &&
          element.rect.height >= context.viewport.height * 0.8 &&
          element.rect.width * element.rect.height >= context.viewport.width * context.viewport.height * 0.75;
        const cssGrid = directions.length >= 2 &&
          hasPerpendicularDirections(directions) &&
          /(?:\d{1,3}(?:\.\d+)?px\s+){1,3}\d{1,3}(?:\.\d+)?px/.test(sizes) &&
          /transparent|rgba?\([^)]*,\s*0(?:\.0+)?\)/.test(images);
        const svgGrid = embeddedSvgSources(images).some(hasSvgGridGeometry);
        return {
          element,
          cssGrid,
          svgGrid,
          confidence: largeSurface ? Math.max(cssGrid ? 1 : 0, svgGrid ? 0.85 : 0) : 0,
        };
      }).sort((left, right) => right.confidence - left.confidence);
      const match = matches[0];
      return createMeasuredFinding(this.id, this.category, 'Graph-paper background grid', 'A full-page repeated grid texture creates a technical graph-paper canvas behind the portfolio.', {
        confidence: match?.confidence ?? 0,
        maximumPoints: 3,
        minimumConfidence: 0.45,
        evidence: match?.confidence ? [
          `${match.element.rect.width}x${match.element.rect.height}px background surface`,
          match.cssGrid ? 'Perpendicular CSS gradient grid' : 'Embedded SVG with explicit grid geometry',
        ] : [],
      });
    },
  },
  {
    id: 'credential-marquee',
    category: 'animation',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const tracks = context.elements
        .map((element) => ({ element, terms: credentialTerms(element.text) }))
        .filter(({ element, terms }) => {
          const markers = elementMarkers(element);
          return element.rect.width >= context.viewport.width * 1.15 &&
            element.rect.height >= 18 && element.rect.height <= 120 &&
            element.childTags.length >= 6 &&
            element.text.length >= 100 &&
            terms.length >= 2 &&
            /marquee|ticker|scroll.?track/.test(markers) &&
            /marquee|ticker|scroll|loop/.test(`${element.animationName} ${markers}`);
        });
      const match = tracks[0];
      return createMeasuredFinding(this.id, this.category, 'Credential marquee loop', 'A full-width animated ticker continuously cycles professional roles or affiliations beneath the hero.', {
        confidence: match ? weightedConfidence([
          { confidence: ramp(match.element.childTags.length, 4, 10), weight: 0.55 },
          { confidence: ramp(match.terms.length, 1, 4), weight: 0.45 },
        ]) : 0,
        maximumPoints: 3,
        minimumConfidence: 0.4,
        evidence: match ? [`${match.element.rect.width}px animated track`, `${match.element.childTags.length} repeated ticker items`, `${match.terms.length} role terms: ${match.terms.join(', ')}`] : [],
      });
    },
  },
  {
    id: 'dot-ring-cursor',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const empty = context.elements.filter((element) => !element.text);
      const dots = empty.filter((element) =>
        /cursor.?dot|dot.?cursor/.test(element.classes.join(' ').toLowerCase()) &&
        element.rect.width >= 3 && element.rect.width <= 16 &&
        element.rect.height >= 3 && element.rect.height <= 16 &&
        Math.abs(element.rect.width - element.rect.height) <= 3,
      );
      const rings = empty.filter((element) =>
        /cursor.?(?:ring|outline)|(?:ring|outline).?cursor/.test(element.classes.join(' ').toLowerCase()) &&
        element.rect.width >= 20 && element.rect.width <= 90 &&
        element.rect.height >= 20 && element.rect.height <= 90 &&
        Math.abs(element.rect.width - element.rect.height) <= 5,
      );
      return dots.length && rings.length
        ? [createFinding(this.id, this.category, 'Dot-and-ring custom cursor', 'The page replaces the native pointer with the familiar trailing dot inside an outlined circle.', 4, [`${dots[0].rect.width}x${dots[0].rect.height}px cursor dot`, `${rings[0].rect.width}x${rings[0].rect.height}px cursor ring`])]
        : [];
    },
  },
  {
    id: 'editorial-statement-hero',
    category: 'layout',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading) return [];
      const lineCount = heading.childTags.filter((tag) => tag === 'span').length;
      return createMeasuredFinding(this.id, this.category, 'Oversized editorial hero statement', 'A short portfolio thesis is typeset as a viewport-dominating multi-line editorial headline.', {
        confidence: weightedConfidence([
          { confidence: ramp(heading.fontSize, 54, 96), weight: 0.35 },
          { confidence: ramp(heading.rect.height, 130, 320), weight: 0.25 },
          { confidence: ramp(heading.rect.width / context.viewport.width, 0.4, 0.72), weight: 0.2 },
          { confidence: ramp(lineCount, 1, 4), weight: 0.2 },
        ]),
        maximumPoints: 2,
        minimumConfidence: 0.45,
        evidence: [`${heading.fontSize}px heading across ${lineCount} structured lines`, heading.text.slice(0, 120)],
      });
    },
  },
  {
    id: 'numbered-micro-nav',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const numbered = context.links.filter((link) =>
        link.rect.y >= 0 && link.rect.y <= 160 &&
        link.text.length <= 32 &&
        /^0?\d\s+[a-z]/i.test(normalizedText(link.text)),
      );
      return createMeasuredFinding(this.id, this.category, 'Numbered micro-navigation', 'The primary navigation prefixes compact uppercase section labels with two-digit indices.', {
        confidence: ramp(numbered.length, 2, 6),
        maximumPoints: 2,
        minimumConfidence: 0.35,
        evidence: numbered.slice(0, 8).map((link) => link.text),
      });
    },
  },
];
