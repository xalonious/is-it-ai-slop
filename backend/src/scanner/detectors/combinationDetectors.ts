import type { Finding, SlopCategory } from '../types';
import { clamp01, createMeasuredFinding } from './helpers';
import { evaluateConstellation, type ConstellationSpec } from './constellations';

const DETECTOR_MAX_POINTS: Record<string, number> = {
  'hero-pill': 4,
  'paired-hero-ctas': 4,
  'split-hero': 3,
  'giant-greeting': 1,
  'gradient-heading': 6,
  'hero-social-cluster': 1,
  'circular-profile-hero': 3,
  'rounded-everything': 8,
  'pill-infestation': 6,
  glassmorphism: 10,
  'bento-grid': 9,
  'lucide-saturation': 1,
  'fade-up-monoculture': 8,
  'typewriter-role-carousel': 4,
  'indigo-violet-wash': 4,
  'decorative-radial-blooms': 3,
  'neon-shadow-overload': 4,
  'hard-edge-brutalism': 7,
  'monospace-command-ui': 4,
  'portfolio-telemetry-cosplay': 4,
  'copy-cliches': 11,
  'generic-section-sequence': 2,
  'navbar-cliche': 2,
  'project-card-matrix': 3,
  'excessive-project-badges': 4,
  'credential-marquee': 3,
  'dot-ring-cursor': 4,
  'editorial-statement-hero': 2,
  'numbered-micro-nav': 2,
  'technical-grid-background': 3,
  'tech-stack-soup': 2,
  'faux-terminal': 9,
  'faux-code-editor': 6,
  'developer-profile-object': 5,
  'cyber-neon-hero': 5,
  'decorative-particle-field': 3,
  'matrix-code-rain': 3,
  'hero-canvas-atmosphere': 2,
};

interface CombinationDefinition {
  detectorId: string;
  category: SlopCategory;
  title: string;
  description: string;
  maximumPoints: number;
  spec: ConstellationSpec;
}

