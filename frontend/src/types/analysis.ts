export type SlopCategory = 'layout' | 'copy' | 'stack' | 'animation' | 'template';

export interface Finding {
  detectorId: string;
  category: SlopCategory;
  title: string;
  description: string;
  points: number;
  evidence: string[];
}

export interface AnalysisResult {
  url: string;
  score: number;
  severity: string;
  categories: Record<SlopCategory, number>;
  findings: Finding[];
  metadata: {
    title?: string;
    scannedAt: string;
    durationMs: number;
    pagesScanned: number;
  };
}

export interface AnalysisError {
  code: string;
  message: string;
}
