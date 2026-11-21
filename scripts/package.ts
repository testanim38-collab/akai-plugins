import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { zipSync } from 'fflate'

const PagesDir = 'build/pages'
const FixedMtime = new Date('2000-01-01T00:00:00Z')

rmSync(PagesDir, { recursive: true, force: true })
mkdirSync(PagesDir, { recursive: true })

let count = 0

for (const name of [...readdirSync('plugins')].sort()) {
	const pluginDir = join('plugins', name)
	const manifestPath = join(pluginDir, 'manifest.json')
	if (!existsSync(manifestPath)) continue

	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
		id: string
		version: string
	}
	const bundlePath = join(pluginDir, 'build', 'js', 'index.js')
	if (!existsSync(bundlePath)) {
		throw new Error(`Missing ${bundlePath}. Run "bun run build" first.`)
	}

	const archive = zipSync(
		{
			'manifest.json': new Uint8Array(readFileSync(manifestPath)),
			'index.js': new Uint8Array(readFileSync(bundlePath)),
		},
		{ mtime: FixedMtime },
	)
	const fileName = `${manifest.id}@${manifest.version}.zip`

	writeFileSync(join(PagesDir, fileName), archive)
	count++
	console.log(`Packed ${fileName}`)
}

console.log(`Packed ${count} plugin(s) into ${PagesDir}`)
