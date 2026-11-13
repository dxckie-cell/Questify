function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

export function questRequestError(error: unknown): Error {
	if (!record(error)) return new Error('Discord quest request failed.')
	const detail = record(error.err) ? error.err : error
	const body = record(error.body)
		? error.body
		: record(detail.body)
			? detail.body
			: {}
	const statusCode = error.status ?? detail.status
	const status = typeof statusCode === 'number' ? ` HTTP ${statusCode}` : ''
	const code =
		typeof body.code === 'number' ? ` (Discord code ${body.code})` : ''
	const message =
		typeof body.message === 'string'
			? body.message
			: typeof detail.message === 'string'
				? detail.message
				: 'Request failed.'
	return new Error(`Discord quest request failed${status}: ${message}${code}`)
}

export async function callQuestAction(
	action: () => Promise<unknown>,
): Promise<void> {
	try {
		// Discord's native quest actions return void after awaiting their request.
		await action()
	} catch (error) {
		throw questRequestError(error)
	}
}
