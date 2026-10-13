import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	API_URL: {
		description: 'Base URL of the material API, as reached from the frontend server.',
		schema: (value) => value || 'http://localhost:8080'
	}
});
