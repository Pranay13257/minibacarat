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
    <div style={{ fontFamily: 'sans-serif', padding: '2em', maxWidth: 500, margin: 'auto' }}>
      <h2>WebSocket Connection Tester</h2>
      <label>
        WebSocket URL:
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          style={{ width: '100%', marginBottom: 8, color:"black"}}
        />
      </label>
      <button onClick={testWS} style={{ marginBottom: 16, display: 'block',color:"white" }}>Test Connection</button>
      <div style={{ fontWeight: 'bold', marginBottom: 8, color:"white"}}>{status}</div>
      <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>
      <div style={{ fontSize: '0.9em', color:"white" }}>{log}</div>
    </div>
  );
}