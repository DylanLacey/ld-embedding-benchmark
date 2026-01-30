import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: ['src/lib/**/*.ts'],
			exclude: ['src/lib/server/db/schema/**'],
			thresholds: {
				statements: 80,
				branches: 80,
				functions: 80,
				lines: 80
			}
		}
	}
});
