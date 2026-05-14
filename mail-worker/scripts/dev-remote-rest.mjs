import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve as resolvePath } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import worker from '../src/index.js';

const require = createRequire(import.meta.url);
const { EnvHttpProxyAgent, setGlobalDispatcher } = require('../node_modules/.pnpm/undici@7.24.8/node_modules/undici');

const root = resolvePath(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const wranglerConfigPath = join(root, 'wrangler-dev.toml');
const accountId = 'ac33cee01edcad1f9984cc995864856c';
const configText = readFileSync(wranglerConfigPath, 'utf8');

const port = Number(process.env.PORT || 8787);
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (proxy) {
	setGlobalDispatcher(new EnvHttpProxyAgent({ noProxy: process.env.NO_PROXY || process.env.no_proxy || 'localhost,127.0.0.1,::1' }));
}

function matchConfig(pattern, fallback = '') {
	return configText.match(pattern)?.[1] || fallback;
}

const resource = {
	databaseId: matchConfig(/database_id\s*=\s*"([^"]+)"/),
	kvNamespaceId: configText.match(/\[\[kv_namespaces\]\][\s\S]*?id\s*=\s*"([^"]+)"/)?.[1] || '',
	r2BucketName: matchConfig(/bucket_name\s*=\s*"([^"]+)"/),
	domains: Array.from(configText.matchAll(/domain\s*=\s*\[([^\]]*)\]/g)).at(-1)?.[1]
		?.split(',')
		.map((item) => item.trim().replace(/^"|"$/g, ''))
		.filter(Boolean) || [],
	admin: matchConfig(/admin\s*=\s*"([^"]+)"/),
	jwtSecret: matchConfig(/jwt_secret\s*=\s*"([^"]+)"/),
};

const wranglerBin = join(root, 'node_modules', '.bin', 'wrangler.cmd');
let authCache = null;

function readWranglerAuth(forceRefresh = false) {
	if (authCache && !forceRefresh) {
		return authCache;
	}

	const result = spawnSync('cmd.exe', ['/c', wranglerBin, 'auth', 'token', '--json'], {
		cwd: root,
		env: process.env,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout || 'Failed to load Wrangler auth token.');
	}

	const auth = JSON.parse(result.stdout);
	if (!auth?.token && !auth?.key) {
		throw new Error('Wrangler auth token is missing.');
	}

	authCache = auth;
	return auth;
}

function buildAuthHeaders(forceRefresh = false) {
	const auth = readWranglerAuth(forceRefresh);
	if (auth.type === 'api_key') {
		return {
			'X-Auth-Email': auth.email,
			'X-Auth-Key': auth.key,
		};
	}

	return {
		Authorization: `Bearer ${auth.token}`,
	};
}

async function cloudflareFetch(pathname, init = {}, retry = true) {
	const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
		...init,
		headers: {
			...buildAuthHeaders(),
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
			...init.headers,
		},
	});

	if (retry && (response.status === 401 || response.status === 403)) {
		authCache = null;
		return cloudflareFetch(pathname, init, false);
	}

	if (init.rawResponse) {
		return response;
	}

	const data = await response.json();
	if (!response.ok || data.success === false) {
		const message = data.errors?.map((item) => `${item.code}: ${item.message}`).join('; ') || response.statusText;
		throw new Error(`Cloudflare API failed: ${message}`);
	}
	return data;
}

class RemoteD1Statement {
	constructor(database, sql, params = []) {
		this.database = database;
		this.sql = sql;
		this.params = params;
	}

	bind(...params) {
		return new RemoteD1Statement(this.database, this.sql, params);
	}

	async query(kind) {
		const data = await cloudflareFetch(
			`/accounts/${accountId}/d1/database/${this.database.databaseId}/${kind}`,
			{
				method: 'POST',
				body: JSON.stringify({ sql: this.sql, params: this.params }),
			}
		);
		return data.result?.[0] || { results: [], success: true, meta: {} };
	}

	async all() {
		const result = await this.query('query');
		return { results: result.results || [], success: result.success, meta: result.meta };
	}

