import { AlertActionCreators } from '@valenced/discord/actions'
import { useEffect, useMemo, useRef } from 'react'
import { View } from 'react-native'
import { logRequest } from '../completion/service'
import { BEFORE_LOAD, RUN_SCRIPT, USER_AGENT } from './script'
import { resolveWebView } from './webview'
import type { WebHandle } from './webview'

const key = 'QUESTIFY_BACKGROUND_RUNNER'

// Experiment: the alert host stays mounted on every screen, so a hidden WebView
// rendered there should keep running while the user browses Discord.
function Host() {
	const WebView = useMemo(resolveWebView, [])
	const web = useRef<WebHandle>(null)
	useEffect(() => {
		logRequest(`background host mounted, webview=${!!WebView}`)
		const start = setTimeout(() => web.current?.injectJavaScript(RUN_SCRIPT), 8000)
		const retry = setInterval(
			() => web.current?.injectJavaScript(RUN_SCRIPT),
			30000,
		)
		let minutes = 0
		const alive = setInterval(
			() => logRequest(`background host alive ${++minutes}m`),
			60000,
		)
		return () => {
			clearTimeout(start)
			clearInterval(retry)
			clearInterval(alive)
			logRequest('background host unmounted')
		}
	}, [WebView])
	if (!WebView) return null
	return (
		<View
			pointerEvents="none"
			style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01 }}
		>
			<WebView
				ref={web}
				source={{ uri: 'https://discord.com/quest-home' }}
				style={{ flex: 1 }}
				containerStyle={{ flex: 1 }}
				userAgent={USER_AGENT}
				injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD}
				javaScriptEnabled
				domStorageEnabled
				sharedCookiesEnabled
				thirdPartyCookiesEnabled
				scalesPageToFit={false}
				setBuiltInZoomControls={false}
				setDisplayZoomControls={false}
				originWhitelist={['https://*']}
				onMessage={event => {
					try {
						const { type, data } = JSON.parse(event.nativeEvent.data)
						if (type === 'status' || type === 'error')
							logRequest(`web ${type}: ${String(data).slice(0, 80)}`)
						else if (type === 'update')
							logRequest(`web ${data.name}: ${data.progress}/${data.target}`)
					} catch {
						// Ignore non-JSON page messages.
					}
				}}
				onError={() => logRequest('web load error')}
			/>
		</View>
	)
}

export function startBackgroundRunner() {
	AlertActionCreators.openAlert(key, <Host />)
}
export function stopBackgroundRunner() {
	AlertActionCreators.dismissAlert(key)
}
