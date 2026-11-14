import { Design } from '@valenced/discord/design'
import { useMemo, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { setWebToken } from '../completion/service'
import {
	BEFORE_LOAD,
	RUN_SCRIPT,
	STOP_SCRIPT,
	TOKEN_SCRIPT,
	USER_AGENT,
} from './script'
import { resolveWebView } from './webview'
import type { WebHandle } from './webview'

type Row = { name: string; progress: number; target: number; completed: boolean }
type Message = {
	type: 'list' | 'update' | 'status' | 'error' | 'token' | 'tokenState'
	data: unknown
}

const color = '#dbdee1'

export default function WebRunner({ onClose }: { onClose(): void }) {
	const WebView = useMemo(resolveWebView, [])
	const web = useRef<WebHandle>(null)
	const [rows, setRows] = useState<Record<string, Row & { id: string }>>({})
	const [status, setStatus] = useState('')
	const [error, setError] = useState('')
	const [linked, setLinked] = useState(false)
	const [tokenState, setTokenState] = useState('waiting for the page')
	const message = (raw: string) => {
		let parsed: Message
		try {
			parsed = JSON.parse(raw)
		} catch {
			return
		}
		const { type, data } = parsed
		if (type === 'list')
			setRows(
				Object.fromEntries(
					(data as (Row & { id: string })[]).map(row => [row.id, row]),
				),
			)
		else if (type === 'update') {
			const row = data as Row & { id: string }
			setRows(rows => ({ ...rows, [row.id]: row }))
		} else if (type === 'status') setStatus(String(data))
		else if (type === 'error') setError(String(data))
		else if (type === 'tokenState') setTokenState(String(data))
		else if (type === 'token' && typeof data === 'string') {
			setWebToken(data)
			setLinked(true)
		}
	}
	return (
		<View style={{ flex: 1 }}>
			<View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
				<Design.Button text="Back" size="sm" onPress={onClose} />
				<Design.Button
					text="Run quests"
					size="sm"
					onPress={() => {
						setError('')
						setStatus('Running. Keep this screen open.')
						web.current?.injectJavaScript(RUN_SCRIPT)
					}}
				/>
				<Design.Button
					text="Stop"
					size="sm"
					onPress={() => web.current?.injectJavaScript(STOP_SCRIPT)}
				/>
			</View>
			<View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
				{!WebView && (
					<Text style={{ color }}>
						Android System WebView is unavailable on this device.
					</Text>
				)}
				<Text style={{ color }}>
					Log in to discord.com below, accept a quest in the Quests page, then
					press Run quests.
				</Text>
				<Text style={{ color }}>
					{linked
						? 'Web session linked. Auto-complete quests from the Quests menu; they keep running after you leave this screen.'
						: `Web session not linked: ${tokenState}.`}
				</Text>
				{Object.values(rows).map(row => (
					<Text key={row.id} style={{ color }}>
						{row.name}: {row.progress}/{row.target}
						{row.completed ? ' done' : ''}
					</Text>
				))}
				{!!status && <Text style={{ color }}>{status}</Text>}
				{!!error && <Text style={{ color: '#f23f43' }}>{error}</Text>}
			</View>
			{WebView && (
				<WebView
					ref={web}
					source={{ uri: 'https://discord.com/quest-home' }}
					style={{ flex: 1 }}
					containerStyle={{ flex: 1 }}
					userAgent={USER_AGENT}
					injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD}
					injectedJavaScript={TOKEN_SCRIPT}
					javaScriptEnabled
					domStorageEnabled
					sharedCookiesEnabled
					thirdPartyCookiesEnabled
					scalesPageToFit
					setBuiltInZoomControls
					setDisplayZoomControls={false}
					originWhitelist={['https://*']}
					onMessage={event => message(event.nativeEvent.data)}
					onError={() => setError('Could not load discord.com.')}
				/>
			)}
		</View>
	)
}
