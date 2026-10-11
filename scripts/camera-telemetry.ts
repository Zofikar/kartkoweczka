import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Plugin } from 'vite';

/** Local development only. Fixed destination, bounded payload, no cross-origin collection. */
export function cameraTelemetry(): Plugin {
	return {
		name: 'camera-telemetry',
		apply: 'serve',
		configureServer(server) {
			const directory = path.join(server.config.root, '.agents/memory/debug');
			let writes = Promise.resolve();
			server.middlewares.use('/__debug/camera-images', async (request, response) => {
				response.setHeader('Cache-Control', 'no-store');
				if (request.method !== 'POST') {
					response.statusCode = 405;
					response.end();
					return;
				}
				if (request.headers['sec-fetch-site'] === 'cross-site') {
					response.statusCode = 403;
					response.end();
					return;
				}
				if (!request.headers['content-type']?.startsWith('application/json')) {
					response.statusCode = 415;
					response.end();
					return;
				}
				try {
					let body = '';
					for await (const chunk of request) {
						body += chunk.toString();
						if (Buffer.byteLength(body) > 80 * 1024 * 1024) {
							response.statusCode = 413;
							response.end();
							return;
						}
					}
					const data = JSON.parse(body);
					function png(value: unknown) {
						if (
							typeof value !== 'string' ||
							!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)
						)
							throw new SyntaxError('Invalid PNG');
						const bytes = Buffer.from(value.slice('data:image/png;base64,'.length), 'base64');
						if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
							throw new SyntaxError('Invalid PNG');
						return bytes;
					}
					const normalized = data.normalized === undefined ? undefined : png(data.normalized);
					const qr = data.qr === undefined ? undefined : png(data.qr);
					const original = data.original === undefined ? undefined : png(data.original);
					const initialNormalized =
						data.initialNormalized === undefined ? undefined : png(data.initialNormalized);
					const id = randomUUID();
					const images = path.join(directory, 'camera-images');
					await mkdir(images, { recursive: true });
					if (!original && !normalized) throw new SyntaxError('Missing capture image');
					if (normalized) await writeFile(path.join(images, `${id}-normalized.png`), normalized);
					if (qr) await writeFile(path.join(images, `${id}-qr.png`), qr);
					if (original) await writeFile(path.join(images, `${id}-original.png`), original);
					if (initialNormalized)
						await writeFile(path.join(images, `${id}-initial-normalized.png`), initialNormalized);
					await appendFile(
						path.join(images, 'captures.jsonl'),
						JSON.stringify({
							id,
							receivedAt: new Date().toISOString(),
							hasOriginal: original !== undefined,
							hasNormalized: normalized !== undefined,
							warnings: Array.isArray(data.warnings)
								? data.warnings
										.filter((value: unknown) => typeof value === 'string')
										.slice(0, 8)
										.map((value: string) => value.slice(0, 1000))
								: [],
							originalWidth:
								Number.isSafeInteger(data.originalWidth) && data.originalWidth > 0
									? data.originalWidth
									: null,
							originalHeight:
								Number.isSafeInteger(data.originalHeight) && data.originalHeight > 0
									? data.originalHeight
									: null,
							readable: data.readable === true,
							torch: data.torch === true,
							refinementApplied: data.refinementApplied === true,
							alignmentDetails:
								typeof data.alignmentDetails === 'string'
									? data.alignmentDetails.slice(0, 8192)
									: '',
							initialGridEdges: Array.isArray(data.initialGridEdges)
								? data.initialGridEdges
										.slice(0, 2)
										.map((edge: Record<string, unknown>) =>
											Object.fromEntries(
												['axis', 'expected', 'offset', 'tiltDegrees', 'rms', 'coverage'].map(
													(key) => [
														key,
														key === 'axis'
															? edge[key] === 'top'
																? 'top'
																: 'left'
															: typeof edge[key] === 'number' && Number.isFinite(edge[key])
																? edge[key]
																: null,
													]
												)
											)
										)
								: [],
							gridEdges: Array.isArray(data.gridEdges)
								? data.gridEdges.slice(0, 2).map((edge: Record<string, unknown>) => ({
										axis: edge.axis === 'top' ? 'top' : 'left',
										...Object.fromEntries(
											['expected', 'offset', 'tiltDegrees', 'rms', 'coverage'].map((key) => [
												key,
												typeof edge[key] === 'number' && Number.isFinite(edge[key])
													? edge[key]
													: null,
											])
										),
									}))
								: [],
						}) + '\n'
					);
					response.statusCode = 204;
					response.end();
				} catch (error) {
					response.statusCode = error instanceof SyntaxError ? 400 : 500;
					response.end();
				}
			});
			server.middlewares.use('/__debug/camera-timings', async (request, response) => {
				response.setHeader('Cache-Control', 'no-store');
				if (request.method !== 'POST') {
					response.statusCode = 405;
					response.end();
					return;
				}
				if (request.headers['sec-fetch-site'] === 'cross-site') {
					response.statusCode = 403;
					response.end();
					return;
				}
				if (!request.headers['content-type']?.startsWith('application/json')) {
					response.statusCode = 415;
					response.end();
					return;
				}
				try {
					let body = '';
					for await (const chunk of request) {
						body += chunk.toString();
						if (Buffer.byteLength(body) > 8192) {
							response.statusCode = 413;
							response.end();
							return;
						}
					}
					const data = JSON.parse(body);
					if (
						!data ||
						typeof data !== 'object' ||
						typeof data.duration !== 'number' ||
						!Number.isFinite(data.duration) ||
						!data.timings ||
						typeof data.timings !== 'object'
					) {
						response.statusCode = 400;
						response.end();
						return;
					}
					// Whitelist fields; never persist arbitrary image/payload properties.
					const entry = {
						receivedAt: new Date().toISOString(),
						duration: data.duration,
						timings: Object.fromEntries(
							Object.entries(data.timings).filter(
								([key, value]) =>
									[
										'readback',
										'module',
										'copy',
										'exposure',
										'markers',
										'markerDiscovery',
										'markerRefinement',
										'markerPreparation',
										'markerSelection',
										'normalizationWarp',
										'normalizationAlignment',
										'normalization',
										'revision',
										'grading',
									].includes(key) &&
									typeof value === 'number' &&
									Number.isFinite(value)
							)
						),
						width: Number(data.width) || 0,
						height: Number(data.height) || 0,
						markers: Number(data.markers) || 0,
						readable: data.readable === true,
						torch: data.torch === true,
					};
					const write = writes
						.catch(() => {})
						.then(async () => {
							await mkdir(directory, { recursive: true });
							await appendFile(
								path.join(directory, 'camera-timings.jsonl'),
								JSON.stringify(entry) + '\n'
							);
						});
					writes = write;
					await write;
					response.statusCode = 204;
					response.end();
				} catch (error) {
					response.statusCode = error instanceof SyntaxError ? 400 : 500;
					response.end();
				}
			});
		},
	};
}
