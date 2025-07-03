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
    <div className="min-h-screen bg-darkBrown flex flex-col justify-center items-center">
      <div className="h-[95vh] w-[97vw] m-4 border-[1rem] border-randomBrown bg-midRed grid grid-cols-12 grid-rows-12">
        <div
          className="col-start-1 col-end-13 row-start-1 row-end-4 flex justify-center items-center"
          style={{
            backgroundImage: "url('/assets/wood.png')",
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        >
          <img src="/assets/mini_baccarat.png" className="relative top-[-5vh] h-[20vh]"/>
        </div>
        <div className="col-start-3 col-end-5 row-start-2 row-end-5 bg-darkRed border-8 border-yellow-500 rounded-tl-3xl rounded-br-3xl m-0.5">
          <div className="flex flex-row justify-around items-center p-4">
            <div className="flex flex-col">
              <div className="text-3xl text-yellow-500">Player</div>
            </div>
            <div className="flex flex-col">
              <div className="text-3xl text-yellow-500">Banker</div>
            </div>
          </div>
        </div>
        <div className="col-start-5 col-end-7 row-start-2 row-end-5 bg-darkRed border-8 border-yellow-500 rounded-br-3xl rounded-bl-3xl m-0.5 flex flex-col justify-center items-center">
          <div className="text-3xl text-yellow-500">
            Games
          </div>
          <div className="text-3xl text-yellow-500">
            {games}
          </div>
        </div>
        <div className="col-start-7 col-end-9 row-start-2 row-end-5 bg-darkRed border-8 border-yellow-500 rounded-bl-3xl rounded-br-3xl m-0.5 flex flex-col justify-center items-center">
          <div className="text-3xl text-yellow-500">
            Bets
          </div>
          <div className="text-3xl text-yellow-500">
            Max: {gameState.max_bet}
          </div>
          <div className="text-3xl text-yellow-500">
            Min: {gameState.min_bet}
          </div>
        </div>
        <div className="col-start-9 col-end-11 row-start-2 row-end-5 bg-darkRed border-8 border-yellow-500 rounded-tr-3xl rounded-bl-3xl m-0.5 flex flex-col justify-center items-center">
          <div className="flex flex-col justify-center items-start gap-2">
            <div className="flex flex-row gap-4">
              <img src="/assets/gc.png" className="w-8 h-8"/>
              <div className="text-2xl text-yellow-500">Player Wins :{stats.player_wins}</div>
            </div>
            <div className="flex flex-row gap-4">
              <img src="/assets/pc.png" className="w-8 h-8"/>
              <div className="text-2xl text-yellow-500">Banker Wins :{stats.banker_wins}</div>
            </div>
            <div className="flex flex-row gap-4">
              <img src="/assets/rc.png" className="w-8 h-8"/>
              <div className="text-2xl text-yellow-500">Tie :{stats.ties}</div>
            </div>
            <div className="flex flex-row gap-4">
              <img src="/assets/yc.png" className="w-8 h-8"/>
              <div className="text-2xl text-yellow-500">Naturals :{naturals}</div>
            </div>
            <div className="flex flex-row gap-4">
              <img src="/assets/ppc.png" className="w-8 h-8"/>
              <div className="text-2xl text-yellow-500">Player pair :{stats.player_pairs}</div>
            </div>
            <div className="flex flex-row gap-4">
              <img src="/assets/bpc.png" className="w-8 h-8"/>
              <div className="text-2xl text-yellow-500">Banker pair :{stats.banker_pairs}</div>
            </div>
          </div>
        </div>
      </div>
      <span className="absolute bottom-0 text-black">This is the display screen. All tables results and management decisions will be final</span>
    </div>
  )
}
