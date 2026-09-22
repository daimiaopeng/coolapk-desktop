import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const androidDir = join(root, 'src-tauri', 'gen', 'android');
const gradleProperties = join(androidDir, 'gradle.properties');
const appBuildGradle = join(androidDir, 'app', 'build.gradle.kts');
const androidResourceDir = join(androidDir, 'app', 'src', 'main', 'res');
const androidIconSource = join(root, 'src', 'assets', 'coolapk-logo-rounded.png');
const generatedIconDir = join(androidDir, '.coolapk-icon-output');
const androidStringsPath = join(androidResourceDir, 'values', 'strings.xml');
const keystoreProperties = join(androidDir, 'keystore.properties');
const tauriCli = join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const initOnly = process.argv.includes('--init-only');
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== '--init-only');

function latestDirectory(directory) {
  if (!existsSync(directory)) return '';
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1) || '';
}

function configureWindowsEnvironment() {
  if (process.platform !== 'win32') return;

  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const sdk = process.env.ANDROID_HOME || join(localAppData, 'Android', 'Sdk');
  const bundledJdkRoot = join(programFiles, 'Android', 'openjdk');
  const bundledJdk = latestDirectory(bundledJdkRoot);
  const javaHome = process.env.JAVA_HOME || (bundledJdk ? join(bundledJdkRoot, bundledJdk) : '');
  const ndkVersion = latestDirectory(join(sdk, 'ndk'));
  const ndkHome = process.env.NDK_HOME || (ndkVersion ? join(sdk, 'ndk', ndkVersion) : '');

  if (!javaHome || !existsSync(join(javaHome, 'bin', 'javac.exe'))) {
    throw new Error('未找到 Android JDK，请安装 Android Studio/JDK 17+，并设置 JAVA_HOME。');
  }
  if (!existsSync(sdk)) {
    throw new Error('未找到 Android SDK，请安装 Android SDK，并设置 ANDROID_HOME。');
  }
  if (!ndkHome || !existsSync(ndkHome)) {
    throw new Error('未找到 Android NDK，请通过 SDK Manager 安装 NDK (Side by side)。');
  }

  process.env.JAVA_HOME = javaHome;
  process.env.ANDROID_HOME = sdk;
  process.env.NDK_HOME = ndkHome;
  process.env.CARGO_TARGET_DIR ||= join(localAppData, 'coolapk-desktop', 'android-target');
  process.env.Path = [
    join(javaHome, 'bin'),
    join(sdk, 'platform-tools'),
    join(sdk, 'cmdline-tools', 'latest', 'bin'),
    process.env.Path || '',
  ].join(';');
}

function runTauri(args) {
  const result = spawnSync(process.execPath, [tauriCli, ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function ensureAndroidProject() {
  if (!existsSync(join(androidDir, 'gradlew.bat')) && !existsSync(join(androidDir, 'gradlew'))) {
    runTauri(['android', 'init', '--ci']);
  }

  const pathCheckSetting = 'android.overridePathCheck=true';
  const contents = existsSync(gradleProperties) ? readFileSync(gradleProperties, 'utf8') : '';
  if (!contents.includes(pathCheckSetting)) {
    appendFileSync(gradleProperties, `\n${pathCheckSetting}\n`, 'utf8');
  }

  const signingMarker = '// coolapk-android-release-signing';
  let buildGradle = readFileSync(appBuildGradle, 'utf8');
  if (!buildGradle.includes(signingMarker)) {
    buildGradle = buildGradle.replace(
      '\nandroid {',
      `\n${signingMarker}\nval signingPropertiesFile = rootProject.file("keystore.properties")\nval signingProperties = Properties().apply {\n    if (signingPropertiesFile.exists()) {\n        signingPropertiesFile.inputStream().use { load(it) }\n    }\n}\n\nandroid {`,
    );
    buildGradle = buildGradle.replace(
      '    buildTypes {',
      `    if (signingPropertiesFile.exists()) {\n        signingConfigs {\n            create("release") {\n                keyAlias = signingProperties.getProperty("keyAlias")\n                keyPassword = signingProperties.getProperty("keyPassword")\n                storeFile = rootProject.file(signingProperties.getProperty("storeFile"))\n                storePassword = signingProperties.getProperty("storePassword")\n            }\n        }\n    }\n    buildTypes {`,
    );
    buildGradle = buildGradle.replace(
      '        getByName("release") {',
      `        getByName("release") {\n            if (signingPropertiesFile.exists()) {\n                signingConfig = signingConfigs.getByName("release")\n            }`,
    );
    writeFileSync(appBuildGradle, buildGradle, 'utf8');
  }
}

function copyDirectory(source, target) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      copyFileSync(sourcePath, targetPath);
    }
  }
}

