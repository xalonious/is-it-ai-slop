import type { AnalysisContext, Detector, ElementSnapshot } from '../types';
import { evaluateConstellation } from './constellations';
import {
  createMeasuredFinding,
  inHero,
  inverseRamp,
  mainHeading,
  near,
  normalizedText,
  ramp,
  uniqueTexts,
  weightedConfidence,
} from './helpers';

const CTA_PATTERN = /view (?:projects|specs|modules|experience)|see (my )?work|^contact$|contact me|get in touch|let'?s talk|book (?:a )?call|(?:check|download) (my )?(cv|resume)|hire me|explore projects/i;
const SOCIAL_PATTERN = /github|linkedin|twitter|x\.com|dribbble|behance/i;
const CODE_PANEL_MARKER = /(?:^|[\s_-])(?:code|editor|profile|snippet|terminal|window)(?:$|[\s_-])/i;
const CODE_PANEL_TEXT = /(?:\b(?:const|let|var|class|function|interface)\b\s+\w+|\w+\s*[:=]\s*["'\[{]|=>|\{[\s\S]*\})/i;
const MONOSPACE_FONT = /(?:cascadia|code|consolas|courier|fira|hack|ibm plex mono|inconsolata|menlo|monaco|mono|source code|terminal)/i;
const TYPEWRITER_MARKER = /(?:^|[\s_-])(?:typewriter(?:__cursor|__wrapper)?|typed(?:-cursor)?|typing(?:-cursor|-effect|-text)?)(?:$|[\s_-])/i;
const ROLE_CONTEXT = /\bi\s+am\s+(?:a|an)\b|\b(?:developer|engineer|designer|programmer|full.?stack|front.?end|back.?end|software)\b/i;
const TRANSIENT_STATUS = /^(?:loading|please wait|initializing|connecting|fetching|preparing|booting|starting)(?:[\s.!â€¦_-].*)?$/i;

const typewriterElements = (context: AnalysisContext, heading: ElementSnapshot): ElementSnapshot[] =>
  context.elements.filter((element) =>
    element.rect.y >= heading.rect.y - 40 &&
    element.rect.y <= heading.rect.y + heading.rect.height + 300 &&
    element.text.length <= 100 &&
    TYPEWRITER_MARKER.test(`${element.classes.join(' ')} ${element.ariaLabel ?? ''}`),
  );

const typewriterHasRoleContext = (
  context: AnalysisContext,
  heading: ElementSnapshot,
  matches: ElementSnapshot[],
): boolean => {
  if (matches.some((element) => ROLE_CONTEXT.test(element.text))) return true;
  return context.elements.some((element) =>
    element.rect.y >= heading.rect.y - 40 &&
    element.rect.y <= heading.rect.y + heading.rect.height + 320 &&
    element.text.length <= 140 &&
    ROLE_CONTEXT.test(element.text),
  );
};

const circularHeroPortrait = (
  context: AnalysisContext,
  heading: ElementSnapshot,
): ElementSnapshot | undefined =>
  context.images
    .filter((image) => {
      const shorterSide = Math.min(image.rect.width, image.rect.height);
      const aspectDifference = Math.abs(image.rect.width - image.rect.height) / Math.max(shorterSide, 1);
      return inHero(image) &&
        image.rect.x >= context.viewport.width * 0.48 &&
        shorterSide >= 220 && shorterSide <= 560 &&
        aspectDifference <= 0.16 &&
        image.borderRadius >= shorterSide * 0.4 &&
        image.rect.y <= heading.rect.y + heading.rect.height + 400;
    })
    .sort((left, right) => right.rect.width * right.rect.height - left.rect.width * left.rect.height)[0];

const atmosphericHeroCanvas = (
  context: AnalysisContext,
  heading: ElementSnapshot,
): ElementSnapshot | undefined =>
  context.elements
    .filter((element) =>
      element.tag === 'canvas' &&
      element.rect.x <= context.viewport.width * 0.1 &&
      element.rect.y <= heading.rect.y + 80 &&
      element.rect.width >= context.viewport.width * 0.75 &&
      element.rect.height >= context.viewport.height * 0.45 &&
      element.rect.y + element.rect.height >= heading.rect.y + heading.rect.height + 180,
    )
    .sort((left, right) => left.rect.width * left.rect.height - right.rect.width * right.rect.height)[0];

const heroCtas = (context: AnalysisContext, heading: ElementSnapshot): ElementSnapshot[] => {
  const controls = [...context.links, ...context.buttons.filter((button) => button.tag === 'button')];
  return controls.filter((element) => inHero(element) && near(element, heading, 520) && CTA_PATTERN.test(element.text));
};

const isDarkSurface = (element: ElementSnapshot): boolean => {
  const match = element.backgroundColor.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!match) return false;
  const [red, green, blue] = [Number(match[1]), Number(match[2]), Number(match[3])].map((channel) => channel / 255);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue <= 0.2;
};

const isTransientStatus = (element: ElementSnapshot): boolean => {
  const markers = `${element.classes.join(' ')} ${element.ariaLabel ?? ''}`;
  return element.ariaBusy ||
    /^(?:status|progressbar)$/.test(element.role ?? '') ||
    TRANSIENT_STATUS.test(element.text.trim()) ||
    /(?:^|[\s_-])(?:loader|loading|progress|skeleton|spinner)(?:$|[\s_-])/i.test(markers);
};

export const heroDetectors: Detector[] = [
  {
    id: 'hero-pill',
    category: 'layout',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading) return [];
      const badges = context.elements.filter(
        (element) =>
          element.text.length > 0 &&
          element.text.length < 70 &&
          !isTransientStatus(element) &&
          element.rect.height >= 18 &&
          element.rect.height <= 64 &&
          element.rect.width >= element.rect.height * 1.35 &&
          (
            element.borderRadius >= element.rect.height * 0.08 ||
            element.borderTopWidth > 0 ||
            element.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
            element.backgroundImage !== 'none' ||
            element.boxShadow !== 'none'
          ) &&
          element.rect.y < heading.rect.y &&
          heading.rect.y - element.rect.y < 180 &&
          element.rect.x <= heading.rect.x + heading.rect.width + 80 &&
          element.rect.x + element.rect.width >= heading.rect.x - 80,
      );
      const measured = badges.map((element) => ({
        element,
        confidence: weightedConfidence([
          { confidence: inverseRamp(element.rect.height, 28, 64), weight: 0.2 },
          { confidence: ramp(element.rect.width / Math.max(element.rect.height, 1), 1.35, 3), weight: 0.2 },
          { confidence: ramp(element.borderRadius / Math.max(element.rect.height, 1), 0.1, 0.42), weight: 0.25 },
          { confidence: inverseRamp(heading.rect.y - element.rect.y, 70, 180), weight: 0.35 },
        ]),
      })).sort((left, right) => right.confidence - left.confidence);
      const match = measured[0];
      return createMeasuredFinding(
        this.id,
        this.category,
        'Pre-heading specimen pill',
        'A compact rounded badge sits directly above the principal heading.',
        {
          confidence: match?.confidence ?? 0,
          maximumPoints: 4,
          minimumConfidence: 0.45,
          evidence: match ? uniqueTexts([match.element], 3) : [],
        },
      );
    },
  },
  {
    id: 'paired-hero-ctas',
    category: 'layout',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading) return [];
      const ctas = heroCtas(context, heading);
      return createMeasuredFinding(this.id, this.category, 'The ceremonial two-button hero', 'Multiple familiar portfolio calls-to-action occupy the hero area.', {
        confidence: ramp(ctas.length, 1, 2.5),
        maximumPoints: 4,
        minimumConfidence: 0.45,
        evidence: uniqueTexts(ctas, 4),
      });
    },
  },
  {
    id: 'typewriter-role-carousel',
    category: 'animation',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading) return [];
      const matches = typewriterElements(context, heading);
      const roleContext = typewriterHasRoleContext(context, heading, matches);
      const cursor = matches.some((element) => /cursor/i.test(element.classes.join(' ')) || /^[|_â–ˆ]$/.test(element.text.trim()));
      return createMeasuredFinding(this.id, this.category, 'Rotating typewriter role', 'The opening pitch cycles through developer roles with a scripted typing cursor.', {
        confidence: matches.length && roleContext ? weightedConfidence([
          { confidence: ramp(matches.length, 0, 3), weight: 0.45 },
          { confidence: roleContext ? 1 : 0, weight: 0.35 },
          { confidence: cursor ? 1 : 0, weight: 0.2 },
        ]) : 0,
        maximumPoints: 4,
        minimumConfidence: 0.5,
        evidence: matches.length ? [
          `${matches.length} typewriter wrapper or cursor elements`,
          ...uniqueTexts(matches, 3),
          ...(cursor ? ['Animated typing cursor'] : []),
        ] : [],
      });
    },
  },
  {
    id: 'hero-canvas-atmosphere',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading) return [];
      const canvas = atmosphericHeroCanvas(context, heading);
      return createMeasuredFinding(this.id, this.category, 'Full-hero canvas atmosphere', 'A viewport-sized canvas supplies animated ambience behind the opening portfolio pitch.', {
        confidence: canvas ? weightedConfidence([
          { confidence: ramp(canvas.rect.width / context.viewport.width, 0.7, 0.95), weight: 0.55 },
          { confidence: ramp(canvas.rect.height / context.viewport.height, 0.4, 0.75), weight: 0.45 },
        ]) : 0,
        maximumPoints: 2,
        minimumConfidence: 0.55,
        evidence: canvas ? [`${canvas.rect.width}x${canvas.rect.height}px hero canvas`, 'Used as weak atmospheric evidence unless paired with other hero conventions'] : [],
      });
    },
  },
  {
    id: 'circular-profile-hero',
    category: 'layout',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading) return [];
      const portrait = circularHeroPortrait(context, heading);
      const shorterSide = portrait ? Math.min(portrait.rect.width, portrait.rect.height) : 0;
      return createMeasuredFinding(this.id, this.category, 'Circular portrait hero', 'A large circular profile portrait anchors the visual half of the introductory split layout.', {
        confidence: portrait ? weightedConfidence([
          { confidence: ramp(shorterSide, 200, 380), weight: 0.45 },
          { confidence: ramp(portrait.borderRadius / Math.max(shorterSide, 1), 0.35, 0.5), weight: 0.35 },
          { confidence: ramp(portrait.rect.x / context.viewport.width, 0.42, 0.62), weight: 0.2 },
        ]) : 0,
        maximumPoints: 3,
        minimumConfidence: 0.55,
        evidence: portrait ? [`${portrait.rect.width}x${portrait.rect.height}px circular portrait`, `Positioned at x=${Math.round(portrait.rect.x)}px beside the opening copy`] : [],
      });
    },
  },
  {
    id: 'animated-profile-hero',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading || heading.rect.x > context.viewport.width * 0.5) return [];
      const typewriter = typewriterElements(context, heading);
      const roleContext = typewriterHasRoleContext(context, heading, typewriter);
      const portrait = circularHeroPortrait(context, heading);
      if (!portrait) return [];

      const canvas = atmosphericHeroCanvas(context, heading);
      const ctas = heroCtas(context, heading);
      const heroElements = context.elements.filter((element) => element.rect.y >= -20 && element.rect.y < 900);
      const darkCanvas = heroElements.some((element) =>
        isDarkSurface(element) &&
        element.rect.width >= context.viewport.width * 0.7 &&
        element.rect.height >= context.viewport.height * 0.45,
      );
      const gradientSurfaces = heroElements.filter((element) => /gradient/i.test(element.backgroundImage)).length;
      const glowingCtas = ctas.filter((element) =>
        element.boxShadow !== 'none' || /gradient/i.test(element.backgroundImage),
      ).length;
      const canonicalNavigation = context.links.filter((link) =>
        link.rect.y < 120 && /about|skills|experience|projects?|education|contact/i.test(link.text),
      ).length;
      const skillChips = context.elements.filter((element) =>
        element.rect.y >= 650 && element.rect.y < 1700 &&
        element.rect.height >= 18 && element.rect.height <= 64 &&
        element.rect.width >= 45 && element.rect.width <= 240 &&
        element.borderRadius >= 8 &&
        element.text.length >= 2 && element.text.length <= 40,
      ).length;
      const cursor = typewriter.some((element) =>
        /cursor/i.test(element.classes.join(' ')) || /^[|_â–ˆ]$/.test(element.text.trim()));
      const portraitSize = Math.min(portrait.rect.width, portrait.rect.height);
      const geometryConfidence = weightedConfidence([
        { confidence: ramp(portraitSize, 180, 400), weight: 0.35 },
        { confidence: ramp(portrait.rect.x - (heading.rect.x + heading.rect.width), -100, 180), weight: 0.4 },
        { confidence: 1 - ramp(Math.abs(portrait.rect.y - heading.rect.y), 100, 480), weight: 0.25 },
      ]);
      const canvasConfidence = canvas ? weightedConfidence([
        { confidence: ramp(canvas.rect.width / context.viewport.width, 0.7, 0.95), weight: 0.55 },
        { confidence: ramp(canvas.rect.height / context.viewport.height, 0.4, 0.75), weight: 0.45 },
      ]) : 0;
      const match = evaluateConstellation([
        { id: 'portrait-layout', confidence: geometryConfidence, evidence: `${portrait.rect.width}x${portrait.rect.height}px circular portrait beside the heading` },
        { id: 'typewriter', confidence: typewriter.length && roleContext ? ramp(typewriter.length, 0, 3) : 0, evidence: `${typewriter.length} role typewriter elements` },
        { id: 'canvas', confidence: canvasConfidence, evidence: canvas ? `${canvas.rect.width}x${canvas.rect.height}px atmospheric canvas` : undefined },
        { id: 'paired-ctas', confidence: ramp(ctas.length, 1, 2.5), evidence: `Hero calls-to-action: ${uniqueTexts(ctas, 4).join(', ')}` },
        { id: 'dark-surface', confidence: darkCanvas ? 1 : 0, evidence: 'dark full-viewport hero surface' },
        { id: 'gradient-style', confidence: ramp(gradientSurfaces, 0, 3), evidence: `${gradientSurfaces} gradient-treated hero surfaces` },
        { id: 'glowing-ctas', confidence: ramp(glowingCtas, 0, 2), evidence: 'glowing or gradient calls-to-action' },
        { id: 'resume-navigation', confidence: ramp(canonicalNavigation, 2, 6), evidence: `${canonicalNavigation} canonical résumé navigation links` },
        { id: 'skill-chips', confidence: ramp(skillChips, 5, 20), evidence: `${skillChips} categorized skill chips below the hero` },
        { id: 'typing-cursor', confidence: cursor ? 1 : 0, evidence: 'scripted typing cursor' },
      ], {
        anchors: ['portrait-layout'],
        minimumGroups: 3,
        groups: [
          { id: 'identity portrait', alternatives: ['portrait-layout'] },
          { id: 'scripted motion', alternatives: ['typewriter', 'typing-cursor', 'canvas'] },
          { id: 'conversion row', alternatives: ['paired-ctas'] },
          { id: 'fashion styling', alternatives: ['dark-surface', 'gradient-style', 'glowing-ctas'] },
          { id: 'résumé structure', alternatives: ['resume-navigation', 'skill-chips'] },
        ],
      });

      return createMeasuredFinding(
        this.id,
        this.category,
        'Animated developer-profile hero',
        'A circular profile layout converges with several familiar animated developer-portfolio conventions.',
        {
          confidence: match.confidence,
          maximumPoints: 12,
          minimumConfidence: 0.4,
          evidence: [`Visual heading: ${heading.text.slice(0, 100)}`, ...match.evidence],
        },
      );
    },
  },
  {
    id: 'split-hero',
    category: 'layout',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading || heading.rect.x > context.viewport.width * 0.48) return [];
      const rightVisual = [...context.images, ...context.elements.filter((element) =>
        element.text.length >= 60 &&
        element.rect.width <= context.viewport.width * 0.48 &&
        (
          CODE_PANEL_MARKER.test(`${element.classes.join(' ')} ${element.ariaLabel ?? ''}`) ||
          (MONOSPACE_FONT.test(element.fontFamily) && CODE_PANEL_TEXT.test(element.text))
        ),
      )]
        .filter((element) =>
          inHero(element) &&
          element.rect.x > context.viewport.width * 0.43 &&
          element.rect.width > 220 &&
          element.rect.height > 180,
        )
        .sort((left, right) => left.rect.width * left.rect.height - right.rect.width * right.rect.height)[0];
      return createMeasuredFinding(this.id, this.category, 'Split-screen hero formation', 'Large introductory copy is paired with a substantial visual on the right.', {
        confidence: rightVisual ? weightedConfidence([
          { confidence: inverseRamp(heading.rect.x / context.viewport.width, 0.2, 0.48), weight: 0.35 },
          { confidence: ramp(Math.min(rightVisual.rect.width, rightVisual.rect.height), 180, 260), weight: 0.65 },
        ]) : 0,
        maximumPoints: 3,
        minimumConfidence: 0.45,
        evidence: rightVisual ? [`Heading begins at x=${heading.rect.x}px`, `Right-side visual is ${rightVisual.rect.width}×${rightVisual.rect.height}px`, rightVisual.tag === 'img' ? 'Image presentation' : 'Code-panel presentation'] : [],
      });
    },
  },
  {
    id: 'giant-greeting',
    category: 'copy',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading || !/^(hi|hey|hello)[, !]|^i'?m\b/i.test(normalizedText(heading.text))) return [];
      return createMeasuredFinding(this.id, this.category, 'Large-format personal greeting', 'The hero opens with the portfolio equivalent of “Hello, world.”', {
        confidence: ramp(heading.fontSize, 36, 64),
        maximumPoints: 1,
        evidence: [`${heading.fontSize}px heading: “${heading.text.slice(0, 100)}”`],
      });
    },
  },
  {
    id: 'gradient-heading',
    category: 'layout',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading) return [];
      const gradientText = context.elements.filter((element) =>
        element.text.length > 0 &&
        element.rect.y < 900 &&
        /gradient/i.test(`${element.backgroundImage} ${element.classes.join(' ')}`) &&
        heading.text.includes(element.text) &&
        element.rect.x >= heading.rect.x - 2 &&
        element.rect.y >= heading.rect.y - 2 &&
        element.rect.x + element.rect.width <= heading.rect.x + heading.rect.width + 2 &&
        element.rect.y + element.rect.height <= heading.rect.y + heading.rect.height + 2,
      );
      const gradients = [
        ...(/gradient/i.test(`${heading.backgroundImage} ${heading.classes.join(' ')}`) ? [heading] : []),
        ...gradientText,
      ];
      const largest = gradients.sort((left, right) => right.fontSize - left.fontSize)[0];
      return createMeasuredFinding(this.id, this.category, 'Gradient headline detected', 'A large heading uses gradient treatment, a popular AI-era emphasis device.', {
        confidence: largest ? ramp(largest.fontSize, 30, 64) : 0,
        maximumPoints: 6,
        minimumConfidence: 0.35,
        evidence: uniqueTexts(gradients, 3),
      });
    },
  },
  {
    id: 'hero-social-cluster',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const social = context.links.filter((link) => inHero(link) && SOCIAL_PATTERN.test(`${link.text} ${link.ariaLabel ?? ''} ${link.href ?? ''}`));
      return createMeasuredFinding(this.id, this.category, 'Hero social orbit', 'Multiple social destinations cluster around the opening pitch.', {
        confidence: ramp(social.length, 1, 3),
        maximumPoints: 1,
        minimumConfidence: 0.45,
        evidence: uniqueTexts(social.map((link) => ({ ...link, text: link.text || link.ariaLabel || link.href || 'social link' })), 5),
      });
    },
  },
];
