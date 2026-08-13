export type SlopCategory = 'layout' | 'copy' | 'stack' | 'animation' | 'template';

export interface RectSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElementSnapshot {
  tag: string;
  text: string;
  ariaLabel?: string;
  href?: string;
  src?: string;
  classes: string[];
  parentIndex?: number;
  childTags: string[];
  rect: RectSnapshot;
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  whiteSpace: string;
  borderRadius: number;
  backgroundImage: string;
  backgroundSize: string;
  pseudoBackgroundImage: string;
  pseudoBackgroundSize: string;
  backgroundColor: string;
  backdropFilter: string;
  boxShadow: string;
  textShadow: string;
  filter: string;
  position: string;
  pointerEvents: string;
  contentEditable: boolean;
  opacity: number;
  display: string;
  gridColumns: string;
  animationName: string;
  transitionProperty: string;
  transform: string;
}

export interface AnimationSnapshot {
  name: string;
  target: string;
  keyframes: Array<{ opacity?: number; transform?: string }>;
}

export interface FrameworkFingerprints {
  react: boolean;
  next: boolean;
  vite: boolean;
  tailwind: boolean;
  shadcn: boolean;
  radix: boolean;
  lucide: boolean;
  framerMotion: boolean;
  vercel: boolean;
}

export interface MetadataSnapshot {
  description?: string;
  generator?: string;
  canonicalUrl?: string;
  faviconUrls: string[];
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  htmlLang?: string;
}

export interface AnalysisContext {
  requestedUrl: string;
  finalUrl: string;
  isEntryPage: boolean;
  title?: string;
  visibleText: string;
  documentMarkers: string;
  viewport: { width: number; height: number };
  elements: ElementSnapshot[];
  headings: ElementSnapshot[];
  buttons: ElementSnapshot[];
  links: ElementSnapshot[];
  images: ElementSnapshot[];
  sections: ElementSnapshot[];
  animations: AnimationSnapshot[];
  scripts: string[];
  stylesheets: string[];
  technologies: FrameworkFingerprints;
  metadata: MetadataSnapshot;
}

export interface PortfolioScan {
  requestedUrl: string;
  finalUrl: string;
  title?: string;
  pages: AnalysisContext[];
}

export interface Finding {
  detectorId: string;
  category: SlopCategory;
  title: string;
  description: string;
  points: number;
  evidence: string[];
}

export interface Detector {
  id: string;
  category: SlopCategory;
  analyze(context: AnalysisContext): Promise<Finding[]> | Finding[];
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
