import type { ConfigPlugin, XcodeProject } from 'expo/config-plugins';
import type { ModelPins, checkFolder } from './modelPins';

declare const withBundledModel: ConfigPlugin & {
  shouldBundle(o: { projectRoot: string; pins: ModelPins; appEnv: string; embedder: 'device' | 'stub'; check?: typeof checkFolder }): boolean;
  stageModel(o: { projectRoot: string; nativeRoot: string; pins: ModelPins; bundle: boolean }): void;
  addModelFolderReference(project: XcodeProject, projectName: string): XcodeProject;
  addNoCompress(buildGradle: string): string;
};
export = withBundledModel;
