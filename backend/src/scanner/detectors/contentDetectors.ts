import type { Detector } from '../types';
import { createMeasuredFinding, normalizedText, ramp } from './helpers';

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
