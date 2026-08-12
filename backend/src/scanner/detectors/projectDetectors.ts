import type { Detector, ElementSnapshot } from '../types';
import { createFinding, isPill, normalizedText } from './helpers';

const likelyCard = (element: ElementSnapshot, viewportWidth: number, viewportHeight: number): boolean =>
  ['a', 'article', 'li', 'div'].includes(element.tag) &&
  element.parentIndex !== undefined &&
  element.childTags.length > 0 &&
  element.rect.width >= Math.max(140, viewportWidth * 0.1) &&
  element.rect.width <= viewportWidth * 0.8 &&
  element.rect.height >= 72 &&
  element.rect.height <= viewportHeight * 0.85 &&
  element.text.length >= 24;

const relativeDifference = (left: number, right: number): number =>
  Math.abs(left - right) / Math.max(left, right, 1);

const structureSignature = (element: ElementSnapshot): string =>
  `${element.tag}>${element.childTags.join(',')}`;

const coefficientOfVariation = (values: number[]): number => {
  if (!values.length) return 1;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!mean) return 1;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
};

const projectContext = (cards: ElementSnapshot[], headings: ElementSnapshot[]): boolean => {
  const markers = cards
    .flatMap((card) => [...card.classes, card.href ?? ''])
    .join(' ');
  if (/project|portfolio|selected.?work|repository|github/i.test(markers)) return true;
  const firstY = Math.min(...cards.map((card) => card.rect.y));
  return headings.some((heading) =>
    /projects|selected work|my work|portfolio/i.test(normalizedText(heading.text)) &&
    heading.rect.y <= firstY &&
    firstY - heading.rect.y <= 600,
  );
};

const repeatedCardGroups = (cards: ElementSnapshot[]): ElementSnapshot[][] => {
  const siblingGroups = new Map<string, ElementSnapshot[]>();
  for (const card of cards) {
    const key = `${card.parentIndex}:${structureSignature(card)}`;
    siblingGroups.set(key, [...(siblingGroups.get(key) ?? []), card]);
  }

  return [...siblingGroups.values()]
    .filter((group) => group.length >= 3)
    .map((group) => {
      const clusters = group.map((candidate) =>
        group.filter((card) =>
          relativeDifference(card.rect.width, candidate.rect.width) <= 0.12 &&
          relativeDifference(card.rect.height, candidate.rect.height) <= 0.18,
        ),
      );
      return clusters.sort((left, right) => right.length - left.length)[0];
    })
    .filter((group) => group.length >= 3);
};

const positionClusters = (
  cards: ElementSnapshot[],
  position: (card: ElementSnapshot) => number,
  tolerance: number,
): ElementSnapshot[][] => {
  const clusters: ElementSnapshot[][] = [];
  for (const card of [...cards].sort((left, right) => position(left) - position(right))) {
    const cluster = clusters.find((candidate) => {
      const center = candidate.reduce((sum, item) => sum + position(item), 0) / candidate.length;
      return Math.abs(position(card) - center) <= tolerance;
    });
    if (cluster) cluster.push(card);
    else clusters.push([card]);
  }
  return clusters;
};

const gridGeometry = (cards: ElementSnapshot[]) => {
  const meanWidth = cards.reduce((sum, card) => sum + card.rect.width, 0) / cards.length;
  const meanHeight = cards.reduce((sum, card) => sum + card.rect.height, 0) / cards.length;
  const columns = positionClusters(cards, (card) => card.rect.x + card.rect.width / 2, meanWidth * 0.25);
  const rows = positionClusters(cards, (card) => card.rect.y + card.rect.height / 2, meanHeight * 0.25);
  const repeatedRows = rows.filter((row) => row.length >= 3);
  const occupiedColumns = columns.filter((column) => column.length >= 2);
  return {
    columns: occupiedColumns.length,
    rows: repeatedRows.length,
    cards: repeatedRows.flat(),
  };
};

export const projectDetectors: Detector[] = [
  {
    id: 'project-card-matrix',
    category: 'template',
    analyze(context) {
      const cards = context.elements.filter((element) =>
        likelyCard(element, context.viewport.width, context.viewport.height),
      );
      if (cards.length < 3) return [];
      const groups = repeatedCardGroups(cards)
        .filter((group) => projectContext(group, context.headings))
        .map((group) => ({
          geometry: gridGeometry(group),
          densityVariation: coefficientOfVariation(
            group.map((card) => card.text.length / Math.max(card.rect.width * card.rect.height, 1)),
          ),
        }))
        .filter((group) =>
          group.geometry.columns >= 3 &&
          group.geometry.rows >= 2 &&
          group.geometry.cards.length >= 6 &&
          group.densityVariation <= 0.45,
        )
        .sort((left, right) => right.geometry.cards.length - left.geometry.cards.length || left.densityVariation - right.densityVariation);
      const match = groups[0];
      if (!match) return [];
      const unique = [...new Map(match.geometry.cards.map((card) => [`${card.rect.x}:${card.rect.y}`, card])).values()].slice(0, 12);
      const widthVariation = coefficientOfVariation(unique.map((card) => card.rect.width));
      const heightVariation = coefficientOfVariation(unique.map((card) => card.rect.height));
      return [createFinding(this.id, this.category, 'Six-up project card matrix', 'A project section uses the familiar multi-row matrix of uniform cards common to portfolio generators and templates.', 3, [`${match.geometry.columns} repeated columns across ${match.geometry.rows} rows`, `${unique.length} structurally matching project cards`, `Size variation ${Math.round(Math.max(widthVariation, heightVariation) * 100)}%`, `Content-density variation ${Math.round(match.densityVariation * 100)}%`])];
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
