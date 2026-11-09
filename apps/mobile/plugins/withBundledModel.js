/**
 * Bundles the pinned on-device model (EmbeddingGemma 2 q4, D1) inside the app instead of downloading it on first use.
 * The files come from apps/mobile/assets/model/<folder>/, which `npm run fetch-model` fills and verifies (EAS runs it
 * in `eas-build-pre-install`). At prebuild they are verified again against the pins in packages/core and copied to
 * `models/<folder>/` (core's `EMBEDDING_MODEL.device.dir`) on both platforms:
 *
 * - iOS: `ios/<Project>/models/`, added to the app target as a folder reference in Copy Bundle Resources, so the files
 *   sit at `<App>.app/models/<folder>/…` and the runtime opens them in place.
 * - Android: `android/app/src/main/assets/models/`, with `.onnx` and `.onnx_data` stored uncompressed
 *   (`androidResources.noCompress`). Assets are not file paths, so the app copies them to internal storage on first
 *   launch (src/features/interests/embedder/modelFiles.ts).
 *
 * Only pinned files are copied, never whatever else sits in the folder. A missing or mismatching file fails the
 * prebuild, so a store build cannot ship without the model; a development build with EXPO_PUBLIC_EMBEDDER=stub
 * (deterministic fake vectors, refused outside APP_ENV=development) may go without it.
 */
const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withAppBuildGradle, withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const { checkFolder, readPins, sourceDir } = require('./modelPins');

const TAG = 'friendpod-bundled-model';
/** Matched as suffixes by AAPT: model_q4.onnx and model_q4.onnx_data. */
const NO_COMPRESS = ['onnx', 'onnx_data'];

/**
 * Whether the prebuild bundles the model: true when every pinned file is present and verified, false for a stub
 * development build without it; anything else throws with what to do.
 */
function shouldBundle({ projectRoot, pins, appEnv, embedder, check = checkFolder }) {
  const dir = sourceDir(projectRoot, pins);
  const { missing, mismatched } = check(dir, pins.files);
  if (missing.length === 0 && mismatched.length === 0) return true;
  if (embedder === 'stub' && appEnv === 'development') {
    console.warn(`${TAG}: EXPO_PUBLIC_EMBEDDER=stub, building without the on-device model`);
    return false;
  }
  const problems = [
    ...missing.map((p) => `  missing:  ${p}`),
    ...mismatched.map((p) => `  mismatch: ${p} (size or sha256 differs from packages/core)`),
  ].join('\n');
  throw new Error(
    `${TAG}: the on-device model is not ready in ${path.relative(projectRoot, dir)}/\n${problems}\n` +
      'Run `npm run fetch-model` in apps/mobile (EAS runs it in the eas-build-pre-install hook). ' +
      'For a development build without the model, set EXPO_PUBLIC_EMBEDDER=stub (APP_ENV=development only).',
  );
}

/** Replaces `<nativeRoot>/models/` with exactly the pinned files (or leaves it empty when not bundling). */
function stageModel({ projectRoot, nativeRoot, pins, bundle }) {
  const modelsRoot = path.join(nativeRoot, pins.dir.split('/')[0]);
  fs.rmSync(modelsRoot, { recursive: true, force: true });
  fs.mkdirSync(modelsRoot, { recursive: true });
  if (!bundle) return;
  const src = sourceDir(projectRoot, pins);
  for (const f of pins.files) {
    const dest = path.join(nativeRoot, pins.dir, f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    // A copy-on-write clone where the file system supports it, a plain copy elsewhere.
    fs.copyFileSync(path.join(src, f.path), dest, fs.constants.COPYFILE_FICLONE);
  }
}

/** Adds `<projectName>/models` to the app target as a folder reference in Copy Bundle Resources; idempotent. */
function addModelFolderReference(project, projectName) {
  const filepath = `${projectName}/models`;
  IOSConfig.XcodeUtils.addResourceFileToGroup({ filepath, groupName: projectName, isBuildFile: true, project, verbose: false });
  const refs = project.pbxFileReferenceSection();
  for (const [key, ref] of Object.entries(refs)) {
    if (key.endsWith('_comment') || typeof ref !== 'object') continue;
    if (String(ref.path).replace(/^"|"$/g, '') === filepath) {
      // A folder reference (blue folder): Xcode copies the directory tree as is, subfolders included.
      ref.lastKnownFileType = 'folder';
      for (const k of Object.keys(ref)) if (ref[k] === undefined) delete ref[k];
    }
  }
  return project;
}

function block(lines) {
  return [`// @generated begin ${TAG}`, ...lines, `// @generated end ${TAG}`].join('\n');
}

/** Appends an `androidResources.noCompress` block for the ONNX files to app/build.gradle; idempotent. */
function addNoCompress(buildGradle) {
  const re = new RegExp(`\\n?// @generated begin ${TAG}[\\s\\S]*?// @generated end ${TAG}`, 'g');
  const body = block([
    '// The bundled model is copied out of the APK on first launch: stored, not deflated (withBundledModel.js).',
    'android {',
    '  androidResources {',
    `    noCompress ${NO_COMPRESS.map((e) => `'${e}'`).join(', ')}`,
    '  }',
    '}',
  ]);
  return `${buildGradle.replace(re, '').trimEnd()}\n\n${body}\n`;
}

function withBundledModel(config) {
  const pins = readPins();
  const appEnv = (config.extra && config.extra.appEnv) || process.env.APP_ENV || 'development';
  const embedder = process.env.EXPO_PUBLIC_EMBEDDER === 'stub' ? 'stub' : 'device';
  // Decided once per prebuild (hashing ~207 MB), inside the mods: `expo config` alone never needs the files.
  let decided = null;
  const decide = (projectRoot) => (decided ??= shouldBundle({ projectRoot, pins, appEnv, embedder }));

  config = withDangerousMod(config, [
    'ios',
    (mod) => {
      const { projectRoot, platformProjectRoot, projectName } = mod.modRequest;
      if (!projectName) throw new Error(`${TAG}: no iOS project name`);
      stageModel({ projectRoot, nativeRoot: path.join(platformProjectRoot, projectName), pins, bundle: decide(projectRoot) });
      return mod;
    },
  ]);
  config = withXcodeProject(config, (mod) => {
    const projectName = mod.modRequest.projectName;
    if (!projectName) throw new Error(`${TAG}: no iOS project name`);
    mod.modResults = addModelFolderReference(mod.modResults, projectName);
    return mod;
  });
  config = withDangerousMod(config, [
    'android',
    (mod) => {
      const { projectRoot, platformProjectRoot } = mod.modRequest;
      const nativeRoot = path.join(platformProjectRoot, 'app', 'src', 'main', 'assets');
      stageModel({ projectRoot, nativeRoot, pins, bundle: decide(projectRoot) });
      return mod;
    },
  ]);
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error(`${TAG}: expected a Groovy android/app/build.gradle`);
    mod.modResults.contents = addNoCompress(mod.modResults.contents);
    return mod;
  });
}

module.exports = withBundledModel;
module.exports.shouldBundle = shouldBundle;
module.exports.stageModel = stageModel;
module.exports.addModelFolderReference = addModelFolderReference;
module.exports.addNoCompress = addNoCompress;
