import type { Finding, SlopCategory } from './types';
import { clamp01, createMeasuredFinding } from './detectors/helpers';

const CATEGORY_CAPS: Record<SlopCategory, number> = {
  layout: 32,
  copy: 20,
  stack: 12,
  animation: 12,
  template: 40,
};

type EvidenceFamily =
  | 'hero-composition'
  | 'surface-system'
  | 'layout-geometry'
  | 'visual-atmosphere'
  | 'motion-language'
  | 'code-interface'
  | 'copy-patterns'
  | 'navigation-patterns'
  | 'project-presentation'
  | 'stack-presentation'
  | 'implementation-residue';

const EVIDENCE_FAMILY: Record<string, EvidenceFamily> = {
  'hero-pill': 'hero-composition',
  'paired-hero-ctas': 'hero-composition',
  'split-hero': 'hero-composition',
  'giant-greeting': 'hero-composition',
  'gradient-heading': 'hero-composition',
  'hero-social-cluster': 'hero-composition',
  'editorial-statement-hero': 'hero-composition',
  'rounded-everything': 'surface-system',
  'pill-infestation': 'surface-system',
  glassmorphism: 'surface-system',
  'hard-edge-brutalism': 'surface-system',
  'bento-grid': 'layout-geometry',
  'technical-grid-background': 'layout-geometry',
  'indigo-violet-wash': 'visual-atmosphere',
  'gradient-overload': 'visual-atmosphere',
  'decorative-radial-blooms': 'visual-atmosphere',
  'neon-shadow-overload': 'visual-atmosphere',
  'decorative-particle-field': 'visual-atmosphere',
  'fade-up-monoculture': 'motion-language',
  'motion-library': 'motion-language',
  'credential-marquee': 'motion-language',
  'dot-ring-cursor': 'motion-language',
  'monospace-command-ui': 'code-interface',
  'portfolio-telemetry-cosplay': 'code-interface',
  'faux-terminal': 'code-interface',
  'developer-profile-object': 'code-interface',
  'cyber-neon-hero': 'code-interface',
  'copy-cliches': 'copy-patterns',
  'generic-section-sequence': 'copy-patterns',
  'navbar-cliche': 'navigation-patterns',
  'numbered-micro-nav': 'navigation-patterns',
  'lucide-saturation': 'navigation-patterns',
  'project-card-matrix': 'project-presentation',
  'excessive-project-badges': 'project-presentation',
  'tech-stack-soup': 'stack-presentation',
  'framework-metadata-residue': 'implementation-residue',
  'metadata-neglect': 'implementation-residue',
};

const DEFAULT_FAMILY: Record<SlopCategory, EvidenceFamily> = {
  layout: 'layout-geometry',
  copy: 'copy-patterns',
  stack: 'stack-presentation',
  animation: 'motion-language',
  template: 'implementation-residue',
};

const familyFor = (finding: Finding): EvidenceFamily =>
  EVIDENCE_FAMILY[finding.detectorId] ?? DEFAULT_FAMILY[finding.category];

const applyFamilyDiminishingReturns = (findings: Finding[]): Finding[] => {
  const grouped = new Map<EvidenceFamily, Finding[]>();
  const contextOnly = findings.filter((finding) => finding.points <= 0);
  for (const finding of findings.filter((candidate) => candidate.points > 0)) {
    const family = familyFor(finding);
    grouped.set(family, [...(grouped.get(family) ?? []), finding]);
  }

  const weights = [1, 0.55, 0.25, 0.1];
  const scored = [...grouped.values()].flatMap((members) =>
    members
      .sort((left, right) => right.points - left.points)
      .map((finding, index) => ({
        ...finding,
        points: Math.max(1, Math.round(finding.points * (weights[index] ?? weights[weights.length - 1]))),
      })),
  );
  return [...scored, ...contextOnly];
};

const familyTotals = (findings: Finding[]): Map<EvidenceFamily, number> => {
  const totals = new Map<EvidenceFamily, number>();
  for (const finding of findings) {
    const family = familyFor(finding);
    totals.set(family, (totals.get(family) ?? 0) + finding.points);
  }
  return totals;
};

const activeFamilyCount = (findings: Finding[]): number =>
  [...familyTotals(findings).values()].filter((points) => points >= 2).length;

const calculateBreadthBonus = (families: number): number => {
  if (families < 3) return 0;
  return Math.min(12, 3 + (families - 3) * 3);
};

const scoreCeiling = (families: number): number => {
  if (families <= 0) return 0;
  if (families === 1) return 35;
  if (families === 2) return 55;
  if (families === 3) return 75;
  if (families === 4) return 90;
  return 100;
};

export const SEVERITY_BANDS = [
  { minimum: 80, label: 'Weapons-Grade Slop' },
  { minimum: 60, label: 'High Slop Concentration' },
  { minimum: 40, label: 'Moderate Slop' },
  { minimum: 20, label: 'Minor Slop Residue' },
  { minimum: 0, label: 'Suspiciously Original' },
] as const;

