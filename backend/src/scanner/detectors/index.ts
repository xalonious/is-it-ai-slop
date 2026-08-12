import type { Detector } from '../types';
import { contentDetectors } from './contentDetectors';
import { cyberDetectors } from './cyberDetectors';
import { heroDetectors } from './heroDetectors';
import { projectDetectors } from './projectDetectors';
import { stackDetectors } from './stackDetectors';
import { visualDetectors } from './visualDetectors';

export const detectors: Detector[] = [
  ...heroDetectors,
  ...cyberDetectors,
  ...visualDetectors,
  ...contentDetectors,
  ...stackDetectors,
  ...projectDetectors,
];
