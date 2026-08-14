import type { Finding, SlopCategory } from './types';
import { detectCombinations } from './detectors/combinationDetectors';

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
  | 'implementation-residue'
  | 'composition-convergence';

const EVIDENCE_FAMILY: Record<string, EvidenceFamily> = {
  'hero-pill': 'hero-composition',
  'paired-hero-ctas': 'hero-composition',
  'split-hero': 'hero-composition',
  'giant-greeting': 'hero-composition',
  'gradient-heading': 'hero-composition',
  'hero-social-cluster': 'hero-composition',
  'circular-profile-hero': 'hero-composition',
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
  'matrix-code-rain': 'visual-atmosphere',
  'hero-canvas-atmosphere': 'visual-atmosphere',
  'fade-up-monoculture': 'motion-language',
  'motion-library': 'motion-language',
  'credential-marquee': 'motion-language',
  'dot-ring-cursor': 'motion-language',
  'typewriter-role-carousel': 'motion-language',
  'monospace-command-ui': 'code-interface',
  'portfolio-telemetry-cosplay': 'code-interface',
  'faux-terminal': 'code-interface',
  'faux-code-editor': 'code-interface',
  'developer-profile-object': 'code-interface',
  'cyber-neon-hero': 'code-interface',
  'developer-identity-console-hero': 'composition-convergence',
  'cyber-code-editor-hero': 'composition-convergence',
  'animated-profile-hero': 'composition-convergence',
  'copy-cliches': 'copy-patterns',
  'generic-section-sequence': 'copy-patterns',
  'navbar-cliche': 'navigation-patterns',
  'floating-icon-dock': 'navigation-patterns',
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
  const combinations = capCombinationPoints(detectCombinations(baseFindings), basePoints);
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
