"use client";
import { useState, useRef } from "react";
import { IP } from "../ip";

export default function WebSocketTester() {
  const [url, setUrl] = useState(`ws://${IP}:6789`);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [log, setLog] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const testWS = () => {
    setStatus("Connecting...");
    setError("");
    setLog("");
    if (wsRef.current) wsRef.current.close();
    let ws;
    try {
      ws = new WebSocket(url);
      wsRef.current = ws;
    } catch (e: any) {
      setStatus("Failed to create WebSocket");
      setError(e.toString());
      return;
    }
    ws.onopen = () => {
      setStatus("✅ Connected!");
    };
    ws.onerror = (e) => {
      setStatus("❌ Error!");
      setError("WebSocket error (see browser console for details)");
      console.error("WebSocket error:", e);
    };
    ws.onclose = (e) => {
      setStatus("🔌 Disconnected");
      setLog(`Code: ${e.code}, Reason: ${e.reason}`);
    };
    ws.onmessage = (msg) => {
      setLog("Received: " + msg.data);
    };
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2em', maxWidth: 500, margin: 'auto', backgroundColor: 'white' }}>
      <h2 style={{ color: 'black' }}>WebSocket Connection Tester</h2>
      <label style={{ color: 'black' }}>
        WebSocket URL:
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          style={{ width: '100%', marginBottom: 8, color: 'black', backgroundColor: 'white', border: '1px solid #ccc' }}
        />
      </label>
      <button onClick={testWS} style={{ marginBottom: 16, display: 'block', color: 'white', backgroundColor: 'black', border: 'none', padding: '8px 16px', borderRadius: 4 }}>Test Connection</button>
      <div style={{ fontWeight: 'bold', marginBottom: 8, color: 'black' }}>{status}</div>
      <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>
      <div style={{ fontSize: '0.9em', color: 'black', backgroundColor: 'white', border: '1px solid #eee', padding: 8, borderRadius: 4 }}>{log}</div>
    </div>
  );
}