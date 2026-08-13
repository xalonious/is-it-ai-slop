import type { Detector, ElementSnapshot } from '../types';
import { createFinding, createMeasuredFinding, mainHeading, ramp, weightedConfidence } from './helpers';

const elementMarkers = (classes: string[]): string => classes.join(' ').toLowerCase();

const TERMINAL_MARKER = /(?:^|[\s_-])(?:cli|cmd|command.?line|console|shell|term(?:inal)?|xterm)(?:$|[\s_-])/i;
const MONOSPACE_FONT = /(?:cascadia|code|consolas|courier|fira|hack|ibm plex mono|inconsolata|menlo|monaco|mono|source code|terminal)/i;
const SYSTEM_INFO_FIELDS = /\b(?:os|host|kernel|uptime|packages|shell|resolution|de|wm|terminal|cpu|gpu|memory|disk)\s*:/gi;
const SHELL_COMMAND = /(?:^|\s)(?:\$|#|>)\s*(?:cat|cd|clear|echo|exit|help|ls|man|neofetch|npm|pwd|ssh|sudo|whoami)\b|\b(?:run|type|use)\s+(?:the\s+)?(?:help|ls|clear|cd)\s+command\b/i;
const SHELL_PROMPT = /(?:^|\s)[([]?[\w.-]{1,32}@[\w.-]{1,64}[)\]]?(?:\s*[-:]?\s*(?:\[[~/.\w-]{0,80}\]|[~/.][\w/.-]{0,80}))?\s*(?:[$#>%]|[-─━]╯)|(?:^|\s)[~/.\w-]{0,80}\s*[$#>]\s*(?:$|\w)/im;
const ASCII_GLYPH = /[▀-▟─-╿╭╮╯╰]/g;

interface TerminalCandidate {
  element: ElementSnapshot;
  score: number;
  signals: string[];
  systemFields: string[];
}

const parseRgb = (value: string): [number, number, number] | undefined => {
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
};

const isDarkSurface = (element: ElementSnapshot): boolean => {
  const rgb = parseRgb(element.backgroundColor);
  if (!rgb) return false;
  const [red, green, blue] = rgb.map((channel) => channel / 255);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue <= 0.18;
};

const terminalCandidate = (
  element: ElementSnapshot,
  viewport: { width: number; height: number },
): TerminalCandidate | undefined => {
  if (element.rect.width < 320 || element.rect.height < 120 || element.text.length < 24) return undefined;
  const markerText = `${element.tag} ${element.classes.join(' ')} ${element.ariaLabel ?? ''}`;
  const namedTerminal = TERMINAL_MARKER.test(markerText);
  const terminalStructure = /^(?:code|pre|samp|kbd)$/.test(element.tag) ||
    /^(?:pre|pre-wrap|break-spaces)$/.test(element.whiteSpace);
  const monospace = MONOSPACE_FONT.test(element.fontFamily) || terminalStructure;
  const prompt = SHELL_PROMPT.test(element.text);
  const systemFields = [...new Set(element.text.match(SYSTEM_INFO_FIELDS)?.map((field) => field.slice(0, -1).toLowerCase()) ?? [])];
  const command = SHELL_COMMAND.test(element.text);
  const asciiGlyphs = element.text.match(ASCII_GLYPH)?.length ?? 0;
  const asciiArt = asciiGlyphs >= 10 || /(?:[_\\/|]{4,}\s*){2,}/.test(element.text);
  const dominant = element.rect.y < viewport.height * 0.35 &&
    element.rect.width >= viewport.width * 0.65 &&
    element.rect.height >= viewport.height * 0.35;
  const dark = isDarkSurface(element);
  const interactive = element.contentEditable || /input|prompt|cursor/.test(markerText.toLowerCase());

  let score = 0;
  const signals: string[] = [];
  if (namedTerminal) { score += 3; signals.push('terminal naming or component marker'); }
  else if (terminalStructure) { score += 1; signals.push('preformatted terminal-like structure'); }
  if (prompt) { score += 3; signals.push('shell prompt syntax'); }
  if (systemFields.length >= 4) { score += 4; signals.push(`${systemFields.length} system-information fields`); }
  else if (systemFields.length >= 2) { score += 2; signals.push(`${systemFields.length} system-information fields`); }
  if (command) { score += 1; signals.push('shell command or command instruction'); }
  if (asciiArt) { score += 2; signals.push('ASCII or box-drawing artwork'); }
  if (monospace) { score += 1; signals.push('monospace typography'); }
  if (dark) { score += 1; signals.push('dark terminal surface'); }
  if (dominant) { score += 2; signals.push('viewport-dominating presentation'); }
  if (interactive) { score += 1; signals.push('interactive prompt or cursor cue'); }

  const hasTerminalSemantics = namedTerminal || prompt || systemFields.length >= 4;
  const hasTerminalPresentation = namedTerminal || (monospace && dark) || dominant || interactive;
  return hasTerminalSemantics && hasTerminalPresentation && score >= 4
    ? { element, score, signals, systemFields }
    : undefined;
};

const hasSaturatedComputedColor = (value: string): boolean => {
  const matches = [...value.matchAll(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/gi)];
  return matches.some((match) => {
    const channels = [Number(match[1]), Number(match[2]), Number(match[3])];
    return Math.max(...channels) - Math.min(...channels) >= 65 && Math.max(...channels) >= 120;
  });
};

const SHADOW_BLUR = /rgba?\([^)]*\)\s+-?[\d.]+px\s+-?[\d.]+px\s+([\d.]+)px|(?:#[\da-f]{3,8}|\b(?:cyan|aqua|purple|violet|fuchsia|magenta)\b)\s+-?[\d.]+px\s+-?[\d.]+px\s+([\d.]+)px/gi;
const EXPLICIT_NEON_MARKER = /(?:^|[\s_-])(?:cyber|electric|glow(?:ing)?|holographic|neon|scanline)(?:$|[\s_-])/i;
const CODE_INTERFACE_MARKER = /(?:^|[\s_-])(?:cli|code|command|console|hud|prompt|shell|terminal)(?:$|[\s_-])/i;
const TECHNO_FONT = /(?:audiowide|chakra petch|electrolize|orbitron|oxanium|rajdhani|share tech|space mono|syncopate)/i;

const hasSaturatedGlow = (element: ElementSnapshot): boolean => {
  const shadows = `${element.boxShadow} ${element.textShadow}`;
  if (!hasSaturatedComputedColor(shadows)) return false;
  return [...shadows.matchAll(SHADOW_BLUR)].some((match) => Number(match[1] ?? match[2]) >= 6);
};

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
      const candidates = context.elements
        .map((element) => terminalCandidate(element, context.viewport))
        .filter((candidate): candidate is TerminalCandidate => Boolean(candidate))
        .sort((left, right) =>
          right.score - left.score ||
          left.element.rect.width * left.element.rect.height - right.element.rect.width * right.element.rect.height,
        );
      const match = candidates[0];
      if (!match) return [];
      const dominant = match.signals.includes('viewport-dominating presentation');
      return createMeasuredFinding(
        this.id,
        this.category,
        dominant ? 'Portfolio booted directly into terminal mode' : 'Interactive terminal cosplay',
        dominant
          ? 'The opening portfolio presents itself as a full terminal session, complete with shell syntax and system-interface cues.'
          : 'A substantial faux command-line interface occupies the opening presentation.',
        {
          confidence: ramp(match.score, 4, 12),
          maximumPoints: dominant ? 9 : 7,
          minimumConfidence: 0.3,
          evidence: [
            `${match.element.rect.width}x${match.element.rect.height}px terminal-like region`,
            ...match.signals.slice(0, 6),
            ...(match.systemFields.length ? [`System fields: ${match.systemFields.join(', ')}`] : []),
            match.element.text.slice(0, 140),
          ],
        },
      );
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
          fields.length >= 2 &&
          codePresentation &&
          developerIdentity,
        )
        .sort((left, right) => left.element.rect.width * left.element.rect.height - right.element.rect.width * right.element.rect.height);
      const match = matches[0];
      return createMeasuredFinding(this.id, this.category, 'Developer object instantiated', 'The hero serializes the developer into a faux code object or profile file.', {
        confidence: match ? ramp(match.fields.length, 2, 6) : 0,
        maximumPoints: 5,
        minimumConfidence: 0.3,
        evidence: match ? [`${match.element.rect.width}x${match.element.rect.height}px code-profile panel`, `${match.fields.length} profile fields: ${match.fields.join(', ')}`, match.element.text.slice(0, 140)] : [],
      });
    },
  },
  {
    id: 'cyber-neon-hero',
    category: 'layout',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading) return [];
      const heroElements = context.elements.filter((element) =>
        element.rect.y < Math.max(context.viewport.height * 1.15, heading.rect.y + heading.rect.height + 240),
      );
      const darkHeroSurfaces = heroElements.filter((element) =>
        isDarkSurface(element) &&
        element.rect.width >= context.viewport.width * 0.65 &&
        element.rect.height >= context.viewport.height * 0.45,
      );
      const glowElements = heroElements.filter(hasSaturatedGlow);
      const explicitlyNeonElements = heroElements.filter((element) =>
        EXPLICIT_NEON_MARKER.test(elementMarkers(element.classes)) &&
        hasSaturatedComputedColor(`${element.backgroundColor} ${element.backgroundImage} ${element.boxShadow} ${element.textShadow}`),
      );
      const saturatedHeroElements = heroElements.filter((element) =>
        hasSaturatedComputedColor(`${element.backgroundColor} ${element.backgroundImage} ${element.boxShadow} ${element.textShadow}`),
      );
      const monospaceElements = heroElements.filter((element) => MONOSPACE_FONT.test(element.fontFamily)).length;
      const codeInterfaceElements = heroElements.filter((element) =>
        CODE_INTERFACE_MARKER.test(`${element.tag} ${elementMarkers(element.classes)} ${element.ariaLabel ?? ''}`),
      ).length;
      const technicalTypography = TECHNO_FONT.test(heading.fontFamily) || monospaceElements >= 2;
      const neonPresentation = glowElements.length > 0 || explicitlyNeonElements.length > 0 || saturatedHeroElements.length >= 4;
      const technicalPresentation = technicalTypography || codeInterfaceElements > 0;

      // These are defining features, not interchangeable points. A large heading alone
      // must never turn an otherwise ordinary portfolio into a cyber-neon finding.
      if (!darkHeroSurfaces.length || !neonPresentation || !technicalPresentation) return [];

      const neonStrength = Math.max(
        ramp(glowElements.length, 0, 3),
        ramp(explicitlyNeonElements.length, 0, 4),
        ramp(saturatedHeroElements.length, 3, 10) * 0.75,
      );
      return createMeasuredFinding(this.id, this.category, 'Cyber-neon hero treatment', 'An oversized techno-styled heading is surrounded by repeated neon and code-interface cues.', {
        confidence: weightedConfidence([
          { confidence: ramp(heading.fontSize, 44, 76), weight: 0.2 },
          { confidence: neonStrength, weight: 0.45 },
          { confidence: technicalPresentation ? 1 : 0, weight: 0.2 },
          { confidence: ramp(darkHeroSurfaces.length, 0, 2), weight: 0.15 },
        ]),
        maximumPoints: 5,
        minimumConfidence: 0.45,
        evidence: [
          `${heading.fontSize}px principal heading on a dark hero surface`,
          `${glowElements.length} saturated glow elements and ${explicitlyNeonElements.length} explicitly neon-styled elements`,
          `${saturatedHeroElements.length} saturated hero accents`,
          `${monospaceElements} hero monospace elements and ${codeInterfaceElements} code-interface cues`,
        ],
      });
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
