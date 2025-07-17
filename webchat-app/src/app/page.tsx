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
  const [smallRoad, setSmallRoad] = useState<any[][]>([]);
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
    let tempSR = [];
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
        tempSR.push(tempCol);
        tempCol = [];
        tempCol.push(tempStore[i]);
        prev = tempStore[i].tempo;
      }
    }

    if(tempCol.length > 0){
      tempSR.push(tempCol);
      tempCol = [];
    }

    setSmallRoad(tempSR);
  },[bigRoad])

  useEffect(() => {
    console.log("SmallRoad updated:", smallRoad);
  }, [smallRoad]);

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
          className="col-start-1 col-end-13 row-start-1 row-end-4 flex justify-center items-center relative z-15"
          style={{
            backgroundImage: "url('/assets/wood.png')",
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        >
          <img src="/assets/mini_baccarat.png" className="relative top-[-5vh] h-[20vh] z-50"/>
        </div>


        <div className="col-start-3 col-end-5 row-start-2 row-end-5 bg-darkRed border-8 border-yellow-500 rounded-tl-3xl rounded-br-3xl m-0.5 flex flex-row justify-around items-center p-4 relative z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="text-3xl text-yellow-500">Player</div>
            <img src="/assets/box_bc.png" className="w-10 h-10"/>
            <img src="/assets/box_bhc.png" className="w-10 h-10"/>
            <img src="/assets/box_blc.png" className="w-10 h-10"/>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="text-3xl text-yellow-500">Banker</div>
            <img src="/assets/box_rc.png" className="w-10 h-10"/>
            <img src="/assets/box_rhc.png" className="w-10 h-10"/>
            <img src="/assets/box_rlc.png" className="w-10 h-10"/>
          </div>
        </div>
        <div className="col-start-5 col-end-7 row-start-2 row-end-5 bg-darkRed border-8 border-yellow-500 rounded-br-3xl rounded-bl-3xl m-0.5 flex flex-col justify-center items-center relative z-10">
          <div className="text-3xl text-yellow-500">
            Games
          </div>
          <div className="text-3xl text-yellow-500">
            {games}
          </div>
        </div>
        <div className="col-start-7 col-end-9 row-start-2 row-end-5 bg-darkRed border-8 border-yellow-500 rounded-bl-3xl rounded-br-3xl m-0.5 flex flex-col justify-center items-center relative z-10">
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
        <div className="col-start-9 col-end-11 row-start-2 row-end-5 bg-darkRed border-8 border-yellow-500 rounded-tr-3xl rounded-bl-3xl m-0.5 flex flex-col justify-center items-center relative z-10">
          <div className="flex flex-col justify-center items-start mt-1">
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
        </div>


        <img src="/assets/golden_d.png" className="col-start-5 col-end-9 row-start-4 row-end-7 relative z-5"/>


        <div className="col-start-1 col-end-7 row-start-5 row-end-13 pl-2 pb-2 pt-2 grid grid-rows-2 h-full z-50">
          <div className="border-4 border-yellow-500 grid grid-cols-11 grid-rows-5">
            <div className="col-start-5 col-end-7 row-start-3 row-end-4 flex justify-center items-center">
              <div className="text-6xl opacity-50 z-20 text-[#915A14]">Bead Plate</div>
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


          <div className="border-4 border-yellow-500 grid grid-cols-11 grid-rows-5">
            <div className="col-start-5 col-end-7 row-start-3 row-end-4 flex justify-center items-center">
              <div className="text-6xl opacity-50 text-[#915A14]">Big Road</div>
            </div>
            {/* Dragon tail logic with diagonal up-right slide for collisions start */}
            {(() => {
              const maxRows = 5;
              let positions = [];
              let grid: Record<string, boolean> = {};
              let col = 0;
              for (let streakIdx = 0; streakIdx < bigRoad.length; streakIdx++) {
                const streak = bigRoad[streakIdx];
                if (streak.length <= maxRows) {
                  for (let i = 0; i < streak.length; i++) {
                    let targetCol = col;
                    let targetRow = i;
                    // Slide diagonally up-right if collision
                    while (grid[`${targetCol},${targetRow}`]) {
                      targetCol++;
                      targetRow--;
                      if (targetRow < 0) break;
                    }
                    if (targetRow >= 0) {
                      positions.push({ bead: streak[i], col: targetCol, row: targetRow });
                      grid[`${targetCol},${targetRow}`] = true;
                    }
                  }
                  col++; // Next streak starts in next column
                } else {
                  // Fill the column vertically
                  for (let i = 0; i < maxRows; i++) {
                    let targetCol = col;
                    let targetRow = i;
                    // Slide diagonally up-right if collision
                    while (grid[`${targetCol},${targetRow}`]) {
                      targetCol++;
                      targetRow--;
                      if (targetRow < 0) break;
                    }
                    if (targetRow >= 0) {
                      positions.push({ bead: streak[i], col: targetCol, row: targetRow });
                      grid[`${targetCol},${targetRow}`] = true;
                    }
                  }
                  // Remaining beads go to the right, all at the bottom row
                  let tailCol = col + 1;
                  let tailRow = maxRows - 1;
                  for (let i = maxRows; i < streak.length; i++) {
                    let targetCol = tailCol;
                    let targetRow = tailRow;
                    // Slide diagonally up-right if collision
                    while (grid[`${targetCol},${targetRow}`]) {
                      targetCol++;
                      targetRow--;
                      if (targetRow < 0) break;
                    }
                    if (targetRow >= 0) {
                      positions.push({ bead: streak[i], col: targetCol, row: targetRow });
                      grid[`${targetCol},${targetRow}`] = true;
                    }
                    tailCol = targetCol + 1;
                  }
                  col++; // Next streak starts in next column
                }
              }
              return positions.map(({ bead: cell, col, row }, idx) => {
                let imgSrc = "";
                if (cell.winner === "player") imgSrc = "/assets/bhcz.png";
                else if (cell.winner === "banker") imgSrc = "/assets/rhcz.png";
                return (
                  <div
                    key={`${col}-${row}-${cell.tie_count || 0}-BigRoad`}
                    className={`col-start-${col+1} col-end-${col+2} row-start-${row+1} row-end-${row+2} z-50 relative`}
                  >
                    {imgSrc && (
                      <img
                        src={imgSrc}
                        className="w-12 h-12 absolute transform -translate-x-1/2 -translate-y-1/2 top-[50%] left-[50%]"
                        alt={cell.winner}
                      />
                    )}
                    {cell.tie_count >= 1 && cell.tie_count <= 8 && (
                      Array.from({ length: cell.tie_count }, (_, index) => (
                        <img
                          key={`line${index + 1}`}
                          src={`/assets/line${index + 1}.png`}
                          className="w-12 h-12 absolute transform -translate-x-1/2 -translate-y-1/2 top-[50%] left-[50%]"
                          alt={`tie-line-${index + 1}`}
                        />
                      ))
                    )}
                    {cell.player_pair ? (
                      <img src="/assets/player (2).png" className="w-12 h-12 absolute transform -translate-x-1/2 -translate-y-1/2 top-[50%] left-[50%] z-50"/>
                    ) : null}
                    {cell.banker_pair ? (
                      <img src="/assets/banker (1).png" className="w-12 h-12 absolute transform -translate-x-1/2 -translate-y-1/2 top-[50%] left-[50%] z-50"/>
                    ) : null}
                    {(cell.banker_natural || cell.player_natural) ? (
                      <img src="/assets/natural.png" className="w-12 h-12 absolute transform -translate-x-1/2 -translate-y-1/2 top-[50%] left-[50%] z-100"/>
                    ) : null}
                  </div>
                );
              });
            })()}
            {/* Dragon tail logic with diagonal up-right slide for collisions end */}
          </div>
        </div>

        
        <div className="col-start-7 col-end-13 row-start-5 row-end-13 pr-2 pb-2 pt-2 grid grid-rows-3 h-full z-50">
          <div className="border-4 border-yellow-500 grid grid-cols-11 grid-rows-4">
            <div className="col-start-5 col-end-8 row-start-2 row-end-4 flex justify-center items-center">
              <div className="text-4xl opacity-50 z-20 text-[#915A14]">Big Eye Boy</div>
            </div>
            {(() => {
              const maxRow = 4;
              let positions = [];
              let grid: Record<string, boolean> = {};
              for(let i=0; i<=11;i++){
                grid[`${i},${5}`] = true;
                grid[`${i},${6}`] = true;
                grid[`${i},${7}`] = true;
                grid[`${i},${8}`] = true;
                grid[`${i},${9}`] = true;
                grid[`${i},${10}`] = true;
                grid[`${i},${11}`] = true;
                grid[`${i},${12}`] = true;
                grid[`${i},${13}`] = true;
                grid[`${i},${14}`] = true;
                grid[`${i},${15}`] = true;
                grid[`${i},${16}`] = true;
              }
              for(let col=0;col < smallRoad.length;col++){
                for(let row=0;row < smallRoad[col].length;row++){
                  let tempRow = row+1;
                  let tempCol = col+1;
                  while(grid[`${tempCol},${tempRow}`]){
                    tempCol++;
                    tempRow--;
                  }
                  positions.push({tempo:smallRoad[col][row].tempo, col:tempCol, row:tempRow});
                  grid[`${tempCol},${tempRow}`] = true;
                }
              }
              return positions.map(({ tempo, col, row }, idx) => {
                let imgSrc = "";
                if (tempo === "stable") imgSrc = "/assets/bhcz.png";
                else if (tempo === "unstable") imgSrc = "/assets/rhcz.png";
                return (
                  <div
                    key={`${col}-${row}-${tempo}-BigRoad`}
                    className={`col-start-${col} col-end-${col+1} row-start-${row} row-end-${row+1} z-50 relative`}
                  >
                    {imgSrc && (
                      <img
                        src={imgSrc}
                        className="w-12 h-12 absolute transform -translate-x-1/2 -translate-y-1/2 top-[50%] left-[50%]"
                      />
                    )}
                  </div>
                );
              });
            })()}
          </div>
          <div className="border-4 border-yellow-500"></div>
          <div className="border-4 border-yellow-500"></div>
        </div>
      </div>
      <span className="absolute bottom-0 text-black text-xl">This is the display screen. All tables results and management decisions will be final</span>
    </div>
  )
}

