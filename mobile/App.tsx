import type React from "react";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView as RawWebView, type WebViewMessageEvent } from "react-native-webview";
import { parseMessage, replyScript, WEB_ERROR_HOOK } from "./src/messages";
import { handleMessage } from "./src/native";
import { recoverFromKilledPage } from "./src/webViewRecovery";

// react-native-webview 14's published prop types collapse to `never` under React Native 0.88's
// types, so type just the props this app uses.
interface WebViewProps {
  ref?: React.Ref<WebViewHandle>;
  source: { uri: string };
  onMessage: (event: WebViewMessageEvent) => void;
  injectedJavaScriptBeforeContentLoaded: string;
  webviewDebuggingEnabled: boolean;
  onLoadEnd: () => void;
  onError: (event: { nativeEvent: { description: string } }) => void;
  onHttpError: (event: { nativeEvent: { statusCode: number } }) => void;
  onContentProcessDidTerminate: () => void;
  allowsBackForwardNavigationGestures: boolean;
  style: object;
}
interface WebViewHandle { injectJavaScript: (script: string) => void; reload: () => void }
const WebView = RawWebView as unknown as React.ComponentType<WebViewProps>;

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL;

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
}

export default function App() {
  const webView = useRef<WebViewHandle>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!WEB_URL) {
    return <FatalError text="EXPO_PUBLIC_WEB_URL is not set. Copy .env.local.example to .env.local and fill it in." />;
  }

  async function onMessage(event: WebViewMessageEvent) {
    let id: number | undefined;
    try {
      const message = parseMessage(event.nativeEvent.data);
      id = message.id;
      if (message.type === "webError") {
        setError(String(message.payload));
        return;
      }
      const result = await handleMessage(message);
      if (id !== undefined) webView.current?.injectJavaScript(replyScript(id, true, result));
    } catch (err) {
      // Requests with an id get the error back so the web app's showError modal displays it;
      // fire-and-forget messages have no caller waiting, so show it in the banner instead.
      const text = errorText(err);
      if (id !== undefined) webView.current?.injectJavaScript(replyScript(id, false, text));
      else setError(text);
    }
  }

  return (
    <SafeAreaProvider>
      {/* Top inset only: the web app pads its own bottom nav for the home indicator, so a
          native bottom inset would add a second strip of empty space under it. */}
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#111827" }}>
        <StatusBar style="light" />
        <WebView
          ref={webView}
          source={{ uri: WEB_URL }}
          onMessage={onMessage}
          injectedJavaScriptBeforeContentLoaded={WEB_ERROR_HOOK}
          webviewDebuggingEnabled
          onLoadEnd={() => setLoading(false)}
          onError={(e) => setError(`Failed to load ${WEB_URL}: ${e.nativeEvent.description}`)}
          onHttpError={(e) => setError(`Failed to load ${WEB_URL}: HTTP ${e.nativeEvent.statusCode}`)}
          onContentProcessDidTerminate={() => {
            try {
              recoverFromKilledPage(webView.current, setLoading);
            } catch (err) {
              setLoading(false);
              setError(errorText(err));
            }
          }}
          allowsBackForwardNavigationGestures
          style={{ flex: 1, backgroundColor: "#111827" }}
        />
        {loading && (
          <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#111827" }}>
            <ActivityIndicator size="large" color="#818cf8" />
            <Text style={{ color: "#9ca3af", marginTop: 12 }}>Loading…</Text>
          </View>
        )}
        {error && (
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "50%", backgroundColor: "#7f1d1d", padding: 12 }}>
            <ScrollView>
              <Text selectable style={{ color: "white", fontFamily: "Menlo", fontSize: 12 }}>{error}</Text>
            </ScrollView>
            <Pressable onPress={() => setError(null)} style={{ marginTop: 8 }}>
              <Text style={{ color: "white", fontWeight: "600" }}>Dismiss</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function FatalError({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#111827" }}>
      <Text selectable style={{ color: "white" }}>{text}</Text>
    </View>
  );
}
