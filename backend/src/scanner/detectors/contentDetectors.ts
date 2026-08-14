import type { Detector, ElementSnapshot } from '../types';
import { createMeasuredFinding, normalizedText, ramp, weightedConfidence } from './helpers';

export const CLICHE_PHRASES = [
  'passionate developer',
  'crafting digital experiences',
  'crafting beautiful experiences',
  'bringing ideas to life',
  'turning ideas into reality',
  'building scalable solutions',
  'clean and efficient code',
  'pixel perfect',
  'always learning',
  'creating meaningful experiences',
  'modern web experiences',
  "let's build something amazing",
  'building things for the web',
  'creating seamless experiences',
  'innovative solutions',
  'exceptional digital experiences',
] as const;

const NAV_ITEMS = ['home', 'about', 'projects', 'skills', 'experience', 'contact'] as const;
type NavItem = typeof NAV_ITEMS[number];

const NAV_ALIASES: Record<NavItem, RegExp> = {
  home: /^(?:home|start)$/i,
  about: /^(?:about|profile|bio)(?: me)?$/i,
  projects: /^(?:projects?|work|portfolio|selected work)$/i,
  skills: /^(?:skills?|expertise|technical arsenal|proficiency|capabilities)$/i,
  experience: /^(?:experience|journey|career|education|background|credentials|certifications?)$/i,
  contact: /^(?:contact|get in touch|connect|hire me|let'?s talk)$/i,
};

const navMatches = (value: string, item: NavItem): boolean =>
  NAV_ALIASES[item].test(normalizedText(value));

const hasIconChild = (element: ElementSnapshot): boolean =>
  element.childTags.some((tag) => /^(?:i|img|picture|svg)$/.test(tag)) ||
  element.classes.some((className) => /(?:^|[-_:])(?:icon|lucide)(?:$|[-_:])/.test(className));

const iconDockControls = (context: Parameters<Detector['analyze']>[0], container: ElementSnapshot): ElementSnapshot[] =>
  [...context.links, ...context.buttons]
    .filter((element) =>
      element.parentIndex === container.nodeIndex &&
      element.rect.width >= 24 && element.rect.width <= 76 &&
      element.rect.height >= 24 && element.rect.height <= 76 &&
      Math.abs(element.rect.width - element.rect.height) <= 16 &&
      hasIconChild(element) &&
      normalizedText(element.text).length <= 28,
    )
    .sort((left, right) => left.rect.x - right.rect.x);

const fixedAncestor = (elements: Map<number, ElementSnapshot>, element: ElementSnapshot): boolean => {
  let current: ElementSnapshot | undefined = element;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (current.position === 'fixed' || current.position === 'sticky') return true;
    current = current.parentIndex === undefined ? undefined : elements.get(current.parentIndex);
  }
  return false;
};

