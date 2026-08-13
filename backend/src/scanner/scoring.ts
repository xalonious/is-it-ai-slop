import type { Finding, SlopCategory } from './types';
import { createFinding } from './detectors/helpers';

const CATEGORY_CAPS: Record<SlopCategory, number> = {
  layout: 32,
  copy: 20,
  stack: 12,
  animation: 12,
  template: 40,
};

const MEANINGFUL_FINDING_POINTS = 3;

const calculateBreadthBonus = (findings: Finding[]): number => {
  const categories = new Set(
    findings
      .filter((finding) => finding.points >= MEANINGFUL_FINDING_POINTS)
      .map((finding) => finding.category),
  ).size;

  if (categories >= 5) return 12;
  if (categories === 4) return 8;
  if (categories === 3) return 4;
  return 0;
};

const calculateDensityBonus = (findings: Finding[]): number => {
  const meaningfulCount = findings.filter(
    (finding) => finding.points >= MEANINGFUL_FINDING_POINTS,
  ).length;
  return Math.min(12, Math.max(0, meaningfulCount - 3) * 3);
};

export const SEVERITY_BANDS = [
  { minimum: 80, label: 'Weapons-Grade Slop' },
  { minimum: 60, label: 'High Slop Concentration' },
  { minimum: 40, label: 'Moderate Slop' },
  { minimum: 20, label: 'Minor Slop Residue' },
  { minimum: 0, label: 'Suspiciously Original' },
] as const;

const comboFindings = (findings: Finding[]): Finding[] => {
  const ids = new Set(findings.map((finding) => finding.detectorId));
  const combos: Finding[] = [];
  const heroIds = ['hero-pill', 'paired-hero-ctas', 'split-hero', 'giant-greeting', 'gradient-heading', 'hero-social-cluster'];
  const heroMatches = heroIds.filter((id) => ids.has(id));
  if (heroMatches.length >= 4) {
    combos.push(createFinding('combo-classic-hero', 'template', 'Classic vibe-coded hero constellation', 'Several individually ordinary hero choices align into a suspiciously familiar full composition.', 14, heroMatches));
  }

  const visualIds = ['rounded-everything', 'pill-infestation', 'glassmorphism', 'bento-grid', 'lucide-saturation', 'fade-up-monoculture', 'indigo-violet-wash', 'decorative-radial-blooms', 'neon-shadow-overload'];
  const visualMatches = visualIds.filter((id) => ids.has(id));
  if (visualMatches.length >= 4) {
    combos.push(createFinding('combo-component-defaults', 'template', 'Component-default convergence', 'Rounded surfaces, fashionable effects, icons, and motion recur as one recognizable design-system cluster.', 15, visualMatches));
  }

  if (ids.has('copy-cliches') && ids.has('generic-section-sequence') && ids.has('navbar-cliche')) {
    combos.push(createFinding('combo-portfolio-template', 'copy', 'Portfolio template energy spike', 'Copy, navigation, and section ordering all follow the same familiar portfolio script.', 8, ['copy clichés', 'canonical navigation', 'canonical section order']));
  }
  const projectMatrixCompanions = ['bento-grid', 'copy-cliches', 'excessive-project-badges', 'fade-up-monoculture', 'gradient-heading', 'paired-hero-ctas'];
  const projectMatrixMatches = projectMatrixCompanions.filter((id) => ids.has(id));
  if (ids.has('project-card-matrix') && projectMatrixMatches.length >= 2) {
    combos.push(createFinding('combo-project-matrix', 'template', 'Portfolio-card template convergence', 'A uniform project matrix appears alongside multiple familiar generator-era presentation patterns.', 4, ['project-card-matrix', ...projectMatrixMatches]));
  }
  const editorialIds = ['credential-marquee', 'dot-ring-cursor', 'editorial-statement-hero', 'numbered-micro-nav', 'fade-up-monoculture'];
  const editorialMatches = editorialIds.filter((id) => ids.has(id));
  if (editorialMatches.length >= 4 && ids.has('credential-marquee') && ids.has('dot-ring-cursor')) {
    combos.push(createFinding('combo-editorial-portfolio', 'template', 'Editorial portfolio starter pack', 'An oversized statement hero, indexed micro-navigation, looping credentials, custom cursor, and reveal motion converge on a familiar generator-era portfolio composition.', 8, editorialMatches));
  }
  const gridBackdropCompanions = ['fade-up-monoculture', 'glassmorphism', 'hero-pill', 'lucide-saturation', 'pill-infestation', 'tech-stack-soup'];
  const gridBackdropMatches = gridBackdropCompanions.filter((id) => ids.has(id));
  if (ids.has('technical-grid-background') && gridBackdropMatches.length >= 3) {
    combos.push(createFinding('combo-technical-canvas', 'template', 'Technical-canvas template convergence', 'A graph-paper backdrop appears alongside several familiar component-library and motion defaults.', 6, ['technical-grid-background', ...gridBackdropMatches]));
  }
  const cyberIds = ['faux-terminal', 'developer-profile-object', 'cyber-neon-hero', 'decorative-particle-field', 'paired-hero-ctas', 'fade-up-monoculture'];
  const cyberMatches = cyberIds.filter((id) => ids.has(id));
  const hasCodeInterface = ids.has('faux-terminal') || ids.has('developer-profile-object');
  if (cyberMatches.length >= 4 && hasCodeInterface && ids.has('cyber-neon-hero')) {
    combos.push(createFinding('combo-developer-command-center', 'template', 'Developer command-center convergence', 'Terminal cosplay, neon presentation, decorative atmosphere, and familiar hero behavior combine into a recognizable cyber-portfolio template.', 10, cyberMatches));
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
