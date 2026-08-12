import type { Detector } from '../types';
import { createFinding, mainHeading } from './helpers';

const elementMarkers = (classes: string[]): string => classes.join(' ').toLowerCase();

const profileFields = [
  ['name', /(?:["']?name["']?\s*:|this\.name\s*=)/i],
  ['location', /(?:["']?location["']?\s*:|this\.location\s*=)/i],
  ['role', /(?:["']?role["']?\s*:|this\.role\s*=)/i],
  ['stack', /(?:["']?(?:stack|skills|technologies)["']?\s*:|this\.(?:stack|skills|technologies)\s*=)/i],
  ['github', /(?:["']?github["']?\s*:|this\.github\s*=)/i],
  ['availability', /(?:openToWork|availableForWork|available|this\.openToWork)\s*[:=]/i],
] as const;

export const cyberDetectors: Detector[] = [
  {
    id: 'faux-terminal',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const terminals = context.elements.filter((element) => {
        const value = `${elementMarkers(element.classes)} ${element.text}`.toLowerCase();
        return element.rect.width >= 320 && element.rect.height >= 120 &&
          /terminal|command.?line|console/.test(value) &&
          /root@|type help|unix command|shell|bash|~\$|terminal v\d/.test(value);
      });
      return terminals.length
        ? [createFinding(this.id, this.category, 'Interactive terminal cosplay', 'A substantial faux command-line interface occupies the opening presentation.', 7, terminals.slice(0, 3).map((terminal) => `${terminal.rect.width}x${terminal.rect.height}px terminal: ${terminal.text.slice(0, 100)}`))]
        : [];
    },
  },
  {
    id: 'developer-profile-object',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const matches = context.elements
        .map((element) => {
          const value = `${elementMarkers(element.classes)} ${element.text}`;
          const fields = profileFields.filter(([, pattern]) => pattern.test(value)).map(([field]) => field);
          const codePresentation = /profile\.json|developer profile|class\s+\w*(?:developer|engineer)|new\s+\w*(?:developer|engineer)\s*\(|(?:const|let|var)\s+\w+\s*=\s*\{|terminal|code.?window|editor.?window/i.test(value);
          const developerIdentity = /developer|engineer|software|full.?stack|front.?end|back.?end/i.test(value);
          return { element, fields, codePresentation, developerIdentity };
        })
        .filter(({ element, fields, codePresentation, developerIdentity }) =>
          element.rect.y < 1000 &&
          element.rect.width >= 300 && element.rect.width <= 850 &&
          element.rect.height >= 150 && element.rect.height <= 750 &&
          element.text.length >= 80 &&
          fields.length >= 4 &&
          codePresentation &&
          developerIdentity,
        )
        .sort((left, right) => left.element.rect.width * left.element.rect.height - right.element.rect.width * right.element.rect.height);
      const match = matches[0];
      return match
        ? [createFinding(this.id, this.category, 'Developer object instantiated', 'The hero serializes the developer into a faux code object or profile file.', 5, [`${match.element.rect.width}x${match.element.rect.height}px code-profile panel`, `${match.fields.length} profile fields: ${match.fields.join(', ')}`, match.element.text.slice(0, 140)])]
        : [];
    },
  },
  {
    id: 'cyber-neon-hero',
    category: 'layout',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading || heading.fontSize < 64) return [];
      const neonElements = context.elements.filter((element) =>
        /cyan|purple|violet|fuchsia|neon|glow/.test(elementMarkers(element.classes)),
      );
      const themeMarkers = `${context.documentMarkers} ${context.stylesheets.join(' ')}`.toLowerCase();
      if (neonElements.length < 4 || !/tracking|uppercase|orbitron|rajdhani|fira.?code|mono/.test(themeMarkers)) return [];
      return [createFinding(this.id, this.category, 'Cyber-neon hero treatment', 'An oversized techno-styled heading is surrounded by repeated neon and code-interface cues.', 5, [`${heading.fontSize}px principal heading`, `${neonElements.length} cyan, purple, neon, or glow-styled elements`])];
    },
  },
  {
    id: 'decorative-particle-field',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const markers = context.documentMarkers.toLowerCase();
      const matches = [...new Set(markers.match(/star(?:field|-layer|s-bg)|particle(?:s|-container|-field|-layer)|tsparticles|particles-js/g) ?? [])];
      return matches.length
        ? [createFinding(this.id, this.category, 'Decorative particle field', 'The opening scene uses a starfield or particle layer as atmospheric developer-page decoration.', 3, matches.slice(0, 5))]
        : [];
    },
  },
];