const DETECTOR_MAX_POINTS: Record<string, number> = {
  'hero-pill': 4,
  'paired-hero-ctas': 4,
  'split-hero': 3,
  'giant-greeting': 1,
  'gradient-heading': 6,
  'hero-social-cluster': 1,
  'rounded-everything': 8,
  'pill-infestation': 6,
  glassmorphism: 10,
  'bento-grid': 9,
  'lucide-saturation': 1,
  'fade-up-monoculture': 8,
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
  'developer-profile-object': 5,
  'cyber-neon-hero': 5,
  'decorative-particle-field': 3,
};

const comboFindings = (findings: Finding[]): Finding[] => {
  const ids = new Set(findings.map((finding) => finding.detectorId));
  const combos: Finding[] = [];
  const strength = (id: string): number => {
    const finding = findings.find((candidate) => candidate.detectorId === id);
    return finding
      ? clamp01(finding.points / (DETECTOR_MAX_POINTS[id] ?? Math.max(1, finding.points)))
      : 0;
  };
  const confidence = (members: string[], fullEvidenceCount: number): number =>
    clamp01(members.reduce((total, id) => total + strength(id), 0) / fullEvidenceCount);
  const matches = (members: string[], minimumStrength = 0.3): string[] =>
    members.filter((id) => strength(id) >= minimumStrength);

  const heroIds = ['hero-pill', 'paired-hero-ctas', 'split-hero', 'giant-greeting', 'gradient-heading', 'hero-social-cluster'];
  const heroMatches = matches(heroIds);
  const primaryHeroMatches = matches(['paired-hero-ctas', 'split-hero', 'giant-greeting', 'gradient-heading']);
  if (heroMatches.length >= 3 && primaryHeroMatches.length >= 1) {
    combos.push(...createMeasuredFinding('combo-classic-hero', 'template', 'Classic vibe-coded hero constellation', 'Several individually ordinary hero choices align into a suspiciously familiar full composition.', {
      confidence: confidence(heroIds, 4), maximumPoints: 14, minimumConfidence: 0.5, evidence: heroMatches,
    }));
  }

  const visualIds = ['rounded-everything', 'pill-infestation', 'glassmorphism', 'bento-grid', 'lucide-saturation', 'fade-up-monoculture', 'indigo-violet-wash', 'decorative-radial-blooms', 'neon-shadow-overload'];
  const visualMatches = matches(visualIds);
  const primaryVisualMatches = matches(['rounded-everything', 'glassmorphism', 'bento-grid']);
  if (visualMatches.length >= 4 && primaryVisualMatches.length >= 2) {
    combos.push(...createMeasuredFinding('combo-component-defaults', 'template', 'Component-default convergence', 'Rounded surfaces, fashionable effects, icons, and motion recur as one recognizable design-system cluster.', {
      confidence: confidence(visualIds, 4), maximumPoints: 15, minimumConfidence: 0.5, evidence: visualMatches,
    }));
  }

  const commandCenterIds = ['hard-edge-brutalism', 'monospace-command-ui', 'portfolio-telemetry-cosplay'];
  const commandCenterMatches = commandCenterIds.filter((id) => ids.has(id));
  if (commandCenterMatches.length === commandCenterIds.length) {
    combos.push(...createMeasuredFinding('combo-developer-control-panel', 'template', 'Neo-brutalist developer command center', 'Hard-edged component geometry, command-line typography, and decorative telemetry converge on a recognizable generator-era portfolio composition.', {
      confidence: confidence(commandCenterIds, 3), maximumPoints: 8, minimumConfidence: 0.4, evidence: commandCenterMatches,
    }));
  }

  const portfolioIds = ['copy-cliches', 'generic-section-sequence', 'navbar-cliche'];
  if (portfolioIds.every((id) => ids.has(id))) {
    combos.push(...createMeasuredFinding('combo-portfolio-template', 'copy', 'Portfolio template energy spike', 'Copy, navigation, and section ordering all follow the same familiar portfolio script.', {
      confidence: confidence(portfolioIds, 3), maximumPoints: 8, minimumConfidence: 0.4,
      evidence: ['copy clichés', 'canonical navigation', 'canonical section order'],
    }));
  }

  const projectMatrixCompanions = ['bento-grid', 'copy-cliches', 'excessive-project-badges', 'fade-up-monoculture', 'gradient-heading', 'paired-hero-ctas'];
  const projectMatrixMatches = matches(projectMatrixCompanions);
  const hasProjectStructure = strength('bento-grid') >= 0.3 || strength('excessive-project-badges') >= 0.3;
  if (strength('project-card-matrix') >= 0.3 && hasProjectStructure && projectMatrixMatches.length >= 2) {
    combos.push(...createMeasuredFinding('combo-project-matrix', 'template', 'Portfolio-card template convergence', 'A uniform project matrix appears alongside multiple familiar generator-era presentation patterns.', {
      confidence: clamp01((strength('project-card-matrix') + confidence(projectMatrixCompanions, 2)) / 2),
      maximumPoints: 4, minimumConfidence: 0.45, evidence: ['project-card-matrix', ...projectMatrixMatches],
    }));
  }

  const editorialIds = ['credential-marquee', 'dot-ring-cursor', 'editorial-statement-hero', 'numbered-micro-nav', 'fade-up-monoculture'];
  const editorialMatches = matches(editorialIds);
  if (editorialMatches.length >= 4 && ids.has('credential-marquee') && ids.has('dot-ring-cursor')) {
    combos.push(...createMeasuredFinding('combo-editorial-portfolio', 'template', 'Editorial portfolio starter pack', 'An oversized statement hero, indexed micro-navigation, looping credentials, custom cursor, and reveal motion converge on a familiar generator-era portfolio composition.', {
      confidence: confidence(editorialIds, 4), maximumPoints: 8, minimumConfidence: 0.45, evidence: editorialMatches,
    }));
  }

  const gridBackdropCompanions = ['fade-up-monoculture', 'glassmorphism', 'hero-pill', 'lucide-saturation', 'pill-infestation', 'tech-stack-soup'];
  const gridBackdropMatches = matches(gridBackdropCompanions);
  if (strength('technical-grid-background') >= 0.5 && gridBackdropMatches.length >= 3) {
    combos.push(...createMeasuredFinding('combo-technical-canvas', 'template', 'Technical-canvas template convergence', 'A graph-paper backdrop appears alongside several familiar component-library and motion defaults.', {
      confidence: clamp01((strength('technical-grid-background') + confidence(gridBackdropCompanions, 3)) / 2),
      maximumPoints: 6, minimumConfidence: 0.45, evidence: ['technical-grid-background', ...gridBackdropMatches],
    }));
  }

  const cyberIds = ['faux-terminal', 'developer-profile-object', 'cyber-neon-hero', 'decorative-particle-field', 'paired-hero-ctas', 'fade-up-monoculture'];
  const cyberMatches = matches(cyberIds);
  const hasCodeInterface = ids.has('faux-terminal') || ids.has('developer-profile-object');
  if (cyberMatches.length >= 4 && hasCodeInterface && ids.has('cyber-neon-hero')) {
    combos.push(...createMeasuredFinding('combo-developer-command-center', 'template', 'Developer command-center convergence', 'Terminal cosplay, neon presentation, decorative atmosphere, and familiar hero behavior combine into a recognizable cyber-portfolio template.', {
      confidence: confidence(cyberIds, 4), maximumPoints: 10, minimumConfidence: 0.45, evidence: cyberMatches,
    }));
  }
  return combos;
};

const capCombinationPoints = (combinations: Finding[], basePoints: number): Finding[] => {
  const requested = combinations.reduce((total, finding) => total + finding.points, 0);
  const cap = Math.min(requested, Math.max(0, Math.ceil(basePoints * 0.2)));
  if (requested <= cap) return combinations;
  if (!cap) return [];

  const apportioned = combinations.map((finding) => {
    const exact = finding.points * cap / requested;
    return { finding, points: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remaining = cap - apportioned.reduce((total, item) => total + item.points, 0);
  for (const item of [...apportioned].sort((left, right) => right.remainder - left.remainder || right.finding.points - left.finding.points)) {
    if (remaining <= 0) break;
    item.points += 1;
    remaining -= 1;
  }
  return apportioned
    .filter((item) => item.points > 0)
    .map(({ finding, points }) => ({ ...finding, points }));
};

export interface ScoreResult {
  score: number;
  severity: string;
  categories: Record<SlopCategory, number>;
  findings: Finding[];
}

export const calculateScore = (baseFindings: Finding[]): ScoreResult => {
  const scoredBaseFindings = applyFamilyDiminishingReturns(baseFindings);
  const basePoints = scoredBaseFindings.reduce((total, finding) => total + finding.points, 0);
  const combinations = capCombinationPoints(comboFindings(baseFindings), basePoints);
  const findings = [...scoredBaseFindings, ...combinations].sort((a, b) => b.points - a.points);
  const raw = Object.fromEntries(Object.keys(CATEGORY_CAPS).map((category) => [category, 0])) as Record<SlopCategory, number>;
  for (const finding of findings) raw[finding.category] += Math.max(0, finding.points);

  const categories = Object.fromEntries(
    (Object.keys(CATEGORY_CAPS) as SlopCategory[]).map((category) => [
      category,
      Math.min(100, Math.round((raw[category] / CATEGORY_CAPS[category]) * 100)),
    ]),
  ) as Record<SlopCategory, number>;

  const detectorAndComboPoints = findings.reduce(
    (total, finding) => total + Math.max(0, finding.points),
    0,
  );
  const families = activeFamilyCount(scoredBaseFindings);
  const breadthBonus = calculateBreadthBonus(families);
  const score = Math.max(0, Math.min(100, scoreCeiling(families), detectorAndComboPoints + breadthBonus));
  const severity = SEVERITY_BANDS.find((band) => score >= band.minimum)?.label ?? 'Suspiciously Original';

  return { score, severity, categories, findings };
};
