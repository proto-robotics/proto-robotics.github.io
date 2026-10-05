"""
Points VS Code's Java support at the Android app's real classpath, so the
editor stops flagging every Android and Capacitor type in android/app/src:

    npm run app:java

The Java extension cannot import an Android Gradle build, so the Gradle
build is asked for the classpath it compiles the app with (the
writeJavaClasspath task in android/app/build.gradle) and VS Code is set up
to treat the sources as a plain folder with those jars as libraries. The
result is .vscode/settings.json, which holds machine-specific paths and is
git-ignored; run this again after a Capacitor or dependency update.
Reload the VS Code window afterwards (Developer: Reload Window).
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANDROID = ROOT / 'android'
CLASSPATH_FILE = ANDROID / 'app' / 'build' / 'java-classpath.txt'
SETTINGS = ROOT / '.vscode' / 'settings.json'

JAVA_SETTINGS = {
    # the Android build is not importable; the sources are a plain folder
    'java.import.gradle.enabled': False,
    'java.configuration.updateBuildConfiguration': 'disabled',
    'java.project.sourcePaths': ['android/app/src/main/java'],
    'java.project.outputPath': 'android/app/build/vscode-classes',
    'java.project.referencedLibraries': [],
}


def main():
    gradlew = ANDROID / ('gradlew.bat' if sys.platform == 'win32' else 'gradlew')
    subprocess.run([str(gradlew), '-q', 'writeJavaClasspath'], cwd=ANDROID, check=True)
    jars = [line.strip() for line in CLASSPATH_FILE.read_text().splitlines() if line.strip()]
    if not jars:
        sys.exit('Gradle wrote no classpath; run the build first (npm run app:apk).')

    settings = {}
    if SETTINGS.exists():
        settings = json.loads(SETTINGS.read_text(encoding='utf-8'))
    settings.update(JAVA_SETTINGS)
    settings['java.project.referencedLibraries'] = [jar.replace('\\', '/') for jar in jars]
    SETTINGS.parent.mkdir(exist_ok=True)
    SETTINGS.write_text(json.dumps(settings, indent=4) + '\n', encoding='utf-8')
    print(f'wrote {SETTINGS.relative_to(ROOT)} with {len(jars)} libraries; reload the VS Code window')


if __name__ == '__main__':
    main()