	async raw() {
		const result = await this.query('raw');
		return result.results?.rows || [];
	}

	async run() {
		const result = await this.query('query');
		return { results: result.results || [], success: result.success, meta: result.meta };
	}
}

class RemoteD1Database {
	constructor(databaseId) {
		this.databaseId = databaseId;
	}

	prepare(sql) {
		return new RemoteD1Statement(this, sql);
	}

	async batch(statements) {
		const batch = statements.map((statement) => ({ sql: statement.sql, params: statement.params }));
		const data = await cloudflareFetch(
			`/accounts/${accountId}/d1/database/${this.databaseId}/query`,
			{
				method: 'POST',
				body: JSON.stringify({ batch }),
			}
		);
		return data.result || [];
	}
}

class RemoteKVNamespace {
	constructor(namespaceId) {
		this.namespaceId = namespaceId;
	}

	async get(key, options = {}) {
		const response = await cloudflareFetch(
			`/accounts/${accountId}/storage/kv/namespaces/${this.namespaceId}/values/${encodeURIComponent(key)}`,
			{ rawResponse: true }
		);
		if (response.status === 404) return null;
		if (!response.ok) throw new Error(`KV get failed: ${response.status} ${response.statusText}`);
		const text = await response.text();
		return options.type === 'json' ? JSON.parse(text) : text;
	}

	async put(key, value) {
		const body = typeof value === 'string' ? value : JSON.stringify(value);
		const data = await cloudflareFetch(
			`/accounts/${accountId}/storage/kv/namespaces/${this.namespaceId}/values/${encodeURIComponent(key)}`,
			{
				method: 'PUT',
				body,
				headers: {
					'Content-Type': 'text/plain;charset=utf-8',
				},
			}
		);
		if (data.success === false) {
			throw new Error(`KV put failed: ${data.errors?.map((item) => item.message).join('; ')}`);
		}
	}
}

const contentTypes = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
};

const distDir = join(root, 'dist');
const assets = {
	async fetch(request) {
		const url = new URL(request.url);
		const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
		const filePath = normalize(join(distDir, pathname));
		const safePath = filePath.startsWith(distDir) && existsSync(filePath) ? filePath : join(distDir, 'index.html');
		const body = readFileSync(safePath);
		return new Response(body, {
			headers: { 'Content-Type': contentTypes[extname(safePath).toLowerCase()] || 'application/octet-stream' },
		});
	},
};

const env = {
	db: new RemoteD1Database(resource.databaseId),
	kv: new RemoteKVNamespace(resource.kvNamespaceId),
	r2: {},
	assets,
	ai_model: '',
	analysis_cache: false,
	orm_log: false,
	domain: resource.domains,
	admin: resource.admin,
	jwt_secret: resource.jwtSecret,
};

function nodeRequestToWeb(req) {
	const url = `http://${req.headers.host || `127.0.0.1:${port}`}${req.url}`;
	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (Array.isArray(value)) {
			for (const item of value) headers.append(key, item);
		} else if (value !== undefined) {
			headers.set(key, value);
		}
	}

	const init = { method: req.method, headers };
	if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
		init.body = req;
		init.duplex = 'half';
	}
	return new Request(url, init);
}

const server = createServer(async (req, res) => {
	try {
		const response = await worker.fetch(nodeRequestToWeb(req), env, {
			waitUntil(promise) {
				Promise.resolve(promise).catch((error) => console.error(error));
			},
			passThroughOnException() {},
		});

		res.writeHead(response.status, Object.fromEntries(response.headers));
		if (response.body) {
			const buffer = Buffer.from(await response.arrayBuffer());
			res.end(buffer);
		} else {
			res.end();
		}
	} catch (error) {
		console.error(error);
		res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
		res.end(JSON.stringify({ code: 500, message: error.message }));
	}
});

server.listen(port, '0.0.0.0', () => {
	console.log(`Remote REST dev server ready on http://127.0.0.1:${port}`);
	console.log(`D1=${resource.databaseId} KV=${resource.kvNamespaceId} proxy=${proxy || 'none'}`);
});
