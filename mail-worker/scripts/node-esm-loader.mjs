export async function resolve(specifier, context, defaultResolve) {
	try {
		return await defaultResolve(specifier, context, defaultResolve);
	} catch (error) {
		if (
			error?.code !== 'ERR_MODULE_NOT_FOUND' ||
			(!specifier.startsWith('./') && !specifier.startsWith('../') && !specifier.includes('/'))
		) {
			throw error;
		}

		for (const suffix of ['.js', '/index.js']) {
			try {
				return await defaultResolve(`${specifier}${suffix}`, context, defaultResolve);
			} catch {
				// Try the next Node-style extension fallback.
			}
		}

		throw error;
	}
}
