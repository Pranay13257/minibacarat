"use client";
import { useState, useEffect, useCallback } from "react";
import WinnerModal from "@/components/WinnerModal";

interface GameMenuProps {
  socket: WebSocket | null;
}

interface Players {
  player1: boolean;
  player2: boolean;
  player3: boolean;
  player4: boolean;
  player5: boolean;
  player6: boolean;
}

interface Suit {
  symbol: string;
  value: string;
}

type GameMode = "manual" | "automatic" | "live";
type PlayerKey = keyof Players;

const GameMenu = ({ socket }: GameMenuProps) => {
  // Game state
  const [cardInput, setCardInput] = useState("");
  const [joker, setJoker] = useState<string | null>(null);
  const [selectedFace, setSelectedFace] = useState<string | null>(null);
  const [selectedSuit, setSelectedSuit] = useState<string | null>(null);
  const [mode, setMode] = useState<GameMode>("manual");
  const [gamesCount, setGamesCount] = useState(0);
  
  // UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Betting state
  const [minBet, setMinBet] = useState(100);
  const [maxBet, setMaxBet] = useState(10000);
  const [newMinBet, setNewMinBet] = useState(minBet);
  const [newMaxBet, setNewMaxBet] = useState(maxBet);
  
  // Table and players state
  const [tableNumber, setTableNumber] = useState("1234");
  const [table, setTable] = useState<string>("1234");
  const [players, setPlayers] = useState<Players>({
    player1: false,
    player2: false,
    player3: false,
    player4: false,
    player5: false,
    player6: false,
  });

  // Constants
  const suits: Suit[] = [
    { symbol: "♠", value: "S" },
    { symbol: "♦", value: "D" },
    { symbol: "♣", value: "C" },
    { symbol: "♥", value: "H" },
  ];

  const cardFaces = ["A", "2", "3", "J", "4", "5", "6", "Q", "7", "8", "9", "K", "T"];

  // Utility functions
  const showPopupMessage = useCallback((message: string) => {
    setPopupMessage(message);
    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 3000);
  }, []);

  const showErrorMessage = useCallback((message: string) => {
    setErrorMessage(message);
    setShowError(true);
    setTimeout(() => setShowError(false), 3000);
  }, []);

  const sendSocketMessage = useCallback((data: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    } else {
      showErrorMessage("Connection lost. Please refresh the page.");
    }
  }, [socket, showErrorMessage]);

  // WebSocket message handler
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.action) {
          case "set_joker":
            setJoker(data.joker);
            break;
          case "update_players":
            setPlayers(data.players);
            console.log(data, " for players");
            break;
          case "bet_changed":
            console.log("Bet Changed", data);
            setMinBet(data.minBet);
            setMaxBet(data.maxBet);
            break;
          case "table_number_set":
            console.log("Table Number Updated in player board", data);
            setTable(String(data.tableNumber ?? ""));
            setTableNumber(String(data.tableNumber ?? ""));
            break;
          case "duplicate_card":
            console.log("Duplicate Card", data);
            handleDuplicateCard();
            break;
          case "game_won":
            console.log("game won, calling reset function", data);
            setTimeout(() => {
              resetGame();
            }, 5000);
            break;
          default:
            console.log("Unknown action:", data.action);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket]);

  // Game actions
  const togglePlayer = useCallback((player: PlayerKey) => {
    if (joker) {
      showErrorMessage("Cannot add new player while game is in progress");
      return;
    }
    sendSocketMessage({ action: "toggle_player", player });
    console.log("toggle player", player);
  }, [joker, sendSocketMessage, showErrorMessage]);

  const handleAddCard = useCallback(() => {
    const card = selectedFace && selectedSuit ? `${selectedFace}${selectedSuit}` : cardInput.trim().toUpperCase();
    
    if (!card) {
      showErrorMessage("Please select a card or enter card manually");
      return;
    }

    sendSocketMessage({ action: "add_card", card });
    setCardInput("");
    setSelectedFace(null);
    setSelectedSuit(null);
  }, [selectedFace, selectedSuit, cardInput, sendSocketMessage, showErrorMessage]);

  const handleBurnCard = useCallback(() => {
    const card = selectedFace && selectedSuit ? `${selectedFace}${selectedSuit}` : cardInput.trim().toUpperCase();
    
    if (!card) {
      showErrorMessage("Please select a card or enter card manually");
      return;
    }

    sendSocketMessage({ action: "burn_card", card });
    setCardInput("");
    setSelectedFace(null);
    setSelectedSuit(null);
  }, [selectedFace, selectedSuit, cardInput, sendSocketMessage, showErrorMessage]);

  const handleWinner = useCallback((winnerIndex: number) => {
    setWinner(winnerIndex);
    setMenuOpen(false);
    setShowWinnerModal(true);
    
    setTimeout(() => {
      setShowWinnerModal(false);
    }, 5000);

    sendSocketMessage({ action: "game_won", winner: winnerIndex });
    setGamesCount(prev => prev + 1);
  }, [sendSocketMessage]);

  const resetGame = useCallback(() => {
    sendSocketMessage({ action: "reset_game" });
    setJoker(null);
    setSelectedFace(null);
    setSelectedSuit(null);
  }, [sendSocketMessage]);

  const changeBets = useCallback(() => {
    if (newMinBet >= newMaxBet) {
      showErrorMessage("Minimum bet must be less than maximum bet");
      return;
    }
    
    sendSocketMessage({ action: "bet_changed", minBet: newMinBet, maxBet: newMaxBet });
    setMinBet(newMinBet);
    setMaxBet(newMaxBet);
    showPopupMessage("Bets changed successfully!");
  }, [newMinBet, newMaxBet, sendSocketMessage, showPopupMessage, showErrorMessage]);

  const sendTableNumber = useCallback(() => {
    if (!tableNumber.trim()) {
      showErrorMessage("Please enter a valid table number");
      return;
    }
    
    sendSocketMessage({ action: "table_number_set", tableNumber });
    setShowTableModal(false);
    showPopupMessage("Table number updated successfully!");
  }, [tableNumber, sendSocketMessage, showErrorMessage, showPopupMessage]);

  const deleteLastWin = useCallback(() => {
    sendSocketMessage({ action: "delete_win" });
    showPopupMessage("Last win deleted successfully!");
  }, [sendSocketMessage, showPopupMessage]);

  const deleteAllWins = useCallback(() => {
    sendSocketMessage({ action: "delete_all_wins" });
    setGamesCount(0);
    showPopupMessage("All wins deleted successfully!");
  }, [sendSocketMessage, showPopupMessage]);

  const handleDuplicateCard = useCallback(() => {
    sendSocketMessage({ action: "duplicate_card" });
    showPopupMessage("Duplicate card detected!");
  }, [sendSocketMessage, showPopupMessage]);

  const startAutomatic = useCallback(() => {
    sendSocketMessage({ action: "start_automatic" });
  }, [sendSocketMessage]);

  // Component JSX remains the same but with improved event handlers
  return (
    <>
      <WinnerModal 
        show={showWinnerModal} 
        onClose={() => setShowWinnerModal(false)} 
        winner={winner} 
      />

      {/* Error Popup */}
      {showError && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {errorMessage}
        </div>
      )}

      {/* Success Popup */}
      {showPopup && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {popupMessage}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between w-full h-30 shadow-lg bg-wood-pattern">
        {/* Left Section */}
        <div className="font-questrial p-4 rounded-lg shadow-lg text-left md:w-1/4 w-full relative">
          <img src="/assets/screw.png" alt="screw" className="absolute top-2 left-2 w-8 h-8" />
          <img src="/assets/screw.png" alt="screw" className="absolute top-2 right-2 w-8 h-8" />
          <div className="flex-col justify-center items-center">
            <div className="flex justify-center items-center">
              <img src="/assets/logo.png" alt="logo" className="h-14" />
            </div>
            <div className="text-xl text-center text-yellow-300">
              Table FT{String(tableNumber)}
            </div>
            <div className="text-sm text-center text-yellow-200">
              Games: {gamesCount}
            </div>
          </div>
        </div>

        <div className="flex py-5 border border-yellow-600 px-5 gap-3 overflow-x-auto">
          {/* Middle content can be added here */}
        </div>

        {/* Right Section with Menu */}
        <div className="font-questrial p-4 rounded-lg shadow-lg text-left md:w-1/4 w-full relative">
          <img src="/assets/screw.png" alt="screw" className="absolute top-2 left-2 w-8 h-8" />
          <img src="/assets/screw.png" alt="screw" className="absolute top-2 right-2 w-8 h-8" />
          <div className="flex-col justify-center items-center relative">
            <div className="flex justify-center items-center cursor-pointer">
              <div className="relative">
                <button 
                  onClick={() => setMenuOpen(!menuOpen)} 
                  className="focus:outline-none"
                  aria-label="Open game menu"
                >
                  <img src="/assets/menu.png" alt="menu" className="h-20 bg-wood-pattern" />
                </button>
                
                {menuOpen && (
                  <div className="fixed inset-0 left-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 w-full">
                    <div className="relative bg-gray-200 w-full max-w-4xl rounded-lg p-6 grid grid-cols-3 gap-4">
                      {/* Close Button */}
                      <button
                        onClick={() => setMenuOpen(false)}
                        className="absolute top-4 right-4 text-black text-2xl font-bold hover:text-gray-600"
                        aria-label="Close menu"
                      >
                        &times;
                      </button>

                      {/* Mode Selection */}
                      <div className="col-span-3 flex justify-center mb-4">
                        {(["live", "manual", "automatic"] as GameMode[]).map((modeOption) => (
                          <button
                            key={modeOption}
                            onClick={() => setMode(modeOption)}
                            className={`px-4 py-2 ${modeOption === "live" ? "rounded-l-lg" : modeOption === "automatic" ? "rounded-r-lg" : ""} ${
                              mode === modeOption ? "bg-blue-500 text-white" : "bg-gray-300"
                            }`}
                          >
                            {modeOption.charAt(0).toUpperCase() + modeOption.slice(1)}
                          </button>
                        ))}
                      </div>

                      {mode === "automatic" ? (
                        <div className="col-span-3 text-center">
                          <p className="text-xl font-bold">Automatic mode is enabled. Actions will be handled automatically.</p>
                          <div className="grid grid-rows-3 gap-4 mt-4">
                            <button
                              onClick={startAutomatic}
                              className="bg-blue-500 text-white text-2xl font-bold rounded-lg p-6 hover:bg-blue-700 transition"
                            >
                              START AUTOMATIC
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Win Buttons */}
                          <div className="gap-4">
                            <button
                              onClick={() => handleWinner(0)}
                              className="bg-blue-700 h-1/3 text-white text-2xl font-bold rounded-lg p-6 hover:bg-blue-800 transition mb-1 w-full"
                            >
                              ANDAR WINS
                            </button>
                            <button
                              onClick={() => handleWinner(1)}
                              className="bg-red-500 h-1/3 text-white text-2xl font-bold rounded-lg p-6 hover:bg-red-600 transition w-full"
                            >
                              BAHAR WINS
                            </button>
                          </div>

                          {/* Controls */}
                          <div className="grid grid-rows-3 gap-4">
                            <div className="grid grid-cols-1 gap-2">
                              <div className="flex items-center justify-between bg-black text-white rounded-lg p-3">
                                <span>MAX</span>
                                <input
                                  type="number"
                                  value={newMaxBet}
                                  onChange={(e) => setNewMaxBet(Number(e.target.value))}
                                  className="bg-transparent text-right w-20 focus:outline-none"
                                  placeholder="10000"
                                  min="1"
                                />
                              </div>
                              <div className="flex items-center justify-between bg-black text-white rounded-lg p-3">
                                <span>MIN</span>
                                <input
                                  type="number"
                                  value={newMinBet}
                                  onChange={(e) => setNewMinBet(Number(e.target.value))}
                                  className="bg-transparent text-right w-20 focus:outline-none"
                                  placeholder="100"
                                  min="1"
                                />
                              </div>
                              <button 
                                onClick={changeBets} 
                                className="bg-black text-white rounded-lg p-3 hover:bg-gray-800 transition"
                              >
                                CHANGE BETS
                              </button>
                              <button
                                onClick={() => setShowTableModal(true)}
                                className="bg-black text-white rounded-lg p-3 hover:bg-gray-800 transition"
                              >
                                ENTER TABLE NUMBER
                              </button>
                              <button 
                                onClick={resetGame} 
                                className="bg-red-500 text-white px-4 py-2 w-full rounded-lg hover:bg-red-600 transition"
                              >
                                Reset Game
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-2">
                              <button 
                                onClick={deleteLastWin} 
                                className="bg-black text-white rounded-lg p-3 hover:bg-gray-800 transition"
                              >
                                DELETE LAST WIN
                              </button>
                              <button 
                                onClick={deleteAllWins} 
                                className="bg-black text-white rounded-lg p-3 hover:bg-gray-800 transition"
                              >
                                DELETE ALL WINS
                              </button>
                            </div>
                          </div>

                          {/* Card Selection */}
                          <div>
                            <div className="grid grid-cols-4 gap-2 mb-4">
                              {cardFaces.map((face) => (
                                <button
                                  key={face}
                                  className={`rounded-lg aspect-square flex items-center justify-center text-2xl font-bold transition p-2 ${
                                    selectedFace === face 
                                      ? "bg-green-500 text-white" 
                                      : "bg-black text-white hover:bg-gray-800"
                                  }`}
                                  onClick={() => setSelectedFace(selectedFace === face ? null : face)}
                                >
                                  {face}
                                </button>
                              ))}
                            </div>

                            <div className="grid grid-cols-4 gap-2 mb-4">
                              {suits.map((suit) => (
                                <button
                                  key={suit.value}
                                  className={`rounded-lg aspect-square flex items-center justify-center text-3xl font-bold transition p-2 ${
                                    selectedSuit === suit.value 
                                      ? "bg-yellow-500 text-black" 
                                      : "bg-gray-800 text-white hover:bg-gray-700"
                                  }`}
                                  onClick={() => setSelectedSuit(selectedSuit === suit.value ? null : suit.value)}
                                >
                                  {suit.symbol}
                                </button>
                              ))}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={handleAddCard}
                                className="bg-green-600 text-white rounded-lg p-3 text-xl hover:bg-green-700 transition"
                                disabled={!selectedFace || !selectedSuit}
                              >
                                SEND CARD
                              </button>
                              <button
                                onClick={handleBurnCard}
                                className="bg-red-600 text-white rounded-lg p-3 text-xl hover:bg-red-700 transition"
                                disabled={!selectedFace || !selectedSuit}
                              >
                                BURN CARD
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Number Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96 text-center">
            <h2 className="text-xl font-bold mb-4 text-black">Enter Table Number</h2>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="border p-2 w-full rounded-md text-center text-black"
              placeholder="Enter Table Number"
              maxLength={10}
            />
            <div className="flex justify-between mt-4">
              <button
                onClick={() => setShowTableModal(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={sendTableNumber}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GameMenu;