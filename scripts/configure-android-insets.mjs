import { readFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const packagePath = config.identifier.split('.');
const activityPath = join(
	'src-tauri/gen/android/app/src/main/java',
	...packagePath,
	'MainActivity.kt'
);
const activity = readFileSync(activityPath, 'utf8');
const packageDeclaration = activity.match(/^package .+$/m)?.[0];
if (!packageDeclaration || !activity.includes('class MainActivity : TauriActivity()')) {
	throw new Error('Unexpected Android activity template; review safe-area integration');
}

const sourcePath = 'src-tauri/android/MainActivity.kt';
const source = readFileSync(sourcePath, 'utf8');
if (source.split(/\r?\n/)[0] !== packageDeclaration) {
	throw new Error('MainActivity.kt package must match the generated Android activity');
}
copyFileSync(sourcePath, activityPath);
copyFileSync(
	'src-tauri/android/AndroidUpdaterPlugin.kt',
	join(activityPath, '..', 'AndroidUpdaterPlugin.kt')
);
const resourceDirectory = 'src-tauri/gen/android/app/src/main/res/xml';
copyFileSync('src-tauri/android/UpdatePolicy.java', join(activityPath, '..', 'UpdatePolicy.java'));
mkdirSync(resourceDirectory, { recursive: true });
copyFileSync('src-tauri/android/update-paths.xml', join(resourceDirectory, 'update_paths.xml'));
