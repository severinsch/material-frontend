import { Configuration, DefaultApi } from '$lib/api';
import { browser } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';

// Create a lazy-initialized API client that uses the correct URL based on environment
function createApiClient(): DefaultApi {
	let apiUrl: string;

	if (browser) {
		// Client-side: use the public URL (must be accessible from browser)
		apiUrl = publicEnv.PUBLIC_API_URL || 'http://localhost:8080';
	} else {
		// Server-side: use the private URL (can use Docker internal networking)
		// We use process.env here since $env/dynamic/private can't be imported in shared modules
		apiUrl = process.env.API_URL || 'http://localhost:8080';
	}

	const config = new Configuration({ basePath: apiUrl });
	return new DefaultApi(config);
}

export const apiClient = createApiClient();
