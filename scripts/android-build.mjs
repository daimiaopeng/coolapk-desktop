import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const androidDir = join(root, 'src-tauri', 'gen', 'android');
const gradleProperties = join(androidDir, 'gradle.properties');
const appBuildGradle = join(androidDir, 'app', 'build.gradle.kts');
const androidManifest = join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
const androidFilePaths = join(androidDir, 'app', 'src', 'main', 'res', 'xml', 'file_paths.xml');
const androidActivityDir = join(androidDir, 'app', 'src', 'main', 'java', 'com', 'coolapk', 'desktop');
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

  const loginActivityMarker = 'android:name=".LoginActivity"';
  let manifest = readFileSync(androidManifest, 'utf8');
  const installPermission = '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />';
  if (!manifest.includes(installPermission)) {
    manifest = manifest.replace('</manifest>', `    ${installPermission}\n</manifest>`);
  }
  if (!manifest.includes(loginActivityMarker)) {
    const closingTag = '    </application>';
    if (!manifest.includes(closingTag)) throw new Error('AndroidManifest.xml 缺少 application 节点');
    manifest = manifest.replace(closingTag, `        <activity
            ${loginActivityMarker}
            android:exported="false"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:label="酷安官方授权登录" />
${closingTag}`);
  }
  writeFileSync(androidManifest, manifest, 'utf8');
  let filePaths = readFileSync(androidFilePaths, 'utf8');
  const updatePath = '<files-path name="coolapk_updates" path="coolapk-desktop-update/" />';
  if (!filePaths.includes(updatePath)) {
    filePaths = filePaths.replace('</paths>', `    ${updatePath}\n</paths>`);
    writeFileSync(androidFilePaths, filePaths, 'utf8');
  }
  mkdirSync(androidActivityDir, { recursive: true });
  copyFileSync(join(root, 'src-tauri', 'android', 'MainActivity.kt'), join(androidActivityDir, 'MainActivity.kt'));
  copyFileSync(join(root, 'src-tauri', 'android', 'LoginActivity.kt'), join(androidActivityDir, 'LoginActivity.kt'));
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
