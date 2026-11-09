import { EMBEDDING_MODEL } from '@friendpod/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import withOrtPinned from '../plugins/withOrtPinned';

const { pinAndroid, pinIos } = withOrtPinned;
const root = join(__dirname, '..');

const PODFILE = `require File.join(File.dirname(\`node --print "require.resolve('expo/package.json')"\`), "scripts/autolinking")

platform :ios, podfile_properties['ios.deploymentTarget'] || '16.4'

target 'FriendpodDev' do
  use_expo_modules!
  config = use_native_modules!(config_command)
end
`;
const BUILD_GRADLE = `buildscript {
  repositories { google() }
}

allprojects {
  repositories { google() }
}
`;

describe('on-device runtime pins (D1)', () => {
  it('app.config.ts, package.json and core agree on every pinned version', () => {
    const config = readFileSync(join(root, 'app.config.ts'), 'utf8');
    const device = EMBEDDING_MODEL.device!;
    expect(config).toContain(`const ORT_NATIVE_VERSION = '${device.nativeOrt}';`);
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['onnxruntime-react-native']).toBe(device.npm['onnxruntime-react-native']);
    expect(pkg.dependencies['@huggingface/tokenizers']).toBe(device.npm['@huggingface/tokenizers']);
  });

  it('forces onnxruntime-android for every Gradle project, once', () => {
    const out = pinAndroid(BUILD_GRADLE, '1.30.0');
    expect(out).toContain("resolutionStrategy.force 'com.microsoft.onnxruntime:onnxruntime-android:1.30.0'");
    // Gradle 9 removed VersionNumber, which the library's build.gradle still calls.
    expect(out).toContain("if (p.name == 'onnxruntime-react-native') p.ext.VersionNumber = org.gradle.util.internal.VersionNumber");
    expect(pinAndroid(out, '1.30.0')).toBe(out);
    expect(pinAndroid(out, '1.31.0')).not.toContain('1.30.0');
  });

  it("names the onnxruntime-c pod version inside the app target, once", () => {
    const out = pinIos(PODFILE, '1.30.0');
    expect(out.indexOf("pod 'onnxruntime-c', '1.30.0'")).toBeGreaterThan(out.indexOf('use_expo_modules!'));
    expect(out.indexOf("pod 'onnxruntime-c', '1.30.0'")).toBeLessThan(out.indexOf('use_native_modules!'));
    expect(pinIos(out, '1.30.0')).toBe(out);
  });

  it('fails the prebuild instead of leaving the runtime unpinned', () => {
    expect(() => pinIos(PODFILE.replace('use_expo_modules!', ''), '1.30.0')).toThrow(/Podfile/);
    expect(() => withOrtPinned({ name: 'x', slug: 'x' }, { version: 'latest' })).toThrow(/version/);
  });
});
