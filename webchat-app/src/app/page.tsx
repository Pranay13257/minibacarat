"use client";
import WinsList from "@/components/WinsList";
import { useEffect, useRef, useState, useCallback } from "react";
import { IP } from "./ip";
import { div } from "framer-motion/client";

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
  const [bigRoad, setBigRoad] = useState<any[][]>([]);
  const [BEB, setBEB] = useState<any[][]>([]);
  const [smallRoad, setSmallRoad] = useState<any[][]>([]);
  const [cp, setCP] = useState<any[][]>([]);
  const [brDragonTail,setBrDragonTain] = useState<any[]>([]); 
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
      console.log(data);
      
      // Reverse to oldest to newest
      const ordered = [...data].reverse();
      // Fill column-wise, 6 rows per column
      const maxRows = 5;
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
      ws = new WebSocket(`ws://${IP}:6789`);
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


  useEffect(() => {
    const results = [];
    for (let col = 0; col < beadPlate.length; col++) {
      for (let row = 0; row < beadPlate[col].length; row++) {
        const game = beadPlate[col][row];
        if (game) results.push(game);
      }
    }

    let currBigRoad = [];
    let tempcol: Array<{
      winner: string;
      tie_count: number;
      is_super_six?: boolean;
      player_pair?: boolean;
      banker_pair?: boolean;
      player_natural?: boolean;
      banker_natural?: boolean;
    }> = [];

    let currWinner: string|null;
    results.forEach((game,idx) => {
      if(!currWinner) currWinner = game.winner;
      if(game.winner == currWinner){
        tempcol.push({
          'winner' : game.winner,
          'tie_count':0,
          'is_super_six' : game.is_super_six,
          'player_pair' : game.player_pair,
          'banker_pair' : game.banker_pair,
          'player_natural' : game.player_natural,
          'banker_natural' : game.banker_natural
        })
      }
      else if(game.winner == 'tie'){
        if (tempcol.length > 0) {
          tempcol[tempcol.length - 1].tie_count += 1;
        }
      }
      else{
        currBigRoad.push(tempcol);
        tempcol = [];
        currWinner = game.winner;
        tempcol.push({
          'winner' : game.winner,
          'tie_count':0,
          'is_super_six' : game.is_super_six,
          'player_pair' : game.player_pair,
          'banker_pair' : game.banker_pair,
          'player_natural' : game.player_natural,
          'banker_natural' : game.banker_natural
        })
      }
    })

    if(tempcol.length > 0){
      currBigRoad.push(tempcol);
      tempcol = [];
    }

    setBigRoad(currBigRoad);
  }, [beadPlate])

  useEffect(() => {
    console.log("bigRoad updated:", bigRoad);
  }, [bigRoad]);

  useEffect(() => {
    let tempBEB = [];
    let tempStore = [];

    for(let i=0;i<bigRoad.length;i++){
      for(let j=0;j<bigRoad[i].length;j++){
        if(i < 2) continue;
        if(j == 0){
          if(bigRoad[i-1].length == bigRoad[i-2].length){
            tempStore.push({tempo:"stable"});
          }
          else{
            tempStore.push({tempo:"unstable"});
          }
        }
        else{
          if(bigRoad[i-1].length == j){
            tempStore.push({tempo:"unstable"})
          }
          else{
            tempStore.push({tempo:"stable"});
          }
        }
      }
    }

    console.log("tempstore:" + tempStore);
    let prev = '';
    let tempCol = [];
    for(let i=0;i<tempStore.length;i++){
      if(!prev){
        prev = tempStore[i].tempo;
      }
      if(tempStore[i].tempo == prev){
        tempCol.push(tempStore[i]);
      }
      else{
        tempBEB.push(tempCol);
        tempCol = [];
        tempCol.push(tempStore[i]);
        prev = tempStore[i].tempo;
      }
    }

    if(tempCol.length > 0){
      tempBEB.push(tempCol);
      tempCol = [];
    }

    setBEB(tempBEB);
  },[bigRoad])

  useEffect(() => {
    console.log("BEB updated:", BEB);
  }, [BEB]);

  useEffect(() => {
    let tempSmallRoad = [];
    let tempStore = [];

    for(let i=0;i<bigRoad.length;i++){
      for(let j=0;j<bigRoad[i].length;j++){
        if(i < 3) continue;
        if(j == 0){
          if(bigRoad[i-1].length == bigRoad[i-3].length){
            tempStore.push({tempo:"stable"});
          }
          else{
            tempStore.push({tempo:"unstable"});
          }
        }
        else{
          if(bigRoad[i-2].length == j){
            tempStore.push({tempo:"unstable"})
          }
          else{
            tempStore.push({tempo:"stable"});
          }
        }
      }
    }

    console.log("tempstore:" + tempStore);
    let prev = '';
    let tempCol = [];
    for(let i=0;i<tempStore.length;i++){
      if(!prev){
        prev = tempStore[i].tempo;
      }
      if(tempStore[i].tempo == prev){
        tempCol.push(tempStore[i]);
      }
      else{
        tempSmallRoad.push(tempCol);
        tempCol = [];
        tempCol.push(tempStore[i]);
        prev = tempStore[i].tempo;
      }
    }

    if(tempCol.length > 0){
      tempSmallRoad.push(tempCol);
      tempCol = [];
    }

    setSmallRoad(tempSmallRoad);
  },[bigRoad])

  useEffect(() => {
    console.log("smallRoad updated:", smallRoad);
  }, [smallRoad]);

  useEffect(() => {
    let tempCP = [];
    let tempStore = [];

    for(let i=0;i<bigRoad.length;i++){
      for(let j=0;j<bigRoad[i].length;j++){
        if(i < 4) continue;
        if(j == 0){
          if(bigRoad[i-1].length == bigRoad[i-4].length){
            tempStore.push({tempo:"stable"});
          }
          else{
            tempStore.push({tempo:"unstable"});
          }
        }
        else{
          if(bigRoad[i-3].length == j){
            tempStore.push({tempo:"unstable"})
          }
          else{
            tempStore.push({tempo:"stable"});
          }
        }
      }
    }

    console.log("tempstore:" + tempStore);
    let prev = '';
    let tempCol = [];
    for(let i=0;i<tempStore.length;i++){
      if(!prev){
        prev = tempStore[i].tempo;
      }
      if(tempStore[i].tempo == prev){
        tempCol.push(tempStore[i]);
      }
      else{
        tempCP.push(tempCol);
        tempCol = [];
        tempCol.push(tempStore[i]);
        prev = tempStore[i].tempo;
      }
    }

    if(tempCol.length > 0){
      tempCP.push(tempCol);
      tempCol = [];
    }

    setCP(tempCP);
  },[bigRoad])

  useEffect(() => {
    console.log("CP updated:", cp);
  }, [cp]);

  function BigRoad() {
    const maxRows = 5;
    // Flatten beadPlate into a single array of games in order
    const results = [];
    for (let col = 0; col < beadPlate.length; col++) {
      for (let row = 0; row < beadPlate[col].length; row++) {
        const game = beadPlate[col][row];
        console.log(game);
        if (game) results.push(game);
      }
    }

    let col = 0;
    let row = 0;
    let prevWinner: string | null = null;
    const beads: React.JSX.Element[] = [];
    let tieCount = 0; // Track consecutive ties

    let prevPlayerPair = false;
    let prevBankerPair = false;
    let prevNatural = false;

    results.forEach((game, idx) => {
      const winner = game.winner;
      
      // Always update previous states for every game
      prevPlayerPair = game.player_pair || prevPlayerPair || false;
      prevBankerPair = game.banker_pair || prevBankerPair || false;
      prevNatural = (game.banker_natural || game.player_natural) || prevNatural || false;
      
      // Reset tie count when new winner (non-tie) occurs
      if (winner !== "tie") {
        tieCount = 0;
      } else {
        tieCount++;
      }
      
      if(winner !== "tie"){
        if (winner === prevWinner) {
          row++;
          if (row >= maxRows) {
            col++;
            row = 0;
          }
        } else {
          col++;
          row = 0;
        }
      }
      
      
      let imgSrc = "";
      if (winner === "player") imgSrc = "/assets/bhcz.png";
      else if (winner === "banker") imgSrc = "/assets/rhcz.png";
      
      beads.push(
        <div
          key={`${col}-${row}-${tieCount}-BigRoad`}
          className={`col-start-${col} col-end-${col+1} row-start-${row+1} row-end-${row+2} z-50 relative`}
        >
          {imgSrc ? (
            <img src={imgSrc} className="w-12 h-12 absolute transform -translate-x-1/2 -translate-y-1/2 top-[50%] left-[50%] z-1"/>
            ) : null}
          {winner === "tie" && tieCount >= 1 && tieCount <= 8 ? (
            Array.from({ length: tieCount }, (_, index) => (
              <img 
                key={`line${index + 1}`}
                src={`/assets/line${index + 1}.png`} 
                className="w-12 h-12 absolute transform -translate-x-1/2 -translate-y-1/2 top-[50%] left-[50%]"
              />
            ))
          ) : null}
          {(winner !== "tie" ? game.player_pair : prevPlayerPair) ? (
            <img src="/assets/player (2).png" className="w-12 h-12 absolute transform -translate-x-1/2 -translate-y-1/2 top-[50%] left-[50%] z-50"/>
          ) : null}
          {(winner !== "tie" ? game.banker_pair : prevBankerPair) ? (
            <img src="/assets/banker (1).png" className="w-12 h-12 absolute transform -translate-x-1/2 -translate-y-1/2 top-[50%] left-[50%] z-50"/>
          ) : null}
          {(winner !== "tie" ? (game.banker_natural || game.player_natural) : prevNatural) ? (
            <img src="/assets/natural.png" className="w-12 h-12 absolute transform -translate-x-1/2 -translate-y-1/2 top-[50%] left-[50%] z-100"/>
          ) : null}
        </div>
      );
      if(winner !== "tie")
        prevWinner = winner;
    });

    return beads;
  }

  return (
    <div className="min-h-screen bg-darkBrown flex flex-col justify-center items-center">
      <div className="h-[95vh] w-[97vw] m-4 border-[1rem] border-randomBrown bg-[#EFE6D3] grid grid-cols-12 grid-rows-12">
        <div
          className="col-start-1 col-end-13 row-start-1 row-end-2 flex justify-between items-center relative z-15"
          style={{
            backgroundImage: "url('/assets/wood.png')",
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        >
          <div className="flex flex-row gap-4 min-w-[20vw] justify-around items-center text-xl text-yellow-500">
            <div>Games : {games}</div>
            <div>Table no.  : {gameState.table_number}</div>
          </div>
          <img src="/assets/mini_baccarat.png" className="z-50"/>
          <div className="flex flex-row gap-4 min-w-[20vw] justify-around items-center text-xl text-yellow-500">
            <div>Min bet : {gameState.max_bet}</div>
            <div>Max bet : {gameState.min_bet}</div>
          </div>
        </div>

        <div className="gird row-start-2 row-end-6 col-start-9 col-end-11 border-2 border-yellow-500 grid grid-cols-2 grid-rows-4">
          <div className="row-start-1 row-end-2 col-start-1 col-end-2 text-black text-2xl text-bold flex items-center justify-center">Player</div>
          <div className="row-start-2 row-end-3 col-start-1 col-end-2 text-black flex items-center justify-center">
            <img src="/assets/new_bc.png" className="w-10 h-10"/>
          </div>
          <div className="row-start-3 row-end-4 col-start-1 col-end-2 text-black flex items-center justify-center">
            <img src="/assets/new_bhcz.png" className="w-10 h-10"/>
          </div>
          <div className="row-start-4 row-end-5 col-start-1 col-end-2 text-black flex items-center justify-center">
            <img src="/assets/new_lineBlue.png" className="w-10 h-10"/>
          </div>
          <div className="row-start-1 row-end-2 col-start-2 col-end-3 text-black text-2xl text-bold flex items-center justify-center">Banker</div>
          <div className="row-start-2 row-end-3 col-start-2 col-end-3 text-black flex items-center justify-center">
            <img src="/assets/new_rc.png" className="w-10 h-10"/>
          </div>
          <div className="row-start-3 row-end-4 col-start-2 col-end-3 text-black flex items-center justify-center">
            <img src="/assets/new_rhcz.png" className="w-10 h-10"/>
          </div>
          <div className="row-start-4 row-end-5 col-start-2 col-end-3 text-black flex items-center justify-center">
            <img src="/assets/new_lineRed.png" className="w-10 h-10"/>
          </div>
        </div>

        <div className="gird row-start-2 row-end-6 col-start-11 col-end-13 bg-[darkRed] flex flex-col justify-around items-start pl-4">
          <div className="flex flex-row gap-4 justify-center items-center">
            <img src="/assets/c1.png" className="w-6 h-6"/>
            <div className="text-2xl text-yellow-500">Player Wins : {stats.player_wins}</div>
          </div>
          <div className="flex flex-row gap-4 justify-center items-center">
            <img src="/assets/c2.png" className="w-6 h-6"/>
            <div className="text-2xl text-yellow-500">Banker Wins : {stats.banker_wins}</div>
          </div>
          <div className="flex flex-row gap-4 justify-center items-center">
            <img src="/assets/c3.png" className="w-6 h-6"/>
            <div className="text-2xl text-yellow-500">Tie : {stats.ties}</div>
          </div>
          <div className="flex flex-row gap-4 justify-center items-center">
            <img src="/assets/c4.png" className="w-6 h-6"/>
            <div className="text-2xl text-yellow-500">Naturals : {naturals}</div>
          </div>
          <div className="flex flex-row gap-4 justify-center items-center">
            <img src="/assets/c5.png" className="w-6 h-6"/>
            <div className="text-2xl text-yellow-500">Player pair : {stats.player_pairs}</div>
          </div>
          <div className="flex flex-row gap-4 justify-center items-center">
            <img src="/assets/c6.png" className="w-6 h-6"/>
            <div className="text-2xl text-yellow-500">Banker pair : {stats.banker_pairs}</div>
          </div>
        </div>

        <div className="gird row-start-2 row-end-6 col-start-1 col-end-9 border-2 border-yellow-500 grid grid-cols-11 grid-rows-5">
            <div className="col-start-6 col-end-8 row-start-3 row-end-4 flex justify-center items-center">
              <div className="text-6xl opacity-50 z-20 text-[#915A14] text-center">Bead Plate</div>
            </div>
            {Array.from({length:11}).map((_,colIdx) => (
              Array.from({length:5}).map((_,rowIdx) => {
                // console.log(beadPlate);
                const game = beadPlate[colIdx]?.[rowIdx];
                let imgSrc = "";
                if (game?.winner === "player") {
                  imgSrc = "/assets/c1.png";
                } else if (game?.winner === "banker") {
                  imgSrc = "/assets/c2.png";
                } else if (game?.winner === "tie") {
                  imgSrc = "/assets/c6.png";
                }
                return (
                  <div key={`${colIdx}-${rowIdx}`} className={`col-start-${colIdx+1} col-end-${colIdx+2} row-start-${rowIdx+1} row-end-${rowIdx+2} z-50 relative `}>
                    {imgSrc ? (<img src={imgSrc} className="w-12 h-12 absolute transform -translate-x-1/2 -translate-y-1/2 top-[50%] left-[50%]"/>) : null}
                  </div>
                )
              })
            ))}
        </div>
        <div className="gird row-start-6 row-end-9 col-start-1 col-end-13 border-2 border-yellow-500 grid [grid-template-columns:repeat(20,minmax(0,1fr))] grid-rows-4">
          <div className="col-start-10 col-end-12 row-start-2 row-end-4 flex justify-center items-center">
             <div className="text-6xl opacity-50 text-[#915A14] text-center">Big Road</div>
          </div>
        </div>
        <div className="gird row-start-9 row-end-11 col-start-1 col-end-13 border-2 border-yellow-500 grid [grid-template-columns:repeat(30,minmax(0,1fr))] grid-rows-3">
          <div className="col-start-1 col-end-31 row-start-1 row-end-4 flex justify-center items-center justify-self-center">
             <div className="text-xl opacity-50 text-[#915A14] text-center">Big Eye Boy</div>
          </div>
        </div>
        <div className="gird row-start-11 row-end-13 col-start-7 col-end-13 border-2 border-yellow-500 grid [grid-template-columns:repeat(15,minmax(0,1fr))] grid-rows-3" ></div>
        <div className="gird row-start-11 row-end-13 col-start-1 col-end-7 border-2 border-yellow-500 grid [grid-template-columns:repeat(15,minmax(0,1fr))] grid-rows-3"></div>

      </div>
      <span className="absolute bottom-0 text-black text-xl">This is the display screen. All tables results and management decisions will be final</span>
    </div>
  )
}

