import type { Detector } from '../types';
import { createFinding, inHero, isPill, mainHeading, near, normalizedText, uniqueTexts } from './helpers';

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
      const pills = context.elements.filter(
        (element) =>
          isPill(element) &&
          element.text.length > 0 &&
          element.text.length < 70 &&
          element.rect.y < heading.rect.y &&
          heading.rect.y - element.rect.y < 180,
      );
      return pills.length
        ? [createFinding(this.id, this.category, 'Pre-heading specimen pill', 'A compact rounded badge sits directly above the principal heading.', 4, uniqueTexts(pills, 3))]
        : [];
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
      return ctas.length >= 2
        ? [createFinding(this.id, this.category, 'The ceremonial two-button hero', 'Two familiar portfolio calls-to-action occupy the hero area.', 4, uniqueTexts(ctas, 4))]
        : [];
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
      return rightVisual
        ? [createFinding(this.id, this.category, 'Split-screen hero formation', 'Large introductory copy is paired with a substantial visual on the right.', 3, [`Heading begins at x=${heading.rect.x}px`, `Right-side visual is ${rightVisual.rect.width}×${rightVisual.rect.height}px`])]
        : [];
    },
  },
  {
    id: 'giant-greeting',
    category: 'copy',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const heading = mainHeading(context);
      if (!heading || heading.fontSize < 48 || !/^(hi|hey|hello)[, !]|^i'?m\b/i.test(normalizedText(heading.text))) return [];
      return [createFinding(this.id, this.category, 'Large-format personal greeting', 'The hero opens with the portfolio equivalent of “Hello, world.”', 1, [`${heading.fontSize}px heading: “${heading.text.slice(0, 100)}”`])];
    },
  },
  {
    id: 'gradient-heading',
    category: 'layout',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const gradients = context.headings.filter((heading) => heading.fontSize >= 40 && /gradient/i.test(`${heading.backgroundImage} ${heading.classes.join(' ')}`));
      return gradients.length
        ? [createFinding(this.id, this.category, 'Gradient headline detected', 'A large heading uses gradient treatment, a popular AI-era emphasis device.', 6, uniqueTexts(gradients, 3))]
        : [];
    },
  },
  {
    id: 'hero-social-cluster',
    category: 'template',
    analyze(context) {
      if (!context.isEntryPage) return [];
      const social = context.links.filter((link) => inHero(link) && SOCIAL_PATTERN.test(`${link.text} ${link.ariaLabel ?? ''} ${link.href ?? ''}`));
      return social.length >= 2
        ? [createFinding(this.id, this.category, 'Hero social orbit', 'Multiple social destinations cluster around the opening pitch.', 1, uniqueTexts(social.map((link) => ({ ...link, text: link.text || link.ariaLabel || link.href || 'social link' })), 5))]
        : [];
    },
  },
];
