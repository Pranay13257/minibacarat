"use client";
import WinsList from "@/components/WinsList";
import { useEffect, useRef, useState, useCallback } from "react";

export default function MiniBaccaratDashboard() {
  // Live stats and game state
  const [stats, setStats] = useState({
    banker_wins: 0,
    player_wins: 0,
    ties: 0,
    player_pairs: 0,
    banker_pairs: 0,
    player_naturals: 0,
    banker_naturals: 0,
  });
  const [gameState, setGameState] = useState({
    min_bet: 0,
    max_bet: 0,
    table_number: "",
  });
  const [beadPlate, setBeadPlate] = useState<any[][]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Derived values
  const naturals = stats.player_naturals + stats.banker_naturals;
  const games = stats.player_wins + stats.banker_wins + stats.ties;

  // Function to update bead plate - memoized with useCallback
  const updateBeadPlate = useCallback(async () => {
    try {
      console.log("Updating bead plate...");
      const res = await fetch("/api/get-wins");
      const data = await res.json();
      console.log("Bead plate data:", data.length, "games");
      
      // Reverse to oldest to newest
      const ordered = [...data].reverse();
      // Fill column-wise, 6 rows per column
      const maxRows = 6;
      const grid: any[][] = [];
      let col = 0, row = 0;
      ordered.forEach((game: any) => {
        if (!grid[col]) grid[col] = [];
        grid[col][row] = game;
        row++;
        if (row >= maxRows) {
          row = 0;
          col++;
        }
      });
      setBeadPlate(grid);
      console.log("Bead plate updated successfully");
    } catch (e) {
      console.error("Error updating bead plate:", e);
    }
  }, []);

  // Initial load of bead plate
  useEffect(() => {
    updateBeadPlate();
  }, [updateBeadPlate]);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    function connect() {
      ws = new WebSocket("ws://localhost:6789");
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log("WebSocket connected, requesting stats...");
        ws.send(JSON.stringify({ action: "get_stats" }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message received:", data.action);
          
          if (data.action === "stats") {
            console.log("Stats updated, updating bead plate...");
            setStats({
              banker_wins: data.banker_wins,
              player_wins: data.player_wins,
              ties: data.ties,
              player_pairs: data.player_pairs,
              banker_pairs: data.banker_pairs,
              player_naturals: data.player_naturals,
              banker_naturals: data.banker_naturals,
            });
            // Update bead plate whenever stats are updated
            updateBeadPlate();
          }
          
          if (data.action === "game_state" || data.action === "game_result") {
            setGameState((prev) => ({
              ...prev,
              min_bet: data.min_bet ?? prev.min_bet,
              max_bet: data.max_bet ?? prev.max_bet,
              table_number: data.table_number ?? prev.table_number,
            }));
          }
          
          if (data.action === "refresh_stats") {
            console.log("Refresh stats received, updating...");
            ws.send(JSON.stringify({ action: "get_stats" }));
          }
          
          if (data.action === "game_won" || data.action === "delete_all_wins" || data.action === "delete_win") {
            console.log("Game action received, updating bead plate...");
            updateBeadPlate();
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };
      
      ws.onclose = () => {
        console.log("WebSocket disconnected, reconnecting...");
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, 3000);
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.close();
      };
    }
    
    connect();
    
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [updateBeadPlate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 to-yellow-200 p-4">
      {/* Main Container with Gold Border */}
      <div className="max-w-7xl mx-auto bg-gradient-to-br from-red-800 to-red-900 border-8 border-yellow-400 rounded-lg shadow-2xl overflow-hidden">
        {/* Ornate Header Section */}
        <div className="relative bg-gradient-to-r from-red-900 via-red-800 to-red-900 border-b-4 border-yellow-400">
          {/* Top Row with Legend, Game Info, and Result Legend */}
          <div className="grid grid-cols-3 gap-4 p-4">
            {/* Player/Banker Legend (Top Left) */}
            <div className="bg-red-800 border-2 border-yellow-400 rounded-lg p-4">
              <div className="text-yellow-400 font-bold text-lg mb-3 text-center">Player Banker</div>
              <div className="grid grid-cols-2 gap-4">
                {/* Player Column */}
                <div className="space-y-3">
                  <div className="text-yellow-300 text-sm font-semibold text-center">Player</div>
                  <div className="flex flex-col items-center gap-2">
                    {/* Solid Circle */}
                    <div className="w-5 h-5 bg-green-500 rounded-full border border-yellow-400"></div>
                    {/* Hollow Circle */}
                    <div className="w-5 h-5 border-2 border-green-500 rounded-full bg-transparent"></div>
                    {/* Line */}
                    <div className="w-6 h-1 bg-green-500 border border-yellow-400"></div>
                  </div>
                </div>

                {/* Banker Column */}
                <div className="space-y-3">
                  <div className="text-yellow-300 text-sm font-semibold text-center">Banker</div>
                  <div className="flex flex-col items-center gap-2">
                    {/* Solid Circle */}
                    <div className="w-5 h-5 bg-purple-600 rounded-full border border-yellow-400"></div>
                    {/* Hollow Circle */}
                    <div className="w-5 h-5 border-2 border-purple-600 rounded-full bg-transparent"></div>
                    {/* Line */}
                    <div className="w-6 h-1 bg-purple-600 border border-yellow-400"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Game Info (Top Center) */}
            <div className="text-center">
              {/* Main Title */}
              <div className="bg-red-900 border-4 border-yellow-400 rounded-lg px-8 py-4 mb-4 shadow-lg">
                <h1 className="text-4xl font-serif font-bold text-yellow-400 tracking-wider drop-shadow-lg">
                  MINI BACCARAT
                </h1>
              </div>

              {/* Games Counter */}
              <div className="text-yellow-400 text-2xl font-bold mb-2">Games</div>
              <div className="text-yellow-300 text-3xl font-bold mb-2">{games}</div>
              {/* Bets and Table Number */}
              <div className="flex flex-col items-center gap-1">
                <div className="text-yellow-400 text-lg font-bold">Table: <span className="text-yellow-300">{gameState.table_number || "-"}</span></div>
                <div className="text-yellow-400 text-lg font-bold">Max: <span className="text-yellow-300">{gameState.max_bet || "-"}</span></div>
                <div className="text-yellow-400 text-lg font-bold">Min: <span className="text-yellow-300">{gameState.min_bet || "-"}</span></div>
              </div>
            </div>

            {/* Result Legend (Top Right) */}
            <div className="bg-red-800 border-2 border-yellow-400 rounded-lg p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-yellow-300">Player Wins :{stats.player_wins}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
                  <span className="text-yellow-300">Banker Wins :{stats.banker_wins}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-yellow-300">Tie :{stats.ties}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-yellow-300">Naturals :{naturals}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <span className="text-yellow-300">Player Pair :{stats.player_pairs}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-700 rounded-full"></div>
                  <span className="text-yellow-300">Banker Pair :{stats.banker_pairs}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid Section */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6 h-[600px]">
            {/* Left Column */}
            <div className="grid grid-rows-2 gap-6">
              {/* Bead Plate */}
              <div className="bg-red-800 border-4 border-yellow-400 rounded-lg p-4 relative overflow-hidden">
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                  <h2 className="text-yellow-400 font-bold text-2xl tracking-wider drop-shadow-lg">BEAD PLATE</h2>
                </div>
                <div className="mt-12 h-full">
                  {/* Bead Plate Grid */}
                  <div className="grid grid-cols-6 gap-2 h-full">
                    {Array.from({ length: 6 }).map((_, colIdx) => (
                      <div key={colIdx} className="flex flex-col items-center">
                        {Array.from({ length: 6 }).map((_, rowIdx) => {
                          const game = beadPlate[colIdx]?.[rowIdx];
                          let color = "", label = "";
                          if (game) {
                            if (game.winner === "player") {
                              color = "bg-green-500";
                              label = "P";
                            } else if (game.winner === "banker") {
                              color = "bg-purple-600";
                              label = "B";
                            } else if (game.winner === "tie") {
                              color = "bg-blue-500";
                              label = "T";
                            }
                          }
                          return (
                            <div key={rowIdx} className="w-8 h-8 border border-yellow-400/30 rounded-full flex items-center justify-center text-white font-bold text-lg mb-1" style={{ backgroundColor: game ? undefined : "rgba(185,28,28,0.2)" }}>
                              {game ? <span className={`${color} w-full h-full flex items-center justify-center rounded-full`}>{label}</span> : null}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Big Road */}
              <div className="bg-red-800 border-4 border-yellow-400 rounded-lg p-4 relative overflow-hidden">
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                  <h2 className="text-yellow-400 font-bold text-2xl tracking-wider drop-shadow-lg">BIG ROAD</h2>
                </div>
                <div className="mt-12 h-full">
                  {/* Placeholder for WebSocket data */}
                  <div className="grid grid-cols-8 gap-1 h-full">
                    {/* useEffect hook will populate this with streak patterns */}
                    {Array.from({ length: 48 }).map((_, i) => (
                      <div key={i} className="w-6 h-6 border border-yellow-400/30 rounded bg-red-700/50"></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="grid grid-rows-3 gap-6">
              {/* Big Eye Boy */}
              <div className="bg-red-800 border-4 border-yellow-400 rounded-lg p-4 relative overflow-hidden">
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
                  <h2 className="text-yellow-400 font-bold text-xl tracking-wider drop-shadow-lg">BIG EYE BOY</h2>
                </div>
                <div className="mt-10 h-full">
                  {/* Placeholder for WebSocket data */}
                  <div className="grid grid-cols-6 gap-1 h-full">
                    {/* useEffect hook will populate this with pattern analysis */}
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div key={i} className="w-4 h-4 border border-yellow-400/30 rounded-full bg-red-700/50"></div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Small Road */}
              <div className="bg-red-800 border-4 border-yellow-400 rounded-lg p-4 relative overflow-hidden">
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
                  <h2 className="text-yellow-400 font-bold text-xl tracking-wider drop-shadow-lg">SMALL ROAD</h2>
                </div>
                <div className="mt-10 h-full">
                  {/* Placeholder for WebSocket data */}
                  <div className="grid grid-cols-6 gap-1 h-full">
                    {/* useEffect hook will populate this with small road patterns */}
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div key={i} className="w-4 h-4 border border-yellow-400/30 rounded bg-red-700/50"></div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cockroach Pig */}
              <div className="bg-red-800 border-4 border-yellow-400 rounded-lg p-4 relative overflow-hidden">
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
                  <h2 className="text-yellow-400 font-bold text-xl tracking-wider drop-shadow-lg">COCKROACH PIG</h2>
                </div>
                <div className="mt-10 h-full">
                  {/* Placeholder for WebSocket data */}
                  <div className="grid grid-cols-6 gap-1 h-full">
                    {/* useEffect hook will populate this with cockroach pig patterns */}
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div key={i} className="w-4 h-4 border border-yellow-400/30 rounded bg-red-700/50"></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-r from-red-900 via-red-800 to-red-900 border-t-4 border-yellow-400 p-4">
          <p className="text-center text-yellow-300 text-sm font-medium">
            This is the result display screen. All table results and management's decision will be final.
          </p>
        </div>
      </div>
    </div>
  )
}
