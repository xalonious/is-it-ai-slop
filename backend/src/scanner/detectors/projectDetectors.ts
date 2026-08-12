import type { Detector, ElementSnapshot } from '../types';
import { createFinding, isPill, normalizedText } from './helpers';

const likelyCard = (element: ElementSnapshot): boolean =>
  ['article', 'li', 'div'].includes(element.tag) &&
  element.rect.width >= 220 && element.rect.width <= 700 &&
  element.rect.height >= 180 && element.rect.height <= 700 &&
  element.text.length >= 50 &&
  element.borderRadius >= 10;

const coefficientOfVariation = (values: number[]): number => {
  if (!values.length) return 1;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!mean) return 1;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
};

export const projectDetectors: Detector[] = [
  {
    id: 'project-card-sameness',
    category: 'template',
    analyze(context) {
      const cards = context.elements.filter(likelyCard);
      if (cards.length < 3) return [];
      const similarGroups = cards.filter((candidate) => {
        const peers = cards.filter((card) =>
          Math.abs(card.rect.width - candidate.rect.width) <= 12 &&
          Math.abs(card.rect.height - candidate.rect.height) <= 28,
        );
        return peers.length >= 3;
      });
      const unique = [...new Map(similarGroups.map((card) => [`${card.rect.x}:${card.rect.y}`, card])).values()].slice(0, 8);
      if (unique.length < 3) return [];
      const textVariation = coefficientOfVariation(unique.map((card) => card.text.length));
      return [createFinding(this.id, this.category, 'Project-card cloning pattern', 'Several project-like panels share near-identical dimensions and content density.', 8, [`${unique.length} similarly sized project-like panels`, `Text-length variation ${Math.round(textVariation * 100)}%`])];
    },
  },
  {
    id: 'excessive-project-badges',
    category: 'template',
    analyze(context) {
      const projectsHeading = context.headings.find((heading) => /projects|selected work|my work/i.test(normalizedText(heading.text)));
      if (!projectsHeading) return [];
      const pills = context.elements.filter((element) => isPill(element) && element.rect.y > projectsHeading.rect.y && element.text.length <= 30);
      return pills.length >= 12
        ? [createFinding(this.id, this.category, 'Projects under badge quarantine', 'The projects region contains a dense layer of pill-shaped technology labels.', 4, [`${pills.length} compact pills after the projects heading`])]
        : [];
    },
  },
];
