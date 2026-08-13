import type { Detector } from '../types';
import { contentDetectors } from './contentDetectors';
import { cyberDetectors } from './cyberDetectors';
import { editorialDetectors } from './editorialDetectors';
import { heroDetectors } from './heroDetectors';
import { metadataDetectors } from './metadataDetectors';
import { projectDetectors } from './projectDetectors';
import { stackDetectors } from './stackDetectors';
import { visualDetectors } from './visualDetectors';

export const detectors: Detector[] = [
  ...heroDetectors,
  ...metadataDetectors,
  ...cyberDetectors,
  ...editorialDetectors,
  ...visualDetectors,
  ...contentDetectors,
  ...stackDetectors,
  ...projectDetectors,
];
