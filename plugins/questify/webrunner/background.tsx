import * as react from '@valenced/react'
import {
	cloneElement,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore,
} from 'react'
import { View } from 'react-native'
import { logRequest } from '../completion/service'
import { fiberChain } from './ancestors'
import { BEFORE_LOAD, RUN_SCRIPT, USER_AGENT } from './script'
import { resolveWebView } from './webview'
import type { ReactElement } from 'react'
import type { WebHandle } from './webview'

// Experiment: navigator content wraps every screen, so a hidden 1px web view added
// there stays mounted while the user moves around Discord. Every navigator shares
// that component type, so only the shallowest copy (the root stack) runs a web view.
const tick =
	"window.ReactNativeWebView.postMessage(JSON.stringify({type:'status',data:'tick '+new Date().toTimeString().slice(0,8)}));true;"

const registry = new Map<object, number>()
const listeners = new Set<() => void>()
let version = 0
let enabled = false
function change() {
	version++
	for (const listener of listeners) listener()
}
function subscribe(listener: () => void) {
	listeners.add(listener)
	return () => void listeners.delete(listener)
}
function activeOwner() {
	let best: object | undefined
	for (const [key, depth] of registry)
		if (best === undefined || depth < (registry.get(best) ?? Infinity))
			best = key
	return best
}

function Host() {
	const WebView = useMemo(resolveWebView, [])
	const web = useRef<WebHandle>(null)
	const view = useRef<unknown>(null)
	const id = useRef({}).current
	useSyncExternalStore(subscribe, () => version)
	useEffect(() => {
		registry.set(id, fiberChain(view.current).length)
		change()
		return () => {
			registry.delete(id)
			change()
		}
	}, [id])
	const isActive = enabled && !!WebView && activeOwner() === id
	useEffect(() => {
		if (!isActive) return
		logRequest(`background host mounted, depth=${registry.get(id)}`)
		const start = setTimeout(() => {
			web.current?.injectJavaScript(RUN_SCRIPT)
			web.current?.injectJavaScript(tick)
		}, 8000)
		const retry = setInterval(() => {
			web.current?.injectJavaScript(RUN_SCRIPT)
			web.current?.injectJavaScript(tick)
		}, 30000)
		return () => {
			clearTimeout(start)
			clearInterval(retry)
			logRequest('background host unmounted')
		}
	}, [isActive, id])
	return (
		<View
			ref={view as never}
			collapsable={false}
			pointerEvents="none"
			style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01 }}
		>
			{isActive && WebView && (
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
			)}
		</View>
	)
}

let unpatch: (() => void) | undefined
export function startBackgroundRunner(probe: unknown): string {
	const afterJSX = (react as { afterJSX?: unknown }).afterJSX as
		| ((
				type: unknown,
				hook: (element: ReactElement) => ReactElement,
		  ) => () => void)
		| undefined
	if (!afterJSX) return 'afterJSX is unavailable in this Valenced version.'
	const content = fiberChain(probe).find(entry => entry.name === 'NavigationContent')
	if (!content) return 'NavigationContent was not found above this screen.'
	enabled = true
	if (!unpatch)
		unpatch = afterJSX(content.type, element =>
			cloneElement(
				element,
				{},
				(element.props as { children?: unknown }).children as never,
				<Host key="questify-background" />,
			),
		)
	change()
	return 'Started. Press Back and move around Discord, then check the request log.'
}
export function stopBackgroundRunner() {
	enabled = false
	unpatch?.()
	unpatch = undefined
	change()
}
