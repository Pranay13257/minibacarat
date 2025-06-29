"use client";
import { useEffect, useState } from "react";
import WinnerModal from "@/components/WinnerModal";

type WinRecord = {
  _id?: string;
  winner: string; // "player", "banker", or "tie"
  timestamp?: string;
  is_super_six?: boolean;
  player_pair?: boolean;
  banker_pair?: boolean;
  player_natural?: boolean;
  banker_natural?: boolean;
};

const WinsList = () => {
  const [wins, setWins] = useState<WinRecord[]>([]);
  const [groupedWins, setGroupedWins] = useState<WinRecord[][]>([]);
  const [bigEyeBoyGrid, setBigEyeBoyGrid] = useState<number[][]>([]);
  const [beadPlateGrid, setBeadPlateGrid] = useState<number[][]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [minBet, setMinBet] = useState(100);
  const [maxBet, setMaxBet] = useState(10000);
  const [tableNumber, setTableNumber] = useState("1234");
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [winnerData, setWinnerData] = useState<any>(null);

  // Big Road grouping logic
  useEffect(() => {
    const maxRows = 4;
    const newGroupedWins: WinRecord[][] = [];
    const orderedWins = [...wins].reverse(); // oldest to newest

    orderedWins.forEach((win) => {
      const lastCol = newGroupedWins[newGroupedWins.length - 1];
      if (!lastCol) {
        newGroupedWins.push([win]);
        return;
      }

      const lastToken = lastCol[0];
      const isSameWinner = lastToken.winner === win.winner;

      if (isSameWinner) {
        if (lastCol.length < maxRows) {
          lastCol.push(win);
        } else {
          newGroupedWins.push([win]);
        }
      } else {
        newGroupedWins.push([win]);
      }
    });

    setGroupedWins(newGroupedWins.slice(-20)); // Max 20 columns
  }, [wins]);

  // Big Eye Boy logic
  useEffect(() => {
    const patternResults: number[] = [];
    for (let i = 1; i < groupedWins.length; i++) {
      const current = groupedWins[i];
      const previous = groupedWins[i - 1];
      patternResults.push(current.length === previous.length ? 0 : 1);
    }

    const rows = 4;
    const grid: number[][] = [];
    let colIndex = 0;
    let rowIndex = 0;

    patternResults.forEach((val) => {
      if (!grid[colIndex]) grid[colIndex] = [];
      grid[colIndex][rowIndex] = val;
      rowIndex++;
      if (rowIndex >= rows) {
        rowIndex = 0;
        colIndex++;
      }
    });

    setBigEyeBoyGrid(grid);
  }, [groupedWins]);

  // Bead Plate logic
  useEffect(() => {
    const maxRows = 4;
    const newBeadPlateGrid: number[][] = [];
    let col = 0;
    let row = 0;

    [...wins].reverse().forEach((win) => {
      if (!newBeadPlateGrid[col]) newBeadPlateGrid[col] = [];
      // Convert winner string to number: player=0, banker=1, tie=2
      const winnerNum = win.winner === 'player' ? 0 : win.winner === 'banker' ? 1 : 2;
      newBeadPlateGrid[col][row] = winnerNum;
      row++;
      if (row >= maxRows) {
        row = 0;
        col++;
      }
    });

    setBeadPlateGrid(newBeadPlateGrid);
  }, [wins]);

  // Fetch initial wins & open WebSocket
  useEffect(() => {
    const fetchWins = async () => {
      try {
        const res = await fetch("/api/get-wins");
        const data = await res.json();
        setWins(data);
      } catch (error) {
        console.error("Error fetching wins:", error);
      }
    };

    fetchWins();
    const ws = new WebSocket("ws://localhost:6789");
    setSocket(ws);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("WebSocket message received:", message);
      if (message.action === "game_result") {
        const newWin: WinRecord = {
          winner: message.winner,
          timestamp: new Date().toISOString(),
          is_super_six: message.is_super_six,
          player_pair: message.player_pair,
          banker_pair: message.banker_pair,
          player_natural: message.player_natural,
          banker_natural: message.banker_natural,
        };
        setWinner(message.winner);
        setWinnerData(message);
        console.log("message.action === game_result", message.winner);
        setShowWinnerModal(true);
        setTimeout(() => {
          setShowWinnerModal(false);
        }, 5000);
        setWins((prevWins) => [newWin, ...prevWins]);
      } else if (message.action === "reset_game") {
        console.log("in reset");
        setShowWinnerModal(false);
      } else if (message.action === "bets_changed") {
        setMinBet(message.minBet);
        setMaxBet(message.maxBet);
      } else if (message.action === "table_number_set") {
        setTableNumber(message.tableNumber);
      } else if (message.action === "delete_all_wins") {
        setWins([]);
        setGroupedWins([]);
        setBigEyeBoyGrid([]);
        setBeadPlateGrid([]);
      } else if (message.action === "delete_win") {
        console.log("delete last win");
        window.location.reload();
      }
    };

    return () => ws.close();
  }, []);

  const playerWins = wins.filter((win) => win.winner === "player").length;
  const bankerWins = wins.filter((win) => win.winner === "banker").length;
  const ties = wins.filter((win) => win.winner === "tie").length;
  const totalWins = playerWins + bankerWins + ties;
  const playerPercentage = totalWins ? Math.round((playerWins / totalWins) * 100) : 0;
  const bankerPercentage = totalWins ? Math.round((bankerWins / totalWins) * 100) : 0;
  const tiePercentage = totalWins ? Math.round((ties / totalWins) * 100) : 0;

  return (
    <div className="relative flex flex-col h-screen border border-gray-300 rounded-lg shadow-md text-white overflow-hidden">
      {/* Header */}
      <WinnerModal 
        show={showWinnerModal} 
        onClose={() => setShowWinnerModal(false)} 
        winner={winner}
        isLuckySix={winnerData?.is_super_six}
        isNatural={winnerData?.player_natural || winnerData?.banker_natural}
        naturalType={winnerData?.natural_type}
        playerNatural={winnerData?.player_natural}
        bankerNatural={winnerData?.banker_natural}
        playerTotal={winnerData?.playerTotal}
        bankerTotal={winnerData?.bankerTotal}
      />
      <div className="font-ramaraja p-4 rounded-lg shadow-lg text-left w-full relative bg-wood-pattern">
        <div className="flex justify-between items-center">
          {/* Table Number on the Left */}
          <div className="text-xl text-yellow-300 font-ramaraja">
            Table FT {tableNumber}
          </div>

          {/* Logo in the Center */}
          <div className="flex justify-center items-center">
            <img src="/assets/logo.png" alt="logo" className="h-20" />
          </div>

          {/* Image on the Right */}
          <div>
            <img src="/assets/ocean7.png" alt="ocean" className="h-20" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <div className="flex flex-col gap-1 p-1 border border-yellow-400  h-[800px] bg-white bg-opacity-50 w-full">

          {/* Define max columns */}
          {(() => {
            const maxColumns = 32; // Adjust as needed

            return (
              <>
                {/* 🔴 Big Road */}
                <div className="flex overflow-hidden h-[250px] ">
                  {Array.from({ length: maxColumns }).map((_, colIndex) => (
                    <div key={colIndex} className="flex flex-col items-center">
                      {Array.from({ length: 4 }).map((_, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="h-16 w-16 flex items-center justify-center "
                        >
                          {groupedWins[colIndex]?.[rowIndex] ? (
                            <div
                              className={`w-[20px] h-[20px] rounded-full ${
                                groupedWins[colIndex][rowIndex].winner === "player"
                                  ? "bg-green-500"
                                  : groupedWins[colIndex][rowIndex].winner === "banker"
                                  ? "bg-purple-600"
                                  : "bg-blue-500"
                              }`}
                            ></div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* 🔵 Big Eye Boy */}
                <div className="flex border-t-6 border-yellow-300  h-[250px] overflow-hidden">
                  {Array.from({ length: maxColumns }).map((_, colIndex) => (
                    <div key={colIndex} className="flex flex-col items-center">
                      {Array.from({ length: 4 }).map((_, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="h-16 w-16 flex items-center justify-center border-2 border-gray-400"
                        >
                          {bigEyeBoyGrid[colIndex]?.[rowIndex] !== undefined ? (
                            <div
                              className={`w-[20px] h-[20px] rounded-full ${
                                bigEyeBoyGrid[colIndex][rowIndex] === 0
                                  ? "border-green-500 border-4"
                                  : "border-purple-600 border-4"
                              }`}
                            ></div>
                          ) : (
                            <div className="w-[20px] h-[20px]"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* ⚪ Bead Plate */}
                <div className="flex overflow-hidden border-t border-yellow-300 h-[250px]">
                  {Array.from({ length: maxColumns }).map((_, colIndex) => (
                    <div key={colIndex} className="flex flex-col items-center">
                      {Array.from({ length: 4 }).map((_, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="h-16 w-16 flex items-center justify-center border-2 border-gray-400"
                        >
                          {beadPlateGrid[colIndex]?.[rowIndex] !== undefined ? (
                            <div
                              className={`w-[20px] h-[20px] rounded-full flex items-center justify-center text-white font-bold ${
                                beadPlateGrid[colIndex][rowIndex] === 0
                                  ? "bg-green-500"
                                  : beadPlateGrid[colIndex][rowIndex] === 1
                                  ? "bg-purple-600"
                                  : "bg-blue-500"
                              }`}
                            >
                              {beadPlateGrid[colIndex][rowIndex] === 0 ? "P" : 
                               beadPlateGrid[colIndex][rowIndex] === 1 ? "B" : "T"}
                            </div>
                          ) : (
                            <div className="w-[20px] h-[20px]"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Footer: Stats */}
      <div className="w-full flex-none bg-wood-pattern">
        <div className="grid grid-cols-4">
        <div className="font-ramaraja p-4 shadow-lg text-left relative border-2 border-yellow-400">
  <div className="grid grid-cols-2 gap-4">
    {/* BETS Column */}
    <div>
      <p className="text-2xl font-bold text-center text-[#f3be39] mb-2">BETS</p>
      <p className="text-xl font-ramaraja text-[#f3be39]">MAX: {maxBet}</p>
      <p className="text-xl font-ramaraja text-[#f3be39]">MIN: {minBet}</p>
    </div>

    {/* GAMES PLAYED Column */}
    <div>
      <p className="text-2xl font-bold text-center text-[#f3be39] mb-2">GAMES PLAYED</p>
      <p className="text-xl font-ramaraja text-[#f3be39] text-center">{wins.length}</p>
    </div>
  </div>
</div>

          <div className="p-4 col-span-2 shadow-lg text-left relative border-2 border-yellow-400">
            <h2 className="text-yellow-400 text-4xl font-ramaraja font-bold text-center mb-4">STATISTICS</h2>
            <div className="flex items-center gap-2">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-lg">P</div>
              <div className="flex-1 h-8 relative">
                <div className="absolute inset-0 flex">
                  {/* Player Bar */}
                  <div
                    className="h-full bg-green-500 rounded-l-full flex items-center justify-center text-white font-bold"
                    style={{ width: `${playerPercentage}%` }}
                  >
                    {playerPercentage > 0 && <span>{playerPercentage}%</span>}
                  </div>
                  {/* Banker Bar */}
                  <div
                    className="h-full bg-purple-600 flex items-center justify-center text-white font-bold"
                    style={{ width: `${bankerPercentage}%` }}
                  >
                    {bankerPercentage > 0 && <span>{bankerPercentage}%</span>}
                  </div>
                  {/* Tie Bar */}
                  <div
                    className="h-full bg-blue-500 rounded-r-full flex items-center justify-center text-white font-bold"
                    style={{ width: `${tiePercentage}%` }}
                  >
                    {tiePercentage > 0 && <span>{tiePercentage}%</span>}
                  </div>
                </div>
              </div>
              <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">B</div>
            </div>
          </div>

          <div className="p-4 shadow-lg text-left relative border-2 border-yellow-400">
            <div className="flex justify-around">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-lg">P</div>
                <span className="text-2xl text-yellow-400 font-bold font-ramaraja">Player</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">B</div>
                <span className="text-2xl text-yellow-400 font-bold font-ramaraja">Banker</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center text-white text-sm font-extrabold text-transform: uppercase bg-[#f3be39]">
          This is an electronic device
        </div>
      </div>
    </div>
  );
};

export default WinsList;