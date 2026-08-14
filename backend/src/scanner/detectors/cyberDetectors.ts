import type { AnalysisContext, Detector, ElementSnapshot } from '../types';
import { evaluateConstellation } from './constellations';
import { createFinding, createMeasuredFinding, isPill, mainHeading, ramp, weightedConfidence } from './helpers';

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

interface CodeEditorCandidate {
  element: ElementSnapshot;
  score: number;
  signals: string[];
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

const CODE_EDITOR_MARKER = /(?:^|[\s_-])(?:code|editor|ide|snippet|source|studio|window)(?:$|[\s_-])/i;
const CODE_FILE_OR_TOOL = /\b(?:vscode|visual studio|roblox.?studio|code.?server)|\b[\w-]+\.(?:[cm]?[jt]sx?|py|lua|luau|go|rs|cs|java|json|rb|php)\b/i;
const CODE_KEYWORD = /\b(?:async|await|class|const|end|export|function|if|import|interface|let|local|new|private|public|return|self|this|var)\b/gi;
const CODE_OPERATOR = /(?:=>|::|\.\w+\s*\(|\w+\s*[:=]\s*(?:["'\[{]|new\b)|[{}][,;]?)/g;

const codeEditorCandidate = (
  context: AnalysisContext,
  element: ElementSnapshot,
): CodeEditorCandidate | undefined => {
  if (
    element.rect.y >= 1000 ||
    element.rect.width < 280 || element.rect.width > Math.min(900, context.viewport.width * 0.62) ||
    element.rect.height < 150 || element.rect.height > 760 ||
    element.text.length < 70
  ) return undefined;

  const markerText = `${element.tag} ${element.classes.join(' ')} ${element.ariaLabel ?? ''}`;
  const namedEditor = CODE_EDITOR_MARKER.test(markerText) || CODE_FILE_OR_TOOL.test(element.text);
  const preformatted = /^(?:code|pre|samp)$/.test(element.tag) || /^(?:pre|pre-wrap|break-spaces)$/.test(element.whiteSpace);
  const monospace = MONOSPACE_FONT.test(element.fontFamily) || preformatted;
  const keywords = [...new Set(element.text.match(CODE_KEYWORD)?.map((keyword) => keyword.toLowerCase()) ?? [])];
  const operators = element.text.match(CODE_OPERATOR)?.length ?? 0;
  const dark = isDarkSurface(element);
  const chromeDots = context.elements.filter((candidate) =>
    candidate.nodeIndex !== element.nodeIndex &&
    candidate.rect.width >= 6 && candidate.rect.width <= 18 &&
    candidate.rect.height >= 6 && candidate.rect.height <= 18 &&
    candidate.borderRadius >= Math.min(candidate.rect.width, candidate.rect.height) * 0.4 &&
    candidate.rect.x >= element.rect.x &&
    candidate.rect.x + candidate.rect.width <= element.rect.x + element.rect.width &&
    candidate.rect.y >= element.rect.y &&
    candidate.rect.y <= element.rect.y + 70 &&
    hasSaturatedComputedColor(candidate.backgroundColor),
  ).length;

  let score = 0;
  const signals: string[] = [];
  if (namedEditor) { score += 2; signals.push('editor, IDE, or source-file labeling'); }
  if (preformatted) { score += 1; signals.push('preformatted code structure'); }
  if (monospace) { score += 1; signals.push('monospace source typography'); }
  if (keywords.length >= 4) { score += 3; signals.push(`${keywords.length} distinct programming keywords`); }
  else if (keywords.length >= 2) { score += 2; signals.push(`${keywords.length} distinct programming keywords`); }
  if (operators >= 4) { score += 2; signals.push(`${operators} code operators or assignments`); }
  else if (operators >= 2) { score += 1; signals.push(`${operators} code operators or assignments`); }
  if (dark) { score += 1; signals.push('dark editor surface'); }
  if (chromeDots >= 3) { score += 2; signals.push('three-dot desktop window chrome'); }

  const hasCodeSemantics = keywords.length >= 2 && operators >= 2;
  const hasEditorPresentation = namedEditor || (monospace && dark) || (preformatted && monospace);
  return hasCodeSemantics && hasEditorPresentation && score >= 5
    ? { element, score, signals }
    : undefined;
};

const codeEditorCandidates = (context: AnalysisContext): CodeEditorCandidate[] =>
  context.elements
    .map((element) => codeEditorCandidate(context, element))
    .filter((candidate): candidate is CodeEditorCandidate => Boolean(candidate))
    .sort((left, right) =>
      right.score - left.score ||
      left.element.rect.width * left.element.rect.height - right.element.rect.width * right.element.rect.height,
    );

const profileFields = [
  ['name', /(?:["']?name["']?\s*[:=]|this\.name\s*=)/i],
  ['location', /(?:["']?location["']?\s*[:=]|this\.location\s*=)/i],
  ['role', /(?:["']?role["']?\s*[:=]|this\.role\s*=)/i],
  ['stack', /(?:["']?(?:techStack|stack|skills|technologies)["']?\s*[:=]|this\.(?:techStack|stack|skills|technologies)\s*=)/i],
  ['github', /(?:["']?github["']?\s*[:=]|this\.github\s*=)/i],
  ['availability', /(?:openToWork|availableForWork|available|this\.openToWork)\s*[:=]/i],
  ['status', /(?:["']?status["']?\s*[:=]|this\.status\s*=)/i],
] as const;

const CODE_PROFILE_PRESENTATION = /profile\.json|developer profile|class\s+\w*(?:developer|engineer)|new\s+\w*(?:developer|engineer)\s*\(|(?:const|let|var)\s+\w+\s*=\s*(?:new\s*)?\{|terminal|code.?window|editor.?window/i;
const DEVELOPER_IDENTITY = /developer|engineer|software|full.?stack|front.?end|back.?end/i;
const AVAILABILITY_PILL = /\b(?:available|open)\b.{0,50}\b(?:freelance|full.?time|hire|work|opportunit|collaborat)/i;
const HERO_CTA = /view (?:projects|specs|modules|experience)|see (?:my )?work|contact|get in touch|let'?s talk|hire me/i;
const SYSTEM_STATUS_PILL = /\b(?:system|server|network|node|core)\s*(?:is\s*)?(?:online|ready|active|connected|operational)\b/i;

interface DeveloperProfileCandidate {
  element: ElementSnapshot;
  fields: string[];
}

const developerProfileCandidates = (context: AnalysisContext): DeveloperProfileCandidate[] =>
  context.elements
    .map((element) => {
      const value = `${elementMarkers(element.classes)} ${element.text}`;
      const fields = profileFields.filter(([, pattern]) => pattern.test(value)).map(([field]) => field);
      return {
        element,
        fields,
        codePresentation: CODE_PROFILE_PRESENTATION.test(value),
        developerIdentity: DEVELOPER_IDENTITY.test(value),
      };
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
    .sort((left, right) => left.element.rect.width * left.element.rect.height - right.element.rect.width * right.element.rect.height)
    .map(({ element, fields }) => ({ element, fields }));

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
    id: 'faux-code-editor',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const match = codeEditorCandidates(context)[0];
      return createMeasuredFinding(
        this.id,
        this.category,
        'Decorative source-code window',
        'A substantial syntax-heavy editor or IDE window is used as hero decoration.',
        {
          confidence: match ? ramp(match.score, 4, 11) : 0,
          maximumPoints: 6,
          minimumConfidence: 0.35,
          evidence: match ? [
            `${match.element.rect.width}x${match.element.rect.height}px code-editor region`,
            ...match.signals.slice(0, 6),
            match.element.text.slice(0, 140),
          ] : [],
        },
      );
    },
  },
  {
    id: 'developer-profile-object',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const matches = developerProfileCandidates(context);
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
    id: 'developer-identity-console-hero',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading || heading.rect.x > context.viewport.width * 0.48) return [];

      const availability = context.elements
        .filter((element) =>
          element.text.length > 0 &&
          element.text.length <= 90 &&
          AVAILABILITY_PILL.test(element.text) &&
          isPill(element) &&
          element.rect.y < heading.rect.y &&
          heading.rect.y - element.rect.y <= 190,
        )
        .sort((left, right) => Math.abs(heading.rect.y - left.rect.y) - Math.abs(heading.rect.y - right.rect.y))[0];
      const profile = developerProfileCandidates(context).find(({ element }) => {
        const panelCenterX = element.rect.x + element.rect.width / 2;
        const headingCenterX = heading.rect.x + heading.rect.width / 2;
        return panelCenterX > headingCenterX &&
          element.rect.x >= context.viewport.width * 0.43 &&
          element.rect.y <= heading.rect.y + heading.rect.height + 520 &&
          element.rect.y + element.rect.height >= heading.rect.y - 220;
      });
      if (!profile) return [];

      const heroBottom = Math.max(
        heading.rect.y + heading.rect.height + 520,
        profile.element.rect.y + profile.element.rect.height + 80,
      );
      const heroElements = context.elements.filter((element) => element.rect.y >= -20 && element.rect.y <= heroBottom);
      const darkCanvas = heroElements.some((element) =>
        isDarkSurface(element) &&
        element.rect.width >= context.viewport.width * 0.65 &&
        element.rect.height >= context.viewport.height * 0.45,
      );
      const saturatedAccents = heroElements.filter((element) =>
        hasSaturatedComputedColor(`${element.backgroundColor} ${element.backgroundImage} ${element.boxShadow} ${element.textShadow}`),
      ).length;
      const controls = [...context.links, ...context.buttons.filter((button) => button.tag === 'button')];
      const pairedCtas = controls.filter((element) =>
        element.rect.y <= heroBottom &&
        Math.abs(element.rect.y - heading.rect.y) <= 520 &&
        HERO_CTA.test(element.text),
      ).length;
      const codeBrand = heroElements.some((element) =>
        element.text.length > 2 && element.text.length < 70 &&
        /<\/?[a-z][^>]*>|<[^>]+\/>/i.test(element.text) &&
        MONOSPACE_FONT.test(element.fontFamily),
      );
      const trustBadgeCount = [
        /git(?:hub)?\s+native/i,
        /cloudflare\s+deployed/i,
        /ssl\s+certified/i,
        /(?:production|live)\s+(?:ready|deployed)/i,
      ].filter((pattern) => pattern.test(context.visibleText)).length;
      const geometryConfidence = weightedConfidence([
        { confidence: ramp(profile.element.rect.x - (heading.rect.x + heading.rect.width), -80, 180), weight: 0.6 },
        { confidence: 1 - ramp(Math.abs(profile.element.rect.y - heading.rect.y), 80, 430), weight: 0.4 },
      ]);
      const match = evaluateConstellation([
        { id: 'profile-layout', confidence: geometryConfidence, evidence: `${profile.element.rect.width}x${profile.element.rect.height}px code-profile panel beside the heading` },
        { id: 'profile-fields', confidence: ramp(profile.fields.length, 2, 6), evidence: `${profile.fields.length} profile fields: ${profile.fields.join(', ')}` },
        { id: 'availability', confidence: availability ? 1 : 0, evidence: availability ? `Availability pill: ${availability.text.slice(0, 90)}` : undefined },
        { id: 'dark-canvas', confidence: darkCanvas ? 1 : 0, evidence: 'dark hero canvas' },
        { id: 'neon-accents', confidence: ramp(saturatedAccents, 2, 9), evidence: `${saturatedAccents} saturated blue or neon accents` },
        { id: 'paired-ctas', confidence: ramp(pairedCtas, 1, 2.5), evidence: `${pairedCtas} portfolio calls-to-action` },
        { id: 'trust-badges', confidence: ramp(trustBadgeCount, 0, 3), evidence: `${trustBadgeCount} deployment or security badges` },
        { id: 'code-brand', confidence: codeBrand ? 1 : 0, evidence: 'code-styled identity mark' },
      ], {
        anchors: ['profile-layout', 'profile-fields'],
        minimumGroups: 3,
        groups: [
          { id: 'developer object', alternatives: ['profile-layout', 'profile-fields'] },
          { id: 'availability cue', alternatives: ['availability'] },
          { id: 'technical styling', alternatives: ['dark-canvas', 'neon-accents'] },
          { id: 'conversion and trust', alternatives: ['paired-ctas', 'trust-badges'] },
          { id: 'coded branding', alternatives: ['code-brand'] },
        ],
      });

      return createMeasuredFinding(
        this.id,
        this.category,
        'Developer identity console hero',
        'A personal code object anchors a split-screen developer pitch with several familiar availability, technical, and conversion cues.',
        {
          confidence: match.confidence,
          maximumPoints: 12,
          minimumConfidence: 0.4,
          evidence: match.evidence,
        },
      );
    },
  },
  {
    id: 'cyber-code-editor-hero',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading || heading.rect.x > context.viewport.width * 0.48) return [];

      const statusBadge = context.elements
        .filter((element) =>
          element.text.length > 0 && element.text.length <= 90 &&
          SYSTEM_STATUS_PILL.test(element.text) &&
          element.rect.height >= 18 && element.rect.height <= 64 &&
          element.rect.width >= element.rect.height * 1.5 &&
          element.rect.y < heading.rect.y &&
          heading.rect.y - element.rect.y <= 200,
        )
        .sort((left, right) => Math.abs(heading.rect.y - left.rect.y) - Math.abs(heading.rect.y - right.rect.y))[0];
      const editor = codeEditorCandidates(context).find(({ element }) => {
        const editorCenterX = element.rect.x + element.rect.width / 2;
        const headingCenterX = heading.rect.x + heading.rect.width / 2;
        return editorCenterX > headingCenterX &&
          element.rect.x >= context.viewport.width * 0.43 &&
          element.rect.y <= heading.rect.y + heading.rect.height + 500 &&
          element.rect.y + element.rect.height >= heading.rect.y - 220;
      });
      if (!editor) return [];

      const heroBottom = Math.max(
        heading.rect.y + heading.rect.height + 520,
        editor.element.rect.y + editor.element.rect.height + 80,
      );
      const heroElements = context.elements.filter((element) => element.rect.y >= -20 && element.rect.y <= heroBottom);
      const darkCanvas = heroElements.some((element) =>
        isDarkSurface(element) &&
        element.rect.width >= context.viewport.width * 0.65 &&
        element.rect.height >= context.viewport.height * 0.45,
      );
      const saturatedAccents = heroElements.filter((element) =>
        hasSaturatedComputedColor(`${element.backgroundColor} ${element.backgroundImage} ${element.boxShadow} ${element.textShadow}`),
      ).length;
      const monospaceElements = heroElements.filter((element) => MONOSPACE_FONT.test(element.fontFamily)).length;
      const markers = context.documentMarkers.toLowerCase();
      const matrixRain = /matrix(?:[-_ ]?(?:canvas|rain|code))|digital[-_ ]?rain|code[-_ ]?rain/.test(markers);
      const technicalGrid = heroElements.some((element) => {
        const gradients = element.backgroundImage.match(/(?:repeating-)?linear-gradient/gi)?.length ?? 0;
        return gradients >= 2 &&
          element.rect.width >= context.viewport.width * 0.65 &&
          element.rect.height >= context.viewport.height * 0.45;
      });
      const controls = [...context.links, ...context.buttons.filter((button) => button.tag === 'button')];
      const commandNavigationCount = controls.filter((element) => {
        const text = element.text.trim();
        return element.rect.y < 260 && text.length > 1 && text.length <= 32 &&
          MONOSPACE_FONT.test(element.fontFamily) &&
          (/^_?[A-Z0-9()[\]{}<>./:+-]+$/.test(text) || /^_[a-z0-9-]+$/i.test(text));
      }).length;
      const pairedCtas = controls.filter((element) =>
        element.rect.y <= heroBottom &&
        Math.abs(element.rect.y - heading.rect.y) <= 520 &&
        HERO_CTA.test(element.text),
      ).length;
      const codeBrand = heroElements.some((element) =>
        element.text.length > 2 && element.text.length < 70 &&
        /<\/?[a-z][^>]*>|<[^>]+\/>/i.test(element.text) &&
        MONOSPACE_FONT.test(element.fontFamily),
      );
      const repeatedMotionCount = context.animations.length +
        heroElements.filter((element) => element.animationName && element.animationName !== 'none').length;
      const geometryConfidence = weightedConfidence([
        { confidence: ramp(editor.element.rect.x - (heading.rect.x + heading.rect.width), -80, 180), weight: 0.6 },
        { confidence: 1 - ramp(Math.abs(editor.element.rect.y - heading.rect.y), 80, 430), weight: 0.4 },
      ]);
      const match = evaluateConstellation([
        { id: 'editor-layout', confidence: geometryConfidence, evidence: `${editor.element.rect.width}x${editor.element.rect.height}px code editor beside the heading` },
        { id: 'editor-detail', confidence: ramp(editor.score, 4, 11), evidence: editor.signals.slice(0, 4).join(', ') },
        { id: 'status-badge', confidence: statusBadge ? 1 : 0, evidence: statusBadge ? `System-status badge: ${statusBadge.text.slice(0, 90)}` : undefined },
        { id: 'dark-canvas', confidence: darkCanvas ? 1 : 0, evidence: 'dark hero canvas' },
        { id: 'neon-accents', confidence: ramp(saturatedAccents, 2, 10), evidence: `${saturatedAccents} saturated blue or neon accents` },
        { id: 'monospace-system', confidence: ramp(monospaceElements, 1, 7), evidence: `${monospaceElements} monospace interface elements` },
        { id: 'matrix-rain', confidence: matrixRain ? 1 : 0, evidence: 'matrix-style code-rain canvas' },
        { id: 'technical-grid', confidence: technicalGrid ? 1 : 0, evidence: 'full-hero technical grid' },
        { id: 'command-navigation', confidence: ramp(commandNavigationCount, 1, 4), evidence: `${commandNavigationCount} command-styled navigation controls` },
        { id: 'paired-ctas', confidence: ramp(pairedCtas, 1, 2.5), evidence: `${pairedCtas} portfolio calls-to-action` },
        { id: 'code-brand', confidence: codeBrand ? 1 : 0, evidence: 'code-styled identity mark' },
        { id: 'repeated-motion', confidence: ramp(repeatedMotionCount, 3, 12), evidence: `${repeatedMotionCount} animated hero treatments` },
      ], {
        anchors: ['editor-layout', 'editor-detail'],
        minimumGroups: 3,
        groups: [
          { id: 'code editor', alternatives: ['editor-layout', 'editor-detail'] },
          { id: 'system status', alternatives: ['status-badge'] },
          { id: 'technical styling', alternatives: ['dark-canvas', 'neon-accents', 'monospace-system'] },
          { id: 'technical atmosphere', alternatives: ['matrix-rain', 'technical-grid'] },
          { id: 'command interface', alternatives: ['command-navigation', 'code-brand'] },
          { id: 'conversion row', alternatives: ['paired-ctas'] },
          { id: 'scripted motion', alternatives: ['repeated-motion'] },
        ],
      });

      return createMeasuredFinding(
        this.id,
        this.category,
        'Cyber code-editor hero constellation',
        'An adjacent source editor anchors a developer hero with several familiar status, command-interface, and technical-atmosphere cues.',
        {
          confidence: match.confidence,
          maximumPoints: 12,
          minimumConfidence: 0.4,
          evidence: match.evidence,
        },
      );
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
    id: 'matrix-code-rain',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const markers = context.documentMarkers.toLowerCase();
      const matches = [...new Set(markers.match(/matrix(?:[-_ ]?(?:canvas|rain|code))|digital[-_ ]?rain|code[-_ ]?rain/g) ?? [])];
      return matches.length
        ? [createFinding(this.id, this.category, 'Matrix-style code rain', 'A full-screen digital-rain layer turns the portfolio backdrop into a familiar hacker-interface canvas.', 3, matches.slice(0, 5))]
        : [];
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
