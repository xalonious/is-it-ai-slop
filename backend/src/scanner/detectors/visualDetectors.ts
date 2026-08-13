import type { Detector, ElementSnapshot } from '../types';
import {
  createMeasuredFinding,
  inverseRamp,
  isPill,
  probableSurface,
  ramp,
  weightedConfidence,
} from './helpers';

const sizeable = (element: ElementSnapshot) => element.rect.width >= 80 && element.rect.height >= 32;
const translucent = (color: string) => /rgba\([^)]*,\s*0?\.[0-8]/i.test(color) || /color-mix/i.test(color);
const gradientValue = (element: ElementSnapshot): string =>
  `${element.backgroundImage} ${element.pseudoBackgroundImage}`;
const hasGradient = (element: ElementSnapshot): boolean =>
  /(?:linear|radial|conic)-gradient\(/i.test(gradientValue(element));

interface ColorSample {
  hue: number;
  saturation: number;
  lightness: number;
  alpha: number;
}

const rgbToHsl = (red: number, green: number, blue: number, alpha = 1): ColorSample => {
  const [r, g, b] = [red, green, blue].map((channel) => Math.max(0, Math.min(255, channel)) / 255);
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  let hue = 0;

  if (delta > 0) {
    if (maximum === r) hue = 60 * (((g - b) / delta) % 6);
    else if (maximum === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { hue: (hue + 360) % 360, saturation, lightness, alpha };
};

const parseHexColor = (value: string): ColorSample | undefined => {
  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length)) return undefined;
  const expanded = hex.length <= 4
    ? hex.split('').map((digit) => `${digit}${digit}`).join('')
    : hex;
  return rgbToHsl(
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
    expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  );
};

const parseRgbColor = (value: string): ColorSample | undefined => {
  const channels = value.match(/-?[\d.]+%?/g);
  if (!channels || channels.length < 3) return undefined;
  const toChannel = (channel: string) => channel.endsWith('%')
    ? Number.parseFloat(channel) * 2.55
    : Number.parseFloat(channel);
  const alpha = channels[3]
    ? Number.parseFloat(channels[3]) / (channels[3].endsWith('%') ? 100 : 1)
    : 1;
  return rgbToHsl(toChannel(channels[0]), toChannel(channels[1]), toChannel(channels[2]), alpha);
};

const parseHslColor = (value: string): ColorSample | undefined => {
  const rawChannels = value.match(/-?[\d.]+%?/g);
  const channels = rawChannels?.map(Number.parseFloat);
  if (!channels || channels.length < 3) return undefined;
  return {
    hue: ((channels[0] % 360) + 360) % 360,
    saturation: channels[1] / 100,
    lightness: channels[2] / 100,
    alpha: channels[3] === undefined ? 1 : channels[3] / (rawChannels?.[3].endsWith('%') ? 100 : 1),
  };
};

const colorSamples = (value: string): ColorSample[] => {
  const tokens = value.match(/#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/gi) ?? [];
  return tokens.flatMap((token) => {
    if (token.startsWith('#')) return parseHexColor(token) ?? [];
    if (/^rgba?/i.test(token)) return parseRgbColor(token) ?? [];
    if (/^hsla?/i.test(token)) return parseHslColor(token) ?? [];

    const channels = token.match(/-?[\d.]+/g)?.map(Number);
    if (!channels || channels.length < 3) return [];
    return [{
      hue: ((channels[2] % 360) + 360) % 360,
      saturation: Math.min(1, channels[1] / 0.4),
      lightness: channels[0] > 1 ? channels[0] / 100 : channels[0],
      alpha: channels[3] === undefined ? 1 : channels[3] > 1 ? channels[3] / 100 : channels[3],
    }];
  });
};

const hasIndigoVioletPair = (element: ElementSnapshot): boolean => {
  const colors = colorSamples(gradientValue(element)).filter(
    (color) => color.saturation >= 0.38 && color.lightness >= 0.16 && color.lightness <= 0.9,
  );
  return colors.some((blue) =>
    blue.hue >= 195 && blue.hue <= 252 &&
    colors.some((violet) => violet.hue >= 252 && violet.hue <= 315 && violet.hue - blue.hue >= 10),
  );
};

const openingArea = (element: ElementSnapshot, viewport: { width: number; height: number }): number => {
  const left = Math.max(0, element.rect.x);
  const top = Math.max(0, element.rect.y);
  const right = Math.min(viewport.width, element.rect.x + element.rect.width);
  const bottom = Math.min(viewport.height, element.rect.y + element.rect.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
};

const isDarkCanvas = (elements: ElementSnapshot[], viewport: { width: number; height: number }): boolean => {
  const viewportArea = viewport.width * viewport.height;
  return elements.some((element) =>
    openingArea(element, viewport) >= viewportArea * 0.45 &&
    colorSamples(element.backgroundColor).some((color) => color.alpha >= 0.5 && color.lightness <= 0.18),
  );
};

const isInteractive = (element: ElementSnapshot): boolean =>
  /^(?:a|button|input|select|textarea|summary)$/.test(element.tag) || Boolean(element.href);

const hasStateMeaning = (element: ElementSnapshot): boolean =>
  /\b(?:active|alert|danger|error|focus|invalid|loading|offline|online|progress|selected|status|success|valid|warning)\b/i
    .test(`${element.classes.join(' ')} ${element.ariaLabel ?? ''} ${element.text}`);

const maximumBlur = (value: string, functionName: 'blur' | 'drop-shadow'): number => {
  const expressions = value.match(new RegExp(`${functionName}\\([^)]*\\)`, 'gi')) ?? [];
  return Math.max(
    0,
    ...expressions.flatMap((expression) =>
      (expression.match(/-?[\d.]+px/gi) ?? []).map((length) => Math.abs(Number.parseFloat(length))),
    ),
  );
};

const hasSaturatedColor = (value: string, minimumSaturation = 0.48): boolean =>
  colorSamples(value).some((color) =>
    color.alpha >= 0.16 &&
    color.saturation >= minimumSaturation &&
    color.lightness >= 0.2 &&
    color.lightness <= 0.88,
  );

const shadowBlur = (value: string): number => {
  const withoutColors = value.replace(/#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/gi, '');
  return Math.max(0, ...(withoutColors.match(/-?[\d.]+px/gi) ?? []).map((length) => Math.abs(Number.parseFloat(length))));
};

const hasNeonShadow = (element: ElementSnapshot): boolean => {
  const boxOrDropShadow = `${element.boxShadow} ${element.filter}`;
  const boxGlow = hasSaturatedColor(boxOrDropShadow, 0.52) &&
    (shadowBlur(element.boxShadow) >= 12 || maximumBlur(element.filter, 'drop-shadow') >= 12);
  const textGlow = /^h[1-3]$/.test(element.tag) &&
    hasSaturatedColor(element.textShadow, 0.52) &&
    shadowBlur(element.textShadow) >= 10;
  return boxGlow || textGlow;
};

const MONOSPACE_FONT = /(?:cascadia|code|consolas|courier|fira|hack|ibm plex mono|inconsolata|jetbrains|menlo|monaco|mono|source code|terminal)/i;

const splitCssLayers = (value: string): string[] => {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    else if (value[index] === ')') depth = Math.max(0, depth - 1);
    else if (value[index] === ',' && depth === 0) {
      layers.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  layers.push(value.slice(start).trim());
  return layers.filter(Boolean);
};

const hardBlackOffsetShadow = (value: string): boolean =>
  splitCssLayers(value).some((layer) => {
    const colors = colorSamples(layer);
    const nearBlack = colors.some((color) =>
      color.alpha >= 0.75 && color.lightness <= 0.12,
    );
    if (!nearBlack || /\binset\b/i.test(layer)) return false;

    const withoutColors = layer.replace(
      /#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/gi,
      '',
    );
    const lengths = (withoutColors.match(/-?[\d.]+px/gi) ?? []).map(Number.parseFloat);
    if (lengths.length < 3) return false;
    const [offsetX, offsetY, blur, spread = 0] = lengths;
    return Math.abs(offsetX) >= 2 && Math.abs(offsetX) <= 12 &&
      Math.abs(offsetY) >= 2 && Math.abs(offsetY) <= 12 &&
      Math.abs(blur) <= 1 && Math.abs(spread) <= 1.5;
  });

const nearBlackBorder = (element: ElementSnapshot): boolean =>
  element.borderTopWidth >= 2 &&
  element.borderTopStyle === 'solid' &&
  colorSamples(element.borderTopColor).some((color) =>
    color.alpha >= 0.8 && color.lightness <= 0.15,
  );

const uppercaseText = (element: ElementSnapshot): boolean => {
  const letters = element.text.match(/[a-z]/gi) ?? [];
  return letters.length >= 2 &&
    (element.textTransform === 'uppercase' || letters.every((letter) => letter === letter.toUpperCase()));
};

const uniqueMatches = (values: string[]): string[] => [...new Set(values.map((value) => value.toLowerCase()))];

export const visualDetectors: Detector[] = [
  {
    id: 'hard-edge-brutalism',
    category: 'layout',
    analyze(context) {
      const candidates = context.elements.filter(probableSurface);
      const hardSurfaces = candidates.filter((element) =>
        element.borderRadius <= 4 &&
        nearBlackBorder(element) &&
        hardBlackOffsetShadow(element.boxShadow),
      );
      const ratio = candidates.length ? hardSurfaces.length / candidates.length : 0;

      const accentSurfaces = hardSurfaces.filter((element) =>
        colorSamples(element.backgroundColor).some((color) =>
          color.alpha >= 0.8 && color.saturation >= 0.65 && color.lightness >= 0.35 && color.lightness <= 0.72,
        ),
      );
      return createMeasuredFinding(
        this.id,
        this.category,
        'Hard-edge component production line',
        'Thick black outlines, square corners, and zero-blur offset shadows repeat across the interface as a neo-brutalist component system.',
        {
          confidence: weightedConfidence([
            { confidence: ramp(hardSurfaces.length, 3, 12), weight: 0.5 },
            { confidence: ramp(ratio, 0.05, 0.28), weight: 0.35 },
            { confidence: ramp(accentSurfaces.length, 0, 5), weight: 0.15 },
          ]),
          maximumPoints: 7,
          minimumConfidence: 0.35,
          evidence: [
            `${hardSurfaces.length} probable surfaces combine a >=2px black border with a hard offset shadow`,
            `${Math.round(ratio * 100)}% of probable surfaces use the treatment`,
            `${accentSurfaces.length} of those surfaces also use a saturated flat accent`,
          ],
        },
      );
    },
  },
  {
    id: 'monospace-command-ui',
    category: 'template',
    analyze(context) {
      const commandLabels = context.elements.filter((element) =>
        element.text.length >= 2 &&
        element.text.length <= 90 &&
        element.rect.height <= 110 &&
        MONOSPACE_FONT.test(element.fontFamily) &&
        uppercaseText(element),
      );
      const interactiveLabels = commandLabels.filter((element) =>
        /^(?:a|button|nav)$/.test(element.tag) || Boolean(element.href),
      );
      const uppercaseHeadings = context.headings.filter((heading) =>
        heading.fontWeight >= 700 && uppercaseText(heading),
      );
      return createMeasuredFinding(
        this.id,
        this.category,
        'Command-line typography escaped the terminal',
        'Uppercase monospace labels spread across navigation and controls while heavy all-caps headings turn the full page into a command interface.',
        {
          confidence: weightedConfidence([
            { confidence: ramp(commandLabels.length, 4, 16), weight: 0.45 },
            { confidence: ramp(interactiveLabels.length, 2, 8), weight: 0.3 },
            { confidence: ramp(uppercaseHeadings.length, 1, 5), weight: 0.25 },
          ]),
          maximumPoints: 4,
          minimumConfidence: 0.4,
          evidence: [
            `${commandLabels.length} compact uppercase monospace labels`,
            `${interactiveLabels.length} appear in navigation or interactive controls`,
            `${uppercaseHeadings.length} heavy uppercase headings`,
          ],
        },
      );
    },
  },
  {
    id: 'portfolio-telemetry-cosplay',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const candidates = context.elements
        .map((element) => {
          const loads = element.text.match(/\b\d+(?:\.\d+)?%\s*(?:load|cpu|memory)\b/gi) ?? [];
          const latencies = element.text.match(/\b\d+(?:\.\d+)?\s*ms\b/gi) ?? [];
          const vocabulary = uniqueMatches(
            element.text.match(/\b(?:telemetry|node|system|terminal|core|gateway|engine|status)\b/gi) ?? [],
          );
          return { element, loads, latencies, vocabulary };
        })
        .filter(({ element }) =>
          element.rect.y >= 0 &&
          element.rect.y < context.viewport.height * 0.55 &&
          element.rect.width >= context.viewport.width * 0.5 &&
          element.rect.height >= 28 && element.rect.height <= 200 &&
          element.text.length <= 700 &&
          MONOSPACE_FONT.test(element.fontFamily) &&
          nearBlackBorder(element),
        )
        .sort((left, right) =>
          right.loads.length + right.latencies.length - left.loads.length - left.latencies.length,
        );
      const match = candidates[0];
      return createMeasuredFinding(
        this.id,
        this.category,
        'Decorative telemetry reporting for duty',
        'A prominent portfolio strip presents ornamental load and latency readings as if the personal site were an operations dashboard.',
        {
          confidence: match ? weightedConfidence([
            { confidence: ramp(match.loads.length + match.latencies.length, 2, 8), weight: 0.55 },
            { confidence: ramp(match.vocabulary.length, 1, 5), weight: 0.3 },
            { confidence: inverseRamp(match.element.rect.y / context.viewport.height, 0.15, 0.55), weight: 0.15 },
          ]) : 0,
          maximumPoints: 4,
          minimumConfidence: 0.45,
          evidence: match ? [
            `${match.loads.length} percentage load readings and ${match.latencies.length} latency readings`,
            `Interface vocabulary: ${match.vocabulary.join(', ')}`,
            `${match.element.rect.width}x${match.element.rect.height}px bordered telemetry region`,
          ] : [],
        },
      );
    },
  },
  {
    id: 'rounded-everything',
    category: 'template',
    analyze(context) {
      const candidates = context.elements.filter(probableSurface);
      const rounded = candidates.filter((element) => element.borderRadius >= 16);
      const ratio = candidates.length ? rounded.length / candidates.length : 0;
      return createMeasuredFinding(this.id, this.category, 'Rounded-everything syndrome', 'Large corner radii recur across an unusually high share of visible UI surfaces.', {
        confidence: weightedConfidence([
          { confidence: ramp(rounded.length, 5, 18), weight: 0.45 },
          { confidence: ramp(ratio, 0.08, 0.45), weight: 0.55 },
        ]),
        maximumPoints: 8,
        minimumConfidence: 0.35,
        evidence: [`${rounded.length} of ${candidates.length} probable UI surfaces use ≥16px radius`, `${Math.round(ratio * 100)}% rounded-surface ratio`],
      });
    },
  },
  {
    id: 'pill-infestation',
    category: 'template',
    analyze(context) {
      const pills = context.elements.filter(isPill);
      return createMeasuredFinding(this.id, this.category, 'Pill population exceeds carrying capacity', 'The page contains an unusually large colony of capsule-shaped elements.', {
        confidence: ramp(pills.length, 5, 16),
        maximumPoints: 6,
        minimumConfidence: 0.3,
        evidence: [`${pills.length} pill-shaped elements measured`],
      });
    },
  },
  {
    id: 'glassmorphism',
    category: 'layout',
    analyze(context) {
      const glass = context.elements.filter((element) =>
        element.borderRadius >= 12 &&
        (/blur/i.test(element.backdropFilter) || element.classes.some((name) => /backdrop-blur/i.test(name))) &&
        (translucent(element.backgroundColor) || element.opacity < 0.96),
      );
      return createMeasuredFinding(this.id, this.category, 'Repeated frosted-glass surfaces', 'Multiple translucent, blurred, rounded panels create a glassmorphism stack.', {
        confidence: ramp(glass.length, 1, 5),
        maximumPoints: 10,
        minimumConfidence: 0.35,
        evidence: [`${glass.length} glass-like surfaces detected`],
      });
    },
  },
  {
    id: 'bento-grid',
    category: 'layout',
    analyze(context) {
      const grids = context.elements.filter((element) => element.display === 'grid' && element.rect.width > 650 && element.rect.height > 250);
      let best: { confidence: number; children: ElementSnapshot[]; grid: ElementSnapshot; variation: number } | undefined;
      for (const grid of grids) {
        const children = context.elements.filter((element) =>
          element.rect.x >= grid.rect.x && element.rect.y >= grid.rect.y &&
          element.rect.x + element.rect.width <= grid.rect.x + grid.rect.width + 2 &&
          element.rect.y + element.rect.height <= grid.rect.y + grid.rect.height + 2 &&
          element.borderRadius >= 12 && element !== grid,
        );
        const areas = children.map((child) => child.rect.width * child.rect.height).filter(Boolean);
        if (!areas.length) continue;
        const variation = Math.max(...areas) / Math.max(1, Math.min(...areas));
        const confidence = weightedConfidence([
          { confidence: ramp(children.length, 3, 7), weight: 0.55 },
          { confidence: ramp(variation, 1.2, 2.2), weight: 0.45 },
        ]);
        if (!best || confidence > best.confidence) best = { confidence, children, grid, variation };
      }
      return createMeasuredFinding(this.id, this.category, 'Bento geometry located', 'A prominent grid contains rounded tiles with deliberately uneven footprints.', {
        confidence: best?.confidence ?? 0,
        maximumPoints: 9,
        minimumConfidence: 0.45,
        evidence: best ? [
          `${best.children.length} rounded tiles inside a ${best.grid.rect.width}×${best.grid.rect.height}px grid`,
          `Tile areas vary by ${best.variation.toFixed(1)}×`,
        ] : [],
      });
    },
  },
  {
    id: 'indigo-violet-wash',
    category: 'template',
    analyze(context) {
      const viewportArea = context.viewport.width * context.viewport.height;
      const washes = context.elements.filter((element) => {
        if (!hasGradient(element) || !hasIndigoVioletPair(element)) return false;
        const visibleWidth = Math.min(context.viewport.width, Math.max(0, element.rect.width));
        const visibleHeight = Math.min(
          context.viewport.height,
          Math.max(0, Math.min(element.rect.y + element.rect.height, context.viewport.height) - Math.max(0, element.rect.y)),
        );
        return element.rect.y < context.viewport.height &&
          visibleWidth >= context.viewport.width * 0.6 &&
          visibleHeight >= 220 &&
          visibleWidth * visibleHeight >= viewportArea * 0.2;
      });
      if (!washes.length) return [];
      const largest = washes.sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0];
      const coverage = openingArea(largest, context.viewport) / viewportArea;
      return createMeasuredFinding(
        this.id,
        this.category,
        'The ceremonial indigo-to-violet wash',
        'A saturated blue-purple gradient occupies a substantial part of the opening viewport, a familiar generator-era color default.',
        {
          confidence: ramp(coverage, 0.18, 0.48),
          maximumPoints: 4,
          minimumConfidence: 0.3,
          evidence: [`Large gradient surface measured at ${largest.rect.width}×${largest.rect.height}px`, `${Math.round(coverage * 100)}% opening-viewport coverage`],
        },
      );
    },
  },
  {
    id: 'gradient-overload',
    category: 'layout',
    analyze(context) {
      const gradients = context.elements.filter((element) => sizeable(element) && hasGradient(element));
      const largeGradients = gradients.filter(
        (element) => element.rect.width * element.rect.height >= context.viewport.width * context.viewport.height * 0.08,
      );
      return createMeasuredFinding(
        this.id,
        this.category,
        'Gradient privileges have been revoked',
        'Gradient treatments recur across enough visible surfaces to become a design system rather than an accent.',
        {
          confidence: weightedConfidence([
            { confidence: ramp(gradients.length, 3, 12), weight: 0.65 },
            { confidence: ramp(largeGradients.length, 0, 4), weight: 0.35 },
          ]),
          maximumPoints: 4,
          minimumConfidence: 0.35,
          evidence: [`${gradients.length} sizeable gradient-treated elements detected`, `${largeGradients.length} cover at least 8% of the viewport`],
        },
      );
    },
  },
  {
    id: 'decorative-radial-blooms',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage || !isDarkCanvas(context.elements, context.viewport)) return [];
      const viewportArea = context.viewport.width * context.viewport.height;
      const radialSurfaces = context.elements
        .map((element) => {
          const value = gradientValue(element);
          const layers = value.match(/radial-gradient\(/gi)?.length ?? 0;
          const colors = colorSamples(value);
          const saturated = colors.some((color) =>
            color.alpha >= 0.06 && color.saturation >= 0.42 && color.lightness >= 0.2,
          );
          const fadesOut = /transparent/i.test(value) || colors.some((color) => color.alpha <= 0.08);
          return { element, layers, saturated, fadesOut };
        })
        .filter(({ element, layers, saturated, fadesOut }) =>
          layers > 0 &&
          saturated &&
          fadesOut &&
          !isInteractive(element) &&
          !hasStateMeaning(element) &&
          openingArea(element, context.viewport) >= viewportArea * 0.1,
        );
      const blurredBlobs = context.elements.filter((element) =>
        !element.text &&
        !isInteractive(element) &&
        !hasStateMeaning(element) &&
        element.rect.width >= 100 &&
        element.rect.height >= 100 &&
        openingArea(element, context.viewport) >= viewportArea * 0.01 &&
        maximumBlur(element.filter, 'blur') >= 30 &&
        hasSaturatedColor(element.backgroundColor, 0.42) &&
        (element.position === 'absolute' || element.position === 'fixed' || element.pointerEvents === 'none'),
      );
      const radialLayers = radialSurfaces.reduce((total, surface) => total + surface.layers, 0);
      const bloomCount = radialLayers + blurredBlobs.length;
      return createMeasuredFinding(
        this.id,
        this.category,
        'Ambient glow industrial complex',
        'Multiple saturated radial or blurred color blooms sit behind the opening content without conveying state or interaction.',
        {
          confidence: ramp(bloomCount, 1, 4),
          maximumPoints: 3,
          minimumConfidence: 0.3,
          evidence: [`${radialLayers} decorative radial-gradient layers`, `${blurredBlobs.length} large blurred color blobs`],
        },
      );
    },
  },
  {
    id: 'neon-shadow-overload',
    category: 'layout',
    analyze(context) {
      if (!context.isEntryPage || !isDarkCanvas(context.elements, context.viewport)) return [];
      const glowing = context.elements.filter((element) =>
        sizeable(element) &&
        openingArea(element, context.viewport) > 0 &&
        !isInteractive(element) &&
        !hasStateMeaning(element) &&
        hasNeonShadow(element),
      );
      const boxGlows = glowing.filter((element) => hasSaturatedColor(`${element.boxShadow} ${element.filter}`, 0.52));
      const textGlows = glowing.filter((element) => hasSaturatedColor(element.textShadow, 0.52));
      return createMeasuredFinding(
        this.id,
        this.category,
        'Neon shadows seeking a purpose',
        'Saturated glow shadows recur on static content in dark mode without communicating interaction, status, or selection.',
        {
          confidence: ramp(glowing.length, 1, 5),
          maximumPoints: 4,
          minimumConfidence: 0.35,
          evidence: [`${boxGlows.length} non-interactive elements use colored box or drop shadows`, `${textGlows.length} headings use colored text shadows`],
        },
      );
    },
  },
];