export const contentDetectors: Detector[] = [
  {
    id: 'copy-cliches',
    category: 'copy',
    analyze(context) {
      const text = normalizedText(context.visibleText);
      const matches = CLICHE_PHRASES.filter((phrase) => text.includes(normalizedText(phrase)));
      return createMeasuredFinding(this.id, this.category, 'Portfolio copy from central casting', 'The prose contains familiar phrases shared by many generated and template portfolios.', {
        confidence: ramp(matches.length, 0, 4),
        maximumPoints: 11,
        minimumConfidence: 0.2,
        evidence: matches.map((match) => `“${match}”`),
      });
    },
  },
  {
    id: 'navbar-cliche',
    category: 'template',
    analyze(context) {
      const firstLinks = context.links.filter((link) => link.rect.y < 180).map((link) => normalizedText(link.text));
      const matches = NAV_ITEMS.filter((item) => firstLinks.some((link) => navMatches(link, item)));
      return createMeasuredFinding(this.id, this.category, 'Canonical portfolio navigation', 'The opening navigation closely follows the standard portfolio checklist.', {
        confidence: ramp(matches.length, 2, 5),
        maximumPoints: 2,
        minimumConfidence: 0.3,
        evidence: matches,
      });
    },
  },
  {
    id: 'floating-icon-dock',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const elementsByIndex = new Map(context.elements.map((element) => [element.nodeIndex, element]));
      const candidates = context.elements
        .filter((element) =>
          element.rect.width >= 180 && element.rect.width <= 720 &&
          element.rect.height >= 42 && element.rect.height <= 120 &&
          element.rect.width / Math.max(element.rect.height, 1) >= 2.5 &&
          element.borderRadius >= element.rect.height * 0.3 &&
          (element.tag === 'nav' || element.role === 'navigation' || fixedAncestor(elementsByIndex, element)),
        )
        .map((element) => ({ element, controls: iconDockControls(context, element) }))
        .filter(({ controls }) => controls.length >= 4 && controls.length <= 9)
        .sort((left, right) => right.controls.length - left.controls.length);
      const candidate = candidates[0];
      if (!candidate) return [];

      const centers = candidate.controls.map((control) => control.rect.x + control.rect.width / 2);
      const gaps = centers.slice(1).map((center, index) => center - centers[index]);
      const gapRange = gaps.length ? Math.max(...gaps) - Math.min(...gaps) : 100;
      const verticalRange = Math.max(...candidate.controls.map((control) => control.rect.y)) -
        Math.min(...candidate.controls.map((control) => control.rect.y));
      const iconOnlyLabels = candidate.controls.filter((control) =>
        !normalizedText(control.text) || normalizedText(control.text) === normalizedText(control.ariaLabel ?? ''),
      ).length;
      const floating = fixedAncestor(elementsByIndex, candidate.element);
      const styledSurface = candidate.element.backdropFilter !== 'none' ||
        candidate.element.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        candidate.element.borderTopWidth > 0 ||
        candidate.element.boxShadow !== 'none';
      const geometryConfidence = weightedConfidence([
        { confidence: ramp(candidate.element.rect.width / candidate.element.rect.height, 2.5, 5), weight: 0.4 },
        { confidence: ramp(candidate.element.borderRadius / candidate.element.rect.height, 0.25, 0.5), weight: 0.35 },
        { confidence: 1 - ramp(verticalRange, 4, 24), weight: 0.25 },
      ]);
      const confidence = weightedConfidence([
        { confidence: ramp(candidate.controls.length, 3, 7), weight: 0.3 },
        { confidence: geometryConfidence, weight: 0.25 },
        { confidence: 1 - ramp(gapRange, 8, 32), weight: 0.2 },
        { confidence: ramp(iconOnlyLabels / candidate.controls.length, 0.5, 1), weight: 0.15 },
        { confidence: floating || styledSurface ? 1 : 0, weight: 0.1 },
      ]);

      return createMeasuredFinding(this.id, this.category, 'Floating icon-only navigation dock', 'Primary navigation is compressed into an evenly spaced row of unlabeled icons inside a detached pill-shaped dock.', {
        confidence,
        maximumPoints: 3,
        minimumConfidence: 0.55,
        evidence: [
          `${candidate.controls.length} compact icon navigation controls`,
          `${candidate.element.rect.width}x${candidate.element.rect.height}px pill-shaped navigation surface`,
          floating ? 'fixed or sticky viewport placement' : 'detached styled navigation surface',
          `Labels: ${candidate.controls.map((control) => control.ariaLabel || control.text).filter(Boolean).join(', ')}`,
        ],
      });
    },
  },
  {
    id: 'generic-section-sequence',
    category: 'template',
    analyze(context) {
      const labels = context.headings.map((heading) => normalizedText(heading.text));
      const ordered = NAV_ITEMS.slice(1).filter((item) => labels.some((label) => navMatches(label, item)));
      let ascending = 0;
      let lastIndex = -1;
      for (const item of ordered) {
        const index = labels.findIndex((label) => navMatches(label, item));
        if (index > lastIndex) {
          ascending += 1;
          lastIndex = index;
        }
      }
      return createMeasuredFinding(this.id, this.category, 'Portfolio section conveyor belt', 'The page proceeds through a familiar About, Skills, Projects, Experience, and Contact sequence.', {
        confidence: ramp(ascending, 2, 5),
        maximumPoints: 2,
        minimumConfidence: 0.3,
        evidence: ordered,
      });
    },
  },
];
