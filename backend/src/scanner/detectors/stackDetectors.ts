import type { Detector } from '../types';
import { createFinding, normalizedText } from './helpers';

const TECHNOLOGIES = [
  'javascript', 'typescript', 'react', 'next.js', 'nextjs', 'vue', 'angular', 'svelte',
  'node.js', 'nodejs', 'express', 'nestjs', 'tailwind', 'bootstrap', 'sass', 'graphql',
  'postgresql', 'mongodb', 'mysql', 'redis', 'docker', 'kubernetes', 'aws', 'azure', 'gcp',
  'firebase', 'supabase', 'prisma', 'figma', 'git', 'github', 'python', 'java', 'c#', 'go',
  'rust', 'php', 'laravel', 'django', 'flask', 'react native', 'flutter', 'vercel', 'netlify',
] as const;

export const stackDetectors: Detector[] = [
  {
    id: 'tech-stack-soup',
    category: 'stack',
    analyze(context) {
      const text = normalizedText(context.visibleText);
      const matches = [...new Set(TECHNOLOGIES.filter((technology) => text.includes(normalizedText(technology))))];
      const projectHeadings = context.headings.filter((heading) => /project|work/i.test(heading.text)).length;
      if (matches.length < 15) return [];
      return [createFinding(this.id, this.category, 'Technology pantry inventory', 'The named-tool inventory is unusually long relative to the portfolio evidence around it.', 2, [`${matches.length} named technologies`, `${projectHeadings || 'No'} project/work section heading${projectHeadings === 1 ? '' : 's'}`, matches.slice(0, 12).join(', ')])];
    },
  },
  {
    id: 'lucide-saturation',
    category: 'stack',
    analyze(context) {
      if (!context.technologies.lucide) return [];
      const iconCount = context.images.filter((image) => image.tag === 'svg' && image.rect.width <= 40 && image.rect.height <= 40).length;
      return iconCount >= 12
        ? [createFinding(this.id, this.category, 'Lucide is doing overtime', 'A Lucide fingerprint appears alongside a large number of small SVG icons.', 1, [`${iconCount} small SVG icons`, 'Lucide/resource fingerprint present'])]
        : [];
    },
  },
  {
    id: 'motion-library',
    category: 'animation',
    analyze(context) {
      return context.technologies.framerMotion
        ? [createFinding(this.id, this.category, 'Motion library fingerprint', 'Framer Motion or Motion DOM appears in page resources. This is context, not a verdict.', 0, ['Motion resource or data attribute detected'])]
        : [];
    },
  },
  {
    id: 'fade-up-monoculture',
    category: 'animation',
    analyze(context) {
      const fadeUps = context.animations.filter((animation) => {
        const opacities = animation.keyframes.map((frame) => frame.opacity).filter(Number.isFinite) as number[];
        const transforms = animation.keyframes.map((frame) => frame.transform ?? '').join(' ');
        return opacities.some((opacity) => opacity <= 0.1) && /translateY\([^)-]*(?:[1-9]\d*px|%)/i.test(transforms);
      });
      const cssAnimated = context.elements.filter((element) => /fade|slide|reveal|enter/i.test(`${element.animationName} ${element.classes.join(' ')}`));
      const count = fadeUps.length + cssAnimated.length;
      return count >= 7
        ? [createFinding(this.id, this.category, 'Fade-up monoculture', 'Many elements appear to enter with the same opacity-plus-vertical-translation recipe.', 8, [`${count} fade/slide/reveal animation signals`])]
        : [];
    },
  },
];
