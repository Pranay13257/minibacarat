"use client";
import { useEffect, useState } from "react";
import WinsBoards from "./WinsBoards";
import WinnerModal from "@/components/WinnerModal";

type WinRecord = {
  _id?: string;
  winner: number; // 0 for Andar (A), 1 for Bahar (B)
  timestamp?: string;
};

const WinsList = () => {
  const [wins, setWins] = useState<WinRecord[]>([]);
  const [groupedWins, setGroupedWins] = useState<WinRecord[][]>([]);
  const [bigEyeBoyGrid, setBigEyeBoyGrid] = useState<number[][]>([]);
  const [beadPlateGrid, setBeadPlateGrid] = useState<number[][]>([]);
  const [joker, setJoker] = useState<string | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [minBet, setMinBet] = useState(100);
  const [maxBet, setMaxBet] = useState(10000);
  const [tableNumber, setTableNumber] = useState("1234");
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
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
      newBeadPlateGrid[col][row] = win.winner;
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
      if (message.action === "game_won") {
        const newWin: WinRecord = {
          winner: message.winner,
          timestamp: new Date().toISOString(),
        };
        setWinner(message.winner);
        console.log("message.action === game_won", message.winner);
        setShowWinnerModal(true);
        setTimeout(() => {
          setShowWinnerModal(false);
        }, 5000);
        setWins((prevWins) => [newWin, ...prevWins]);
      } else if (message.action === "set_joker") {
        setJoker(message.joker);
      } else if (message.action === "reset_game") {
        setJoker(null);
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

  const andarWins = wins.filter((win) => win.winner === 0).length;
  const baharWins = wins.filter((win) => win.winner === 1).length;
  const totalWins = andarWins + baharWins;
  const andarPercentage = totalWins ? Math.round((andarWins / totalWins) * 100) : 50;
  const baharPercentage = totalWins ? Math.round((baharWins / totalWins) * 100) : 50;

  return (
    <div className="relative flex flex-col h-screen border border-gray-300 rounded-lg shadow-md text-white overflow-hidden">
      {joker ? (
        <WinsBoards socket={socket} joker={joker} />
      ) : (
        <>
          {/* Header */}
          <WinnerModal show={showWinnerModal} onClose={() => setShowWinnerModal(false)} winner={winner} />
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
            {/* <div className="bg-contain bg-no-repeat bg-center opacity-70 animate-glow w-1/2 h-1/2"
              style={{ backgroundImage: `url(/assets/ocean7.png)` }}></div> */}

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
                                  className={`w-[20px] h-[20px] rounded-full ${groupedWins[colIndex][rowIndex].winner === 0
                                      ? "bg-blue-500"
                                      : "bg-red-500"
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
                                  className={`w-[20px] h-[20px] rounded-full ${bigEyeBoyGrid[colIndex][rowIndex] === 0
                                      ? "border-blue-500 border-4"
                                      : "border-red-500 border-4"
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
                                  className={`w-[20px] h-[20px] rounded-full flex items-center justify-center text-white font-bold ${beadPlateGrid[colIndex][rowIndex] === 0
                                      ? "bg-blue-500"
                                      : "bg-red-500"
                                    }`}
                                >
                                  {beadPlateGrid[colIndex][rowIndex] === 0 ? "A" : "B"}
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
                  <img src="/assets/blue_a.svg" className="w-20 h-20" />
                  <div className="flex-1 h-8 relative">
                    <div className="absolute inset-0 flex">
                      {/* Andar Bar */}
                      <div
                        className="h-full bg-blue-600 rounded-l-full flex items-center justify-center text-white font-bold"
                        style={{ width: `${andarPercentage}%` }}
                      >
                        {andarPercentage > 0 && <span>{andarPercentage}%</span>}
                      </div>
                      {/* Bahar Bar */}
                      <div
                        className="h-full bg-red-600 rounded-r-full flex items-center justify-center text-white font-bold"
                        style={{ width: `${baharPercentage}%` }}
                      >
                        {baharPercentage > 0 && <span>{baharPercentage}%</span>}
                      </div>
                    </div>
                  </div>
                  <img src="/assets/red_b.svg" className="w-20 h-20" />
                </div>
              </div>

              <div className="p-4 shadow-lg text-left relative border-2 border-yellow-400">
                <div className="flex justify-around">
                  <div className="flex flex-col items-center">
                    <img src="/assets/blue_a.svg" className="w-20 h-20" />
                    <span className="text-2xl text-yellow-400 font-bold font-ramaraja">Andar</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <img src="/assets/red_b.svg" className="w-20 h-20" />
                    <span className="text-2xl text-yellow-400 font-bold font-ramaraja">Bahar</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center text-white text-sm font-extrabold text-transform: uppercase bg-[#f3be39]">
              This is an electronic device
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WinsList;