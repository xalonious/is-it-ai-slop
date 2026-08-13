import type { Finding, SlopCategory } from './types';
import { clamp01, createMeasuredFinding, ramp } from './detectors/helpers';

const CATEGORY_CAPS: Record<SlopCategory, number> = {
  layout: 32,
  copy: 20,
  stack: 12,
  animation: 12,
  template: 40,
};

const calculateBreadthBonus = (findings: Finding[]): number => {
  const categoryEvidence = (Object.keys(CATEGORY_CAPS) as SlopCategory[]).reduce((total, category) => {
    const points = findings
      .filter((finding) => finding.category === category)
      .reduce((sum, finding) => sum + finding.points, 0);
    return total + ramp(points, 1, 5);
  }, 0);
  return Math.round(ramp(categoryEvidence, 2, 5) * 12);
};

const calculateDensityBonus = (findings: Finding[]): number => {
  const evidenceMass = findings.reduce((total, finding) => total + ramp(finding.points, 0, 4), 0);
  return Math.round(ramp(evidenceMass, 3, 7) * 12);
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

  const heroIds = ['hero-pill', 'paired-hero-ctas', 'split-hero', 'giant-greeting', 'gradient-heading', 'hero-social-cluster'];
  const heroMatches = heroIds.filter((id) => ids.has(id));
  combos.push(...createMeasuredFinding('combo-classic-hero', 'template', 'Classic vibe-coded hero constellation', 'Several individually ordinary hero choices align into a suspiciously familiar full composition.', {
    confidence: confidence(heroIds, 4), maximumPoints: 14, minimumConfidence: 0.5, evidence: heroMatches,
  }));

  const visualIds = ['rounded-everything', 'pill-infestation', 'glassmorphism', 'bento-grid', 'lucide-saturation', 'fade-up-monoculture', 'indigo-violet-wash', 'decorative-radial-blooms', 'neon-shadow-overload'];
  const visualMatches = visualIds.filter((id) => ids.has(id));
  combos.push(...createMeasuredFinding('combo-component-defaults', 'template', 'Component-default convergence', 'Rounded surfaces, fashionable effects, icons, and motion recur as one recognizable design-system cluster.', {
    confidence: confidence(visualIds, 4), maximumPoints: 15, minimumConfidence: 0.5, evidence: visualMatches,
  }));

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
  const projectMatrixMatches = projectMatrixCompanions.filter((id) => ids.has(id));
  if (ids.has('project-card-matrix') && projectMatrixMatches.length >= 2) {
    combos.push(...createMeasuredFinding('combo-project-matrix', 'template', 'Portfolio-card template convergence', 'A uniform project matrix appears alongside multiple familiar generator-era presentation patterns.', {
      confidence: clamp01((strength('project-card-matrix') + confidence(projectMatrixCompanions, 2)) / 2),
      maximumPoints: 4, minimumConfidence: 0.45, evidence: ['project-card-matrix', ...projectMatrixMatches],
    }));
  }

  const editorialIds = ['credential-marquee', 'dot-ring-cursor', 'editorial-statement-hero', 'numbered-micro-nav', 'fade-up-monoculture'];
  const editorialMatches = editorialIds.filter((id) => ids.has(id));
  if (editorialMatches.length >= 4 && ids.has('credential-marquee') && ids.has('dot-ring-cursor')) {
    combos.push(...createMeasuredFinding('combo-editorial-portfolio', 'template', 'Editorial portfolio starter pack', 'An oversized statement hero, indexed micro-navigation, looping credentials, custom cursor, and reveal motion converge on a familiar generator-era portfolio composition.', {
      confidence: confidence(editorialIds, 4), maximumPoints: 8, minimumConfidence: 0.45, evidence: editorialMatches,
    }));
  }

  const gridBackdropCompanions = ['fade-up-monoculture', 'glassmorphism', 'hero-pill', 'lucide-saturation', 'pill-infestation', 'tech-stack-soup'];
  const gridBackdropMatches = gridBackdropCompanions.filter((id) => ids.has(id));
  if (ids.has('technical-grid-background') && gridBackdropMatches.length >= 3) {
    combos.push(...createMeasuredFinding('combo-technical-canvas', 'template', 'Technical-canvas template convergence', 'A graph-paper backdrop appears alongside several familiar component-library and motion defaults.', {
      confidence: clamp01((strength('technical-grid-background') + confidence(gridBackdropCompanions, 3)) / 2),
      maximumPoints: 6, minimumConfidence: 0.45, evidence: ['technical-grid-background', ...gridBackdropMatches],
    }));
  }

  const cyberIds = ['faux-terminal', 'developer-profile-object', 'cyber-neon-hero', 'decorative-particle-field', 'paired-hero-ctas', 'fade-up-monoculture'];
  const cyberMatches = cyberIds.filter((id) => ids.has(id));
  const hasCodeInterface = ids.has('faux-terminal') || ids.has('developer-profile-object');
  if (cyberMatches.length >= 4 && hasCodeInterface && ids.has('cyber-neon-hero')) {
    combos.push(...createMeasuredFinding('combo-developer-command-center', 'template', 'Developer command-center convergence', 'Terminal cosplay, neon presentation, decorative atmosphere, and familiar hero behavior combine into a recognizable cyber-portfolio template.', {
      confidence: confidence(cyberIds, 4), maximumPoints: 10, minimumConfidence: 0.45, evidence: cyberMatches,
    }));
  }
  return combos;
};

export interface ScoreResult {
  score: number;
  severity: string;
  categories: Record<SlopCategory, number>;
  findings: Finding[];
}

export const calculateScore = (baseFindings: Finding[]): ScoreResult => {
  const combinations = comboFindings(baseFindings);
  const findings = [...baseFindings, ...combinations].sort((a, b) => b.points - a.points);
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
  const breadthBonus = calculateBreadthBonus(baseFindings);
  const densityBonus = calculateDensityBonus(baseFindings);
  const score = Math.max(0, Math.min(100, detectorAndComboPoints + breadthBonus + densityBonus));
  const severity = SEVERITY_BANDS.find((band) => score >= band.minimum)?.label ?? 'Suspiciously Original';

  return { score, severity, categories, findings };
};