function syncAndroidIcon() {
  if (!existsSync(androidIconSource)) {
    throw new Error(`未找到 Android 应用图标源文件: ${androidIconSource}`);
  }

  // Tauri CLI 负责按 Android 密度生成 adaptive/round/legacy 三套资源，
  // 再复制到 gen/android，保证每次重新 init 或清理生成目录后图标仍然正确。
  runTauri(['icon', androidIconSource, '--output', generatedIconDir]);
  const generatedAndroidIconDir = join(generatedIconDir, 'android');
  if (!existsSync(generatedAndroidIconDir)) {
    throw new Error(`Tauri 未生成 Android 图标资源: ${generatedAndroidIconDir}`);
  }
  copyDirectory(generatedAndroidIconDir, androidResourceDir);

  const manifestPath = join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
  let manifest = readFileSync(manifestPath, 'utf8');
  const iconAttribute = '        android:icon="@mipmap/ic_launcher"';
  const roundIconAttribute = '        android:roundIcon="@mipmap/ic_launcher_round"';
  if (!manifest.includes(roundIconAttribute)) {
    if (!manifest.includes(iconAttribute)) {
      throw new Error(`AndroidManifest.xml 缺少预期的 android:icon 属性: ${manifestPath}`);
    }
    manifest = manifest.replace(iconAttribute, `${iconAttribute}\n${roundIconAttribute}`);
    writeFileSync(manifestPath, manifest, 'utf8');
  }
}

function configureAndroidAppName() {
  let strings = readFileSync(androidStringsPath, 'utf8');
  for (const resourceName of ['app_name', 'main_activity_title']) {
    const pattern = new RegExp(`(<string name="${resourceName}">)[^<]*(</string>)`);
    if (!pattern.test(strings)) {
      throw new Error(`Android strings.xml 缺少预期资源: ${resourceName}`);
    }
    strings = strings.replace(pattern, `$1酷安开源版$2`);
  }
  writeFileSync(androidStringsPath, strings, 'utf8');
}

function escapeProperty(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(':', '\\:').replaceAll('=', '\\=');
}

function configureSigning() {
  const storeFile = process.env.ANDROID_KEYSTORE_PATH || '';
  const keyAlias = process.env.ANDROID_KEY_ALIAS || '';
  const keyPassword = process.env.ANDROID_KEY_PASSWORD || '';
  const storePassword = process.env.ANDROID_KEYSTORE_PASSWORD || keyPassword;
  const supplied = [storeFile, keyAlias, keyPassword, storePassword].filter(Boolean).length;

  if (supplied === 0) return false;
  if (supplied !== 4 || !existsSync(storeFile)) {
    throw new Error('Android 签名信息不完整，请检查 ANDROID_KEYSTORE_PATH、ANDROID_KEY_ALIAS、ANDROID_KEY_PASSWORD 和 ANDROID_KEYSTORE_PASSWORD。');
  }

  writeFileSync(keystoreProperties, [
    `storeFile=${escapeProperty(resolve(storeFile))}`,
    `storePassword=${escapeProperty(storePassword)}`,
    `keyAlias=${escapeProperty(keyAlias)}`,
    `keyPassword=${escapeProperty(keyPassword)}`,
    '',
  ].join('\n'), { encoding: 'utf8', mode: 0o600 });
  return true;
}

configureWindowsEnvironment();
mkdirSync(process.env.CARGO_TARGET_DIR || join(root, 'src-tauri', 'target'), { recursive: true });
ensureAndroidProject();
syncAndroidIcon();
configureAndroidAppName();
const signingConfigured = configureSigning();

if (!initOnly) {
  const buildArgs = forwardedArgs.length
    ? forwardedArgs
    : ['--debug', '--target', 'aarch64', '--apk'];
  if (!buildArgs.includes('--debug') && !signingConfigured) {
    throw new Error('Release APK/AAB 必须签名，请先配置 Android 签名环境变量。');
  }
  runTauri(['android', 'build', ...buildArgs]);
}
