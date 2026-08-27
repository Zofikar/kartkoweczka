import { TransferTestSchema, type TransferTestSchemaType } from '@/utils/transferSchemas';
import { encode, decode } from '@msgpack/msgpack';

type RepoPromise = Promise<typeof import('@/db/repositories')>;
let repoPromise: RepoPromise | null = null;
async function getRepo(): RepoPromise {
	repoPromise ??= import('@/db/repositories');

	return await repoPromise;
}

async function ExportCommon(id: string): Promise<TransferTestSchemaType> {
	const { exportTest } = await getRepo();
	const test = await exportTest(id);
	if (!test) throw new Error('Test not found');
	return TransferTestSchema.parseAsync(test);
}

async function ImportCommon(test: unknown): Promise<string> {
	const { importTest } = await getRepo();
	return importTest(await TransferTestSchema.parseAsync(test));
}

export async function ExportTestJson(id: string): Promise<string> {
	return JSON.stringify(await ExportCommon(id));
}

export async function ImportTestJson(json: string): Promise<string> {
	return ImportCommon(JSON.parse(json));
}

export async function ExportTestBinary(id: string): Promise<Uint8Array> {
	return encode(await ExportCommon(id));
}

export async function ImportTestBinary(binary: Uint8Array): Promise<string> {
	return ImportCommon(decode(binary));
}
