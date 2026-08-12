import type { Detector, ElementSnapshot } from '../types';
import { createFinding, mainHeading, normalizedText } from './helpers';

const elementMarkers = (element: ElementSnapshot): string =>
  `${element.classes.join(' ')} ${element.text}`.toLowerCase();

const credentialTerms = (value: string): string[] =>
  [...new Set(value.match(/founder|director|head of|lead|designer|developer|engineer|client|partner/gi) ?? [])];

export const editorialDetectors: Detector[] = [
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
      return match
        ? [createFinding(this.id, this.category, 'Credential marquee loop', 'A full-width animated ticker continuously cycles professional roles or affiliations beneath the hero.', 3, [`${match.element.rect.width}px animated track`, `${match.element.childTags.length} repeated ticker items`, `${match.terms.length} role terms: ${match.terms.join(', ')}`])]
        : [];
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
      if (heading.fontSize < 72 || heading.rect.height < 220 || heading.rect.width < context.viewport.width * 0.55 || lineCount < 2) return [];
      return [createFinding(this.id, this.category, 'Oversized editorial hero statement', 'A short portfolio thesis is typeset as a viewport-dominating multi-line editorial headline.', 2, [`${heading.fontSize}px heading across ${lineCount} structured lines`, heading.text.slice(0, 120)])];
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
      return numbered.length >= 4
        ? [createFinding(this.id, this.category, 'Numbered micro-navigation', 'The primary navigation prefixes compact uppercase section labels with two-digit indices.', 2, numbered.slice(0, 8).map((link) => link.text))]
        : [];
    },
  },
];
