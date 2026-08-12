import type { Detector } from '../types';
import { createFinding, normalizedText } from './helpers';

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

const NAV_ITEMS = ['home', 'about', 'projects', 'skills', 'experience', 'contact'];

export const contentDetectors: Detector[] = [
  {
    id: 'copy-cliches',
    category: 'copy',
    analyze(context) {
      const text = normalizedText(context.visibleText);
      const matches = CLICHE_PHRASES.filter((phrase) => text.includes(normalizedText(phrase)));
      if (!matches.length) return [];
      return [createFinding(this.id, this.category, 'Portfolio copy from central casting', 'The prose contains familiar phrases shared by many generated and template portfolios.', Math.min(11, 3 + (matches.length - 1) * 2), matches.map((match) => `“${match}”`))];
    },
  },
  {
    id: 'navbar-cliche',
    category: 'template',
    analyze(context) {
      const firstLinks = context.links.filter((link) => link.rect.y < 180).map((link) => normalizedText(link.text));
      const matches = NAV_ITEMS.filter((item) => firstLinks.includes(item));
      return matches.length >= 4
        ? [createFinding(this.id, this.category, 'Canonical portfolio navigation', 'The opening navigation closely follows the standard portfolio checklist.', 2, matches)]
        : [];
    },
  },
  {
    id: 'generic-section-sequence',
    category: 'template',
    analyze(context) {
      const labels = context.headings.map((heading) => normalizedText(heading.text));
      const ordered = NAV_ITEMS.slice(1).filter((item) => labels.some((label) => label === item || label.startsWith(`${item} `)));
      let ascending = 0;
      let lastIndex = -1;
      for (const item of ordered) {
        const index = labels.findIndex((label) => label === item || label.startsWith(`${item} `));
        if (index > lastIndex) {
          ascending += 1;
          lastIndex = index;
        }
      }
      return ascending >= 4
        ? [createFinding(this.id, this.category, 'Portfolio section conveyor belt', 'The page proceeds through the familiar About → Skills → Projects → Experience → Contact sequence.', 2, ordered)]
        : [];
    },
  },
];