const DEFINITIONS: CombinationDefinition[] = [
  {
    detectorId: 'combo-classic-hero',
    category: 'template',
    title: 'Classic vibe-coded hero constellation',
    description: 'Several individually ordinary hero choices align into a suspiciously familiar full composition.',
    maximumPoints: 14,
    spec: {
      anchors: ['paired-hero-ctas', 'split-hero', 'giant-greeting', 'gradient-heading', 'circular-profile-hero', 'typewriter-role-carousel'],
      minimumGroups: 3,
      groups: [
        { id: 'opening cue', alternatives: ['hero-pill', 'giant-greeting', 'editorial-statement-hero'] },
        { id: 'hero geometry', alternatives: ['split-hero', 'circular-profile-hero'] },
        { id: 'conversion row', alternatives: ['paired-hero-ctas', 'hero-social-cluster'] },
        { id: 'headline emphasis', alternatives: ['gradient-heading', 'typewriter-role-carousel'] },
      ],
    },
  },
  {
    detectorId: 'combo-component-defaults',
    category: 'template',
    title: 'Component-default convergence',
    description: 'Rounded surfaces, fashionable effects, icons, and motion recur as one recognizable design-system cluster.',
    maximumPoints: 15,
    spec: {
      anchors: ['rounded-everything', 'glassmorphism', 'bento-grid'],
      minimumGroups: 3,
      groups: [
        { id: 'surface language', alternatives: ['rounded-everything', 'pill-infestation', 'glassmorphism'] },
        { id: 'card geometry', alternatives: ['bento-grid'] },
        { id: 'icon system', alternatives: ['lucide-saturation'] },
        { id: 'reveal motion', alternatives: ['fade-up-monoculture'] },
        { id: 'fashion palette', alternatives: ['indigo-violet-wash', 'decorative-radial-blooms', 'neon-shadow-overload', 'gradient-heading'] },
      ],
    },
  },
  {
    detectorId: 'combo-developer-control-panel',
    category: 'template',
    title: 'Neo-brutalist developer command center',
    description: 'Hard-edged component geometry, command-line typography, and decorative telemetry converge on a recognizable generator-era portfolio composition.',
    maximumPoints: 8,
    spec: {
      anchors: ['monospace-command-ui', 'portfolio-telemetry-cosplay'],
      minimumGroups: 2,
      groups: [
        { id: 'hard-edged geometry', alternatives: ['hard-edge-brutalism'] },
        { id: 'command typography', alternatives: ['monospace-command-ui'] },
        { id: 'decorative telemetry', alternatives: ['portfolio-telemetry-cosplay'] },
      ],
    },
  },
  {
    detectorId: 'combo-portfolio-template',
    category: 'copy',
    title: 'Portfolio template energy spike',
    description: 'Copy, navigation, and section ordering follow the same familiar portfolio script.',
    maximumPoints: 8,
    spec: {
      anchors: ['copy-cliches', 'generic-section-sequence', 'navbar-cliche'],
      minimumGroups: 2,
      groups: [
        { id: 'copy script', alternatives: ['copy-cliches'] },
        { id: 'canonical navigation', alternatives: ['navbar-cliche'] },
        { id: 'canonical section order', alternatives: ['generic-section-sequence'] },
      ],
    },
  },
  {
    detectorId: 'combo-project-matrix',
    category: 'template',
    title: 'Portfolio-card template convergence',
    description: 'A uniform project matrix appears alongside multiple familiar generator-era presentation patterns.',
    maximumPoints: 4,
    spec: {
      anchors: ['project-card-matrix'],
      minimumGroups: 2,
      groups: [
        { id: 'uniform project matrix', alternatives: ['project-card-matrix'] },
        { id: 'card structure', alternatives: ['bento-grid', 'excessive-project-badges'] },
        { id: 'copy script', alternatives: ['copy-cliches'] },
        { id: 'reveal motion', alternatives: ['fade-up-monoculture'] },
        { id: 'familiar hero', alternatives: ['gradient-heading', 'paired-hero-ctas'] },
      ],
    },
  },
  {
    detectorId: 'combo-editorial-portfolio',
    category: 'template',
    title: 'Editorial portfolio starter pack',
    description: 'An oversized statement hero, indexed navigation, looping credentials, custom interaction, and reveal motion converge on a familiar generator-era composition.',
    maximumPoints: 8,
    spec: {
      anchors: ['editorial-statement-hero', 'numbered-micro-nav', 'credential-marquee'],
      minimumGroups: 3,
      groups: [
        { id: 'statement hero', alternatives: ['editorial-statement-hero'] },
        { id: 'indexed navigation', alternatives: ['numbered-micro-nav'] },
        { id: 'continuous motion', alternatives: ['credential-marquee', 'fade-up-monoculture'] },
        { id: 'custom interaction', alternatives: ['dot-ring-cursor'] },
      ],
    },
  },
  {
    detectorId: 'combo-technical-canvas',
    category: 'template',
    title: 'Technical-canvas template convergence',
    description: 'A technical backdrop appears alongside familiar component-library, utility, and motion defaults.',
    maximumPoints: 6,
    spec: {
      anchors: ['technical-grid-background', 'matrix-code-rain', 'hero-canvas-atmosphere'],
      minimumGroups: 3,
      groups: [
        { id: 'technical backdrop', alternatives: ['technical-grid-background', 'matrix-code-rain', 'hero-canvas-atmosphere'] },
        { id: 'ambient motion', alternatives: ['fade-up-monoculture', 'typewriter-role-carousel'] },
        { id: 'component surfaces', alternatives: ['glassmorphism', 'pill-infestation', 'bento-grid'] },
        { id: 'utility decoration', alternatives: ['lucide-saturation', 'tech-stack-soup'] },
        { id: 'status badge', alternatives: ['hero-pill'] },
      ],
    },
  },
  {
    detectorId: 'combo-developer-command-center',
    category: 'template',
    title: 'Developer command-center convergence',
    description: 'Code-interface cosplay, neon presentation, decorative atmosphere, and familiar hero behavior combine into a recognizable cyber-portfolio template.',
    maximumPoints: 10,
    spec: {
      anchors: ['faux-terminal', 'faux-code-editor', 'developer-profile-object', 'cyber-neon-hero'],
      minimumGroups: 3,
      groups: [
        { id: 'code interface', alternatives: ['faux-terminal', 'faux-code-editor', 'developer-profile-object'] },
        { id: 'cyber styling', alternatives: ['cyber-neon-hero', 'monospace-command-ui'] },
        { id: 'atmosphere', alternatives: ['decorative-particle-field', 'matrix-code-rain', 'technical-grid-background'] },
        { id: 'conversion UI', alternatives: ['paired-hero-ctas', 'hero-pill'] },
        { id: 'scripted motion', alternatives: ['fade-up-monoculture', 'typewriter-role-carousel'] },
      ],
    },
  },
];

export const detectCombinations = (findings: Finding[]): Finding[] => {
  const signals = findings.map((finding) => ({
    id: finding.detectorId,
    confidence: clamp01(finding.points / (DETECTOR_MAX_POINTS[finding.detectorId] ?? Math.max(1, finding.points))),
    evidence: finding.title,
  }));
  const hasSpatialCyberComposition = findings.some((finding) =>
    finding.detectorId === 'developer-identity-console-hero' || finding.detectorId === 'cyber-code-editor-hero');

  return DEFINITIONS.flatMap((definition) => {
    if (definition.detectorId === 'combo-developer-command-center' && hasSpatialCyberComposition) return [];
    const match = evaluateConstellation(signals, definition.spec);
    return createMeasuredFinding(
      definition.detectorId,
      definition.category,
      definition.title,
      definition.description,
      {
        confidence: match.confidence,
        maximumPoints: definition.maximumPoints,
        minimumConfidence: 0.35,
        evidence: match.evidence,
      },
    );
  });
};
