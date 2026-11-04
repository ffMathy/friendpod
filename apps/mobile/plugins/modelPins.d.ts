export interface ModelPin {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly device: boolean;
  readonly source: 'hf' | 'mirror';
}
export interface ModelPins {
  readonly hfRepo: string;
  readonly revision: string;
  /** core's EMBEDDING_MODEL.device.dir, "models/<folder>/". */
  readonly dir: string;
  readonly folder: string;
  /** Device files only, smallest first. */
  readonly files: readonly ModelPin[];
}
export declare const PINS_FILE: string;
export declare function readPins(file?: string): ModelPins;
export declare function sourceDir(projectRoot: string, pins: ModelPins): string;
export declare function sha256File(file: string): string;
export declare function sizeOf(file: string): number | null;
export declare function matchesPin(file: string, pin: Pick<ModelPin, 'sha256' | 'bytes'>): boolean;
export declare function checkFolder(dir: string, files: readonly Pick<ModelPin, 'path' | 'sha256' | 'bytes'>[]): { missing: string[]; mismatched: string[] };
