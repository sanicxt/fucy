import { access, copyFile } from 'node:fs/promises';

const index = 'build/index.html';
const fallback = 'build/404.html';

try {
	await access(index);
} catch {
	await copyFile(fallback, index);
	console.log('Created build/index.html from build/404.html');
}
