import { resolve } from '$app/paths';

const root = resolve('/');
const base = root === '/' ? '' : root.replace(/\/$/, '');

export function appHref(path: string): string {
	const normalized = path.startsWith('/') ? path : `/${path}`;
	return `${base}${normalized}`;
}

export function stripBase(pathname: string): string {
	if (!base) return pathname;
	if (pathname === base) return '/';
	if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length) || '/';
	return pathname;
}
