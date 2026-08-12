import type { Detector } from '../types';
import { contentDetectors } from './contentDetectors';
import { heroDetectors } from './heroDetectors';
import { projectDetectors } from './projectDetectors';
import { stackDetectors } from './stackDetectors';
import { visualDetectors } from './visualDetectors';

export const detectors: Detector[] = [
  ...heroDetectors,
  ...visualDetectors,
  ...contentDetectors,
  ...stackDetectors,
  ...projectDetectors,
];
