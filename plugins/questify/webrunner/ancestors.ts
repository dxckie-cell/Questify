// Debug aid: names of the mounted components above a view, to find an always-mounted
// app layer. Reads the React fiber only; it never touches the module registry.
type Fiber = { return?: Fiber | null; type?: unknown; elementType?: unknown }

function fiberOf(instance: Record<string, unknown>): Fiber | undefined {
	for (const key of [
		'_internalFiberInstanceHandleDEV',
		'__internalInstanceHandle',
		'_internalInstanceHandle',
	])
		if (instance[key]) return instance[key] as Fiber
	const key = Object.keys(instance).find(name =>
		name.startsWith('__reactFiber$'),
	)
	return key ? (instance[key] as Fiber) : undefined
}

function nameOf(type: unknown): string | undefined {
	if (typeof type === 'string') return type
	if (typeof type === 'function')
		return (type as { displayName?: string }).displayName || type.name
	if (typeof type === 'object' && type !== null) {
		const wrapped = type as {
			displayName?: string
			type?: unknown
			render?: unknown
		}
		return wrapped.displayName || nameOf(wrapped.type) || nameOf(wrapped.render)
	}
}

export function ancestorNames(instance: unknown): string[] {
	try {
		let fiber = fiberOf(instance as Record<string, unknown>)
		if (!fiber) return ['no fiber on this view']
		const names: string[] = []
		for (let i = 0; fiber && i < 150; i++, fiber = fiber.return ?? undefined) {
			const name = nameOf(fiber.elementType ?? fiber.type)
			if (name && name !== names.at(-1)) names.push(name)
		}
		return names
	} catch (error) {
		return [`error: ${error instanceof Error ? error.message : error}`]
	}
}
