/**
 * Nightly calibration gate (DESIGN.md §13 `calibration.yml`): re-measures the active model on the labelled
 * set and fails when sensitive recall drops below 100%, merge precision at the configured threshold drops
 * below 0.93, or false flags rise by more than 5 points. The reference implementation is
 * research/embedding-calibration.
 */
import { NotImplementedError } from '../src/lib/errors';

export async function runCalibration(): Promise<never> {
  throw new NotImplementedError('calibration gate (port research/embedding-calibration onto TransformersEmbedder)', '§13');
}
