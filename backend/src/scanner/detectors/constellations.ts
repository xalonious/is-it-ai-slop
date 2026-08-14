import { clamp01, ramp, weightedConfidence } from './helpers';

export interface ConstellationSignal {
  id: string;
  confidence: number;
  evidence?: string;
}

export interface ConstellationGroup {
  id: string;
  alternatives: string[];
  weight?: number;
}

export interface ConstellationSpec {
  anchors: string[];
  groups: ConstellationGroup[];
  minimumGroups: number;
  minimumSignalConfidence?: number;
  minimumAnchorConfidence?: number;
}

export interface ConstellationMatch {
  confidence: number;
  anchor?: ConstellationSignal;
  activeGroups: number;
  evidence: string[];
}

export const evaluateConstellation = (
  signals: ConstellationSignal[],
  spec: ConstellationSpec,
): ConstellationMatch => {
  const byId = new Map<string, ConstellationSignal>();
  for (const signal of signals) {
    const normalized = { ...signal, confidence: clamp01(signal.confidence) };
    const existing = byId.get(signal.id);
    if (!existing || normalized.confidence > existing.confidence) byId.set(signal.id, normalized);
  }

  const anchor = spec.anchors
    .map((id) => byId.get(id))
    .filter((signal): signal is ConstellationSignal => Boolean(signal))
    .sort((left, right) => right.confidence - left.confidence)[0];
  const minimumSignalConfidence = spec.minimumSignalConfidence ?? 0.3;
  const minimumAnchorConfidence = spec.minimumAnchorConfidence ?? 0.35;

  const groupMatches = spec.groups.map((group) => {
    const signal = group.alternatives
      .map((id) => byId.get(id))
      .filter((candidate): candidate is ConstellationSignal => Boolean(candidate))
      .sort((left, right) => right.confidence - left.confidence)[0];
    return { group, signal, confidence: signal?.confidence ?? 0 };
  });
  const activeGroups = groupMatches.filter((match) => match.confidence >= minimumSignalConfidence).length;
  if (!anchor || anchor.confidence < minimumAnchorConfidence || activeGroups < spec.minimumGroups) {
    return { confidence: 0, anchor, activeGroups, evidence: [] };
  }

  const totalWeight = groupMatches.reduce((total, match) => total + Math.max(0, match.group.weight ?? 1), 0);
  const coverage = totalWeight
    ? groupMatches.reduce(
      (total, match) => total + match.confidence * Math.max(0, match.group.weight ?? 1),
      0,
    ) / totalWeight
    : 0;
  const fullBreadthAt = Math.min(spec.groups.length, spec.minimumGroups + 2);
  const breadth = ramp(activeGroups, spec.minimumGroups - 1, fullBreadthAt);
  const confidence = weightedConfidence([
    { confidence: anchor.confidence, weight: 0.35 },
    { confidence: coverage, weight: 0.45 },
    { confidence: breadth, weight: 0.2 },
  ]);
  const evidence = groupMatches
    .filter((match) => match.confidence >= minimumSignalConfidence && match.signal)
    .sort((left, right) => right.confidence - left.confidence)
    .map((match) => `${match.group.id}: ${match.signal?.evidence ?? match.signal?.id}`);

  return { confidence, anchor, activeGroups, evidence };
};
