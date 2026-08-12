import type { Detector, ElementSnapshot } from '../types';
import { createFinding, isPill } from './helpers';

const sizeable = (element: ElementSnapshot) => element.rect.width >= 80 && element.rect.height >= 32;
const translucent = (color: string) => /rgba\([^)]*,\s*0?\.[0-8]/i.test(color) || /color-mix/i.test(color);

export const visualDetectors: Detector[] = [
  {
    id: 'rounded-everything',
    category: 'template',
    analyze(context) {
      const candidates = context.elements.filter(sizeable);
      const rounded = candidates.filter((element) => element.borderRadius >= 16);
      const ratio = candidates.length ? rounded.length / candidates.length : 0;
      if (rounded.length < 12 || ratio < 0.28) return [];
      return [createFinding(this.id, this.category, 'Rounded-everything syndrome', 'Large corner radii recur across an unusually high share of visible UI surfaces.', 8, [`${rounded.length} of ${candidates.length} sizeable elements use ≥16px radius`, `${Math.round(ratio * 100)}% rounded-surface ratio`])];
    },
  },
  {
    id: 'pill-infestation',
    category: 'template',
    analyze(context) {
      const pills = context.elements.filter(isPill);
      if (pills.length < 10) return [];
      return [createFinding(this.id, this.category, 'Pill population exceeds carrying capacity', 'The page contains an unusually large colony of capsule-shaped elements.', 6, [`${pills.length} pill-shaped elements measured`])];
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
      return glass.length >= 3
        ? [createFinding(this.id, this.category, 'Repeated frosted-glass surfaces', 'Multiple translucent, blurred, rounded panels create a glassmorphism stack.', 10, [`${glass.length} glass-like surfaces detected`])]
        : [];
    },
  },
  {
    id: 'bento-grid',
    category: 'layout',
    analyze(context) {
      const grids = context.elements.filter((element) => element.display === 'grid' && element.rect.width > 650 && element.rect.height > 250);
      for (const grid of grids) {
        const children = context.elements.filter((element) =>
          element.rect.x >= grid.rect.x && element.rect.y >= grid.rect.y &&
          element.rect.x + element.rect.width <= grid.rect.x + grid.rect.width + 2 &&
          element.rect.y + element.rect.height <= grid.rect.y + grid.rect.height + 2 &&
          element.borderRadius >= 12 && element !== grid,
        );
        const areas = children.map((child) => child.rect.width * child.rect.height).filter(Boolean);
        if (children.length >= 4 && areas.length && Math.max(...areas) / Math.min(...areas) >= 1.7) {
          return [createFinding(this.id, this.category, 'Bento geometry located', 'A prominent grid contains rounded tiles with deliberately uneven footprints.', 9, [`${children.length} rounded tiles inside a ${grid.rect.width}×${grid.rect.height}px grid`, 'Tile areas vary by at least 1.7×'])];
        }
      }
      return [];
    },
  },
];
