import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WEBSITE_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_PORT = 4173;
const DEFAULT_OUTPUT_PATH = resolve(WEBSITE_ROOT, 'artifacts/acepe-investor-pitch.pdf');
const IS_MAIN_MODULE = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

function sleep(delayMs) {
	return new Promise((resolvePromise) => {
		setTimeout(resolvePromise, delayMs);
	});
}

function spawnCommand(command, args, options = {}) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(command, args, {
			stdio: 'inherit',
			...options,
		});

		child.on('exit', (code) => {
			if (code === 0) {
				resolvePromise();
				return;
			}

			rejectPromise(new Error(`${command} exited with code ${code ?? 'unknown'}`));
		});

		child.on('error', rejectPromise);
	});
}

export function parseExportPitchPdfArgs(argv) {
	const parsedArgs = {
		baseUrl: null,
		outputPath: DEFAULT_OUTPUT_PATH,
		port: DEFAULT_PORT,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		const value = argv[index + 1];

		if (argument === '--base-url') {
			parsedArgs.baseUrl = value ?? parsedArgs.baseUrl;
			index += 1;
			continue;
		}

		if (argument === '--output') {
			parsedArgs.outputPath = value ? resolve(WEBSITE_ROOT, value) : parsedArgs.outputPath;
			index += 1;
			continue;
		}

		if (argument === '--port') {
			parsedArgs.port = value ? Number.parseInt(value, 10) : parsedArgs.port;
			index += 1;
		}
	}

	return parsedArgs;
}

export function createPreviewBaseUrl(port) {
	return `http://127.0.0.1:${port}`;
}

export function createPitchUrl(baseUrl) {
	return `${baseUrl}/pitch`;
}

export function createPreviewArgs(port) {
	return ['run', 'preview', '--', '--host', '127.0.0.1', '--port', `${port}`];
}

export async function waitForPitchReady(url, fetchImpl = fetch, attempts = 40, delayMs = 500) {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		const response = await fetchImpl(url).catch(() => null);

		if (response?.ok) {
			const html = await response.text();

			if (html.includes('data-pitch-root')) {
				return;
			}
		}

		if (attempt < attempts - 1) {
			await sleep(delayMs);
		}
	}

	throw new Error('Pitch route never became ready');
}

export function countPdfPages(source) {
	return [...source.matchAll(/\/Type\s*\/Page\b/g)].length;
}

export async function exportPitchPdf(pitchUrl, outputPath) {
	const browserScript = `
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(${JSON.stringify(pitchUrl)}, { waitUntil: "networkidle" });
  await page.pdf({
    path: ${JSON.stringify(outputPath)},
    printBackground: true,
    format: "A4",
    landscape: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" }
  });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`;

	return spawnCommand('bunx', ['--package', 'playwright', 'node', '-e', browserScript], {
		cwd: WEBSITE_ROOT,
	});
}

async function ensureOutputDirectory(outputPath) {
	await mkdir(dirname(outputPath), { recursive: true });
}

async function runCli() {
	const options = parseExportPitchPdfArgs(process.argv.slice(2));
	const baseUrl = options.baseUrl ?? createPreviewBaseUrl(options.port);
	const pitchUrl = createPitchUrl(baseUrl);
	const previewProcess =
		options.baseUrl === null
			? spawn('bun', createPreviewArgs(options.port), {
					cwd: WEBSITE_ROOT,
					stdio: 'inherit',
			  })
			: null;

	await ensureOutputDirectory(options.outputPath);

	try {
		await waitForPitchReady(pitchUrl);
		await exportPitchPdf(pitchUrl, options.outputPath);

		const pdfSource = await readFile(options.outputPath, 'binary');
		const pageCount = countPdfPages(pdfSource);

		await writeFile(
			resolve(dirname(options.outputPath), 'acepe-investor-pitch.meta.json'),
			JSON.stringify(
				{
					pitchUrl,
					outputPath: options.outputPath,
					pageCount,
				},
				null,
				2
			)
		);
	} finally {
		if (previewProcess) {
			previewProcess.kill('SIGTERM');
		}
	}
}

if (IS_MAIN_MODULE) {
	runCli();
}
