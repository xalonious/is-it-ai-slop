import type { Detector } from '../types';
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

const CTA_PATTERN = /view projects|see (my )?work|^contact$|contact me|get in touch|let'?s talk|download (my )?(cv|resume)|hire me|explore projects/i;
const SOCIAL_PATTERN = /github|linkedin|twitter|x\.com|dribbble|behance/i;

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
          element.rect.height >= 18 &&
          element.rect.height <= 64 &&
          element.rect.width >= element.rect.height * 1.35 &&
          element.rect.y < heading.rect.y &&
          heading.rect.y - element.rect.y < 180,
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
      const controls = [
        ...context.links,
        ...context.buttons.filter((button) => button.tag === 'button'),
      ];
      const ctas = controls.filter((button) => inHero(button) && near(button, heading, 520) && CTA_PATTERN.test(button.text));
      return createMeasuredFinding(this.id, this.category, 'The ceremonial two-button hero', 'Multiple familiar portfolio calls-to-action occupy the hero area.', {
        confidence: ramp(ctas.length, 1, 2.5),
        maximumPoints: 4,
        minimumConfidence: 0.45,
        evidence: uniqueTexts(ctas, 4),
      });
    },
  },
  {
    id: 'split-hero',
    category: 'layout',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading || heading.rect.x > context.viewport.width * 0.48) return [];
      const rightVisual = context.images.find(
        (image) => inHero(image) && image.rect.x > context.viewport.width * 0.5 && image.rect.width > 220 && image.rect.height > 220,
      );
      return createMeasuredFinding(this.id, this.category, 'Split-screen hero formation', 'Large introductory copy is paired with a substantial visual on the right.', {
        confidence: rightVisual ? weightedConfidence([
          { confidence: inverseRamp(heading.rect.x / context.viewport.width, 0.2, 0.48), weight: 0.35 },
          { confidence: ramp(Math.min(rightVisual.rect.width, rightVisual.rect.height), 180, 260), weight: 0.65 },
        ]) : 0,
        maximumPoints: 3,
        minimumConfidence: 0.45,
        evidence: rightVisual ? [`Heading begins at x=${heading.rect.x}px`, `Right-side visual is ${rightVisual.rect.width}×${rightVisual.rect.height}px`] : [],
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
      const gradientText = context.elements.filter((element) =>
        element.text.length > 0 &&
        element.rect.y < 900 &&
        /gradient/i.test(`${element.backgroundImage} ${element.classes.join(' ')}`) &&
        context.headings.some((heading) =>
          heading.rect.y < 900 &&
          heading.text.includes(element.text) &&
          element.rect.x >= heading.rect.x - 2 &&
          element.rect.y >= heading.rect.y - 2 &&
          element.rect.x + element.rect.width <= heading.rect.x + heading.rect.width + 2 &&
          element.rect.y + element.rect.height <= heading.rect.y + heading.rect.height + 2,
        ),
      );
      const gradients = [...context.headings.filter((heading) =>
        /gradient/i.test(`${heading.backgroundImage} ${heading.classes.join(' ')}`),
      ), ...gradientText];
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
