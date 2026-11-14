import { getModules } from '@valenced/modules/finders'

// Debug aid: lists exported components whose names look like an always-mounted app
// layer, to find a host for a hidden web view.
const pattern =
	/(Root|Navigator|TabBar|Tabs|AppContainer|Overlay|Layer|Portal|Host|Provider|Shell|Main)/

function nameOf(value: unknown): string | undefined {
	if (typeof value === 'function') return value.name
	if (typeof value === 'object' && value !== null) {
		const inner = (value as { type?: unknown; render?: unknown }).type
		if (typeof inner === 'function') return inner.name
		const render = (value as { render?: unknown }).render
		if (typeof render === 'function') return render.name
	}
}

export function scanComponents(done: (names: string[]) => void) {
	const found = new Set<string>()
	const check = (value: unknown) => {
		const name = nameOf(value)
		if (name && pattern.test(name)) found.add(name)
		return false
	}
	const stop = getModules(
		((exports: Record<string, unknown>) => {
			try {
				if (exports) {
					check(exports)
					check(exports.default)
				}
			} catch {
				// Some module exports throw on access.
			}
			return false
		}) as never,
		(() => {}) as never,
	)
	setTimeout(() => {
		stop?.()
		done([...found].sort())
	}, 3000)
}
