"use client";
import { useState, useEffect, useRef } from "react";
import GameBoard from "@/components/GameBoard";

interface GameState {
  playerCards: string[];
  bankerCards: string[];
  playerTotal: number;
  bankerTotal: number;
  nextCardGoesTo: string;
  gamePhase: string;
  thirdCardPhase: boolean;
  canUndo: boolean;
  canCalculate: boolean;
  canShuffle: boolean;
  remainingCards: number;
  usedCards: number;
  burnCard: string | null;
  burnEnabled: boolean;
  playerPair: boolean;
  bankerPair: boolean;
  round: number;
  playerWins: number;
  bankerWins: number;
  ties: number;
  luckySixCount: number;
  naturalCount: number;
  activePlayers: string[];
  autoDealingInProgress: boolean;
  winMessage?: string;
  naturalWin?: boolean;
  naturalType?: string | null;
  isSuperSix?: boolean;
  lastGameResult?: any;
  table_number?: string;
  max_bet?: number;
  min_bet?: number;
  game_mode?: string;
  vip_revealer?: string | null;
  cards_revealed?: boolean;
  burnAvailable?: boolean;
  burnMode?: string;
  // Add any other new fields from server.py here
}

interface WebSocketMessage {
  action: string;
  message?: string;
  players?: { [key: string]: boolean };
  [key: string]: any;
}

const DealerPage = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [statusMessage, setStatusMessage] = useState('');
  const [showBurnPopup, setShowBurnPopup] = useState(false);
  const [burnCardInput, setBurnCardInput] = useState('');
  const [hasBurnedCard, setHasBurnedCard] = useState(false);
  const [cardInput, setCardInput] = useState('');
  
  const websocketRef = useRef<WebSocket | null>(null);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    playerCards: [],
    bankerCards: [],
    playerTotal: 0,
    bankerTotal: 0,
    nextCardGoesTo: 'player',
    gamePhase: 'waiting',
    thirdCardPhase: false,
    canUndo: false,
    canCalculate: false,
    canShuffle: false,
    remainingCards: 416,
    usedCards: 0,
    burnCard: null,
    burnEnabled: false,
    playerPair: false,
    bankerPair: false,
    round: 0,
    playerWins: 0,
    bankerWins: 0,
    ties: 0,
    luckySixCount: 0,
    naturalCount: 0,
    activePlayers: [],
    autoDealingInProgress: false,
    winMessage: '',
    naturalWin: false,
    naturalType: null,
    isSuperSix: false,
    lastGameResult: null,
    vip_revealer: null,
    cards_revealed: false,
    burnAvailable: false,
    burnMode: 'inactive'
  });

  const [stats, setStats] = useState({
    banker_wins: 0,
    player_wins: 0,
    ties: 0,
    player_pairs: 0,
    banker_pairs: 0,
    player_naturals: 0,
    banker_naturals: 0,
  });

  const [canUndoLastWin, setCanUndoLastWin] = useState(false);

  // Table/bet state for editing
  const [tableNumberInput, setTableNumberInput] = useState("");
  const [maxBetInput, setMaxBetInput] = useState("");
  const [minBetInput, setMinBetInput] = useState("");

  // Add mode state
  const [mode, setMode] = useState<string>('manual');

  // Manual result form state
  const [manualWinner, setManualWinner] = useState('player');
  const [manualPlayerPair, setManualPlayerPair] = useState(false);
  const [manualBankerPair, setManualBankerPair] = useState(false);
  const [manualPlayerNatural, setManualPlayerNatural] = useState(false);
  const [manualBankerNatural, setManualBankerNatural] = useState(false);
  const [manualSuperSix, setManualSuperSix] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // VIP mode revealer selection state
  const [selectedRevealer, setSelectedRevealer] = useState('');

  // Update mode from gameState
  useEffect(() => {
    if (gameState && gameState.game_mode) setMode(gameState.game_mode);
  }, [gameState.game_mode]);

  // Mode selection handler
  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMode = e.target.value;
    setMode(newMode);
    sendMessage({ action: 'set_game_mode', mode: newMode });
  };

  useEffect(() => {
    setTableNumberInput(gameState.table_number || "");
    setMaxBetInput(gameState.max_bet?.toString() || "");
    setMinBetInput(gameState.min_bet?.toString() || "");
  }, [gameState.table_number, gameState.max_bet, gameState.min_bet]);

  const saveTableNumber = () => {
    sendMessage({ action: "set_table_number", table_number: tableNumberInput });
  };
  const saveMaxBet = () => {
    sendMessage({ action: "set_max_bet", max_bet: maxBetInput });
  };
  const saveMinBet = () => {
    sendMessage({ action: "set_min_bet", min_bet: minBetInput });
  };

  const setStatusMessageWithTimeout = (message: string, timeout: number = 3000) => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    setStatusMessage(message);
    statusTimeoutRef.current = setTimeout(() => {
      setStatusMessage('');
      statusTimeoutRef.current = null;
    }, timeout);
  };

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        setConnectionStatus('Connecting...');
        const websocket = new WebSocket('ws://localhost:6789');
        websocketRef.current = websocket;
        
        websocket.onopen = () => {
          setConnected(true);
          setConnectionStatus('Connected');
          setSocket(websocket);
        };

        websocket.onmessage = (event) => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            console.log("Received data:", data);
            handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        websocket.onclose = () => {
          setConnected(false);
          setConnectionStatus('Disconnected');
          setSocket(null);
          websocketRef.current = null;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        };

        websocket.onerror = (error) => {
          setConnectionStatus('Connection Error');
          console.error('WebSocket error:', error);
        };

      } catch (error) {
        setConnectionStatus('Connection Failed');
        console.error('WebSocket connection error:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.send(JSON.stringify({ action: 'get_stats' }));
    const handleStats = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === 'stats') {
          setStats({
            banker_wins: data.banker_wins,
            player_wins: data.player_wins,
            ties: data.ties,
            player_pairs: data.player_pairs,
            banker_pairs: data.banker_pairs,
            player_naturals: data.player_naturals,
            banker_naturals: data.banker_naturals,
          });
        }
        if (data.action === 'game_state' || data.action === 'game_result') {
          if (typeof data.canUndoLastWin !== 'undefined') {
            setCanUndoLastWin(data.canUndoLastWin);
          }
        }
        if (data.action === 'refresh_stats') {
          socket.send(JSON.stringify({ action: 'get_stats' }));
        }
      } catch (e) {}
    };
    socket.addEventListener('message', handleStats);
    return () => socket.removeEventListener('message', handleStats);
  }, [socket]);

  const handleMessage = (data: WebSocketMessage) => {
    switch(data.action) {
      case 'game_state':
        console.log('=== RECEIVED GAME STATE ===');
        console.log('Raw data:', data);
        console.log('data.is_super_six:', data.is_super_six);
        console.log('data.isSuperSix:', data.isSuperSix);
        console.log('===========================');
        const newGameState: GameState = {
          playerCards: data.playerCards || [],
          bankerCards: data.bankerCards || [],
          playerTotal: data.playerTotal || 0,
          bankerTotal: data.bankerTotal || 0,
          nextCardGoesTo: data.nextCardGoesTo || 'player',
          gamePhase: data.gamePhase || 'waiting',
          thirdCardPhase: data.thirdCardPhase || false,
          canUndo: data.canUndo || false,
          canCalculate: data.canCalculate || false,
          canShuffle: data.canShuffle || false,
          remainingCards: data.remainingCards || 0,
          usedCards: data.usedCards || 0,
          burnCard: data.burnCard || null,
          burnEnabled: data.burnEnabled || false,
          playerPair: data.playerPair || false,
          bankerPair: data.bankerPair || false,
          round: data.round || 0,
          playerWins: data.playerWins || 0,
          bankerWins: data.bankerWins || 0,
          ties: data.ties || 0,
          luckySixCount: data.luckySixCount || 0,
          naturalCount: data.naturalCount || 0,
          activePlayers: data.activePlayers || [],
          autoDealingInProgress: data.autoDealingInProgress || false,
          winMessage: data.winMessage || '',
          naturalWin: data.naturalWin || false,
          naturalType: data.naturalType || null,
          isSuperSix: data.is_super_six || false,
          lastGameResult: data.lastGameResult || null,
          table_number: data.table_number || undefined,
          max_bet: data.max_bet || undefined,
          min_bet: data.min_bet || undefined,
          game_mode: data.game_mode || undefined,
          vip_revealer: data.vip_revealer || null,
          cards_revealed: data.cards_revealed || false,
          burnAvailable: typeof data.burnAvailable !== 'undefined' ? data.burnAvailable : false,
          burnMode: typeof data.burnMode !== 'undefined' ? data.burnMode : 'inactive'
        };
        
        setGameState(newGameState);
        break;
        
      case 'error':
        setStatusMessageWithTimeout(`❌ ${data.message}`, 5000);
        break;
        
      case 'success':
        setStatusMessageWithTimeout(`✅ ${data.message}`, 3000);
        if (data.message && data.message.includes('Burned card')) {
          setShowBurnPopup(false);
          setBurnCardInput('');
          setHasBurnedCard(true);
        }
        break;

      default:
        console.log('Unknown message type:', data.action);
        break;
    }
  };

  const sendMessage = (message: Record<string, any>) => {
    if (socket && connected) {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message:', error);
        setStatusMessageWithTimeout('❌ Failed to send message!');
      }
    } else {
      setStatusMessageWithTimeout('❌ Not connected to server!');
    }
  };

  const togglePlayer = (playerId: string) => {
    if (!socket || !connected) return;
    
    const isActive = gameState.activePlayers.includes(playerId);
    sendMessage({
      action: "update_players",
      player_id: playerId,
      is_active: !isActive
    });
  };

  const burnCard = () => {
    const card = burnCardInput.trim().toUpperCase();
    if (!card) return;
    
    sendMessage({ action: 'burn_card', card });
  };

  const addCard = () => {
    const card = cardInput.trim().toUpperCase();
    if (!card) return;
    
    sendMessage({ action: 'add_card', card });
    setCardInput('');
  };

  const handleGameAction = (action: string) => {
    if (action === 'reset_game') {
      if (!window.confirm('Reset everything? This will clear all game data.')) {
        return;
      }
      setHasBurnedCard(false);
    }
    sendMessage({ action });
  };

  const getWinReason = () => {
    if (!gameState || gameState.gamePhase !== 'finished') return null;
    const reasons = [];
    if (gameState.playerPair) reasons.push("Player Pair");
    if (gameState.bankerPair) reasons.push("Banker Pair");
    if (gameState.isSuperSix) reasons.push("Super Six");
    if (gameState.naturalWin && gameState.naturalType) {
      if (gameState.playerTotal > gameState.bankerTotal && (gameState.naturalType === 'natural_8' || gameState.naturalType === 'natural_9')) {
        reasons.push(`Player Natural ${gameState.naturalType === 'natural_8' ? '8' : '9'}`);
      } else if (gameState.bankerTotal > gameState.playerTotal && (gameState.naturalType === 'natural_8' || gameState.naturalType === 'natural_9')) {
        reasons.push(`Banker Natural ${gameState.naturalType === 'natural_8' ? '8' : '9'}`);
      }
    }
    return reasons.join(", ");
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualSubmitting(true);
    sendMessage({
      action: 'manual_result',
      winner: manualWinner,
      player_pair: manualPlayerPair,
      banker_pair: manualBankerPair,
      player_natural: manualPlayerNatural,
      banker_natural: manualBankerNatural,
      is_super_six: manualSuperSix
    });
    setTimeout(() => setManualSubmitting(false), 1000);
  };

  const handleSetRevealer = () => {
    if (selectedRevealer) {
      sendMessage({ action: 'set_vip_revealer', player_id: selectedRevealer });
    }
  };

  // Add useEffect to reset selectedRevealer on new game in VIP mode
  useEffect(() => {
    if (mode === 'vip' && gameState.gamePhase === 'waiting') {
      setSelectedRevealer('');
    }
  }, [mode, gameState.gamePhase]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <h1 className="text-3xl font-bold mb-2">🎰 Baccarat Dealer Control</h1>
            <div className={`text-lg font-semibold ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? '🟢' : '🔴'} {connectionStatus}
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4 text-center">
              {statusMessage}
            </div>
          )}

          {/* Add this above the stats grid in the header */}
          <div className="flex flex-wrap gap-4 mb-4 justify-center">
            <div className="flex items-center gap-2">
              <label className="font-semibold">Table Number:</label>
              <input type="text" value={tableNumberInput} onChange={e => setTableNumberInput(e.target.value)} className="p-1 rounded text-black w-24" />
              <button onClick={saveTableNumber} className="bg-blue-600 text-white px-2 py-1 rounded">Save</button>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-semibold">Max Bet:</label>
              <input type="number" value={maxBetInput} onChange={e => setMaxBetInput(e.target.value)} className="p-1 rounded text-black w-24" min={0} />
              <button onClick={saveMaxBet} className="bg-blue-600 text-white px-2 py-1 rounded">Save</button>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-semibold">Min Bet:</label>
              <input type="number" value={minBetInput} onChange={e => setMinBetInput(e.target.value)} className="p-1 rounded text-black w-24" min={0} />
              <button onClick={saveMinBet} className="bg-blue-600 text-white px-2 py-1 rounded">Save</button>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="bg-white p-4 flex justify-center items-center gap-4">
            <label className="font-semibold text-black">Game Mode:</label>
            <select value={mode} onChange={handleModeChange} className="p-2 rounded border bg-white text-black" style={{ color: 'black' }}>
              <option value="manual" style={{ color: 'black' }}>Manual</option>
              <option value="live" style={{ color: 'black' }}>Live</option>
              <option value="automatic" style={{ color: 'black' }}>Automatic</option>
              <option value="vip" style={{ color: 'black' }}>VIP</option>
            </select>
            <span className="ml-4 font-mono text-sm text-gray-600">Current: <span className="text-black">{mode.toUpperCase()}</span></span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4 text-sm">
            <div className="bg-blue-900 p-3 rounded text-center">
              <div className="text-blue-300 text-xs">PLAYER WINS</div>
              <div className="font-bold text-lg text-blue-200">{stats.player_wins}</div>
            </div>
            <div className="bg-red-900 p-3 rounded text-center">
              <div className="text-red-300 text-xs">BANKER WINS</div>
              <div className="font-bold text-lg text-red-200">{stats.banker_wins}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded text-center">
              <div className="text-gray-400 text-xs">TIES</div>
              <div className="font-bold text-lg">{stats.ties}</div>
            </div>
            <div className="bg-blue-800 p-3 rounded text-center">
              <div className="text-blue-200 text-xs">PLAYER PAIRS</div>
              <div className="font-bold text-lg">{stats.player_pairs}</div>
            </div>
            <div className="bg-red-800 p-3 rounded text-center">
              <div className="text-red-200 text-xs">BANKER PAIRS</div>
              <div className="font-bold text-lg">{stats.banker_pairs}</div>
            </div>
            <div className="bg-green-900 p-3 rounded text-center">
              <div className="text-green-300 text-xs">PLAYER NATURALS</div>
              <div className="font-bold text-lg text-green-200">{stats.player_naturals}</div>
            </div>
            <div className="bg-green-800 p-3 rounded text-center">
              <div className="text-green-200 text-xs">BANKER NATURALS</div>
              <div className="font-bold text-lg">{stats.banker_naturals}</div>
            </div>
          </div>

          {/* Player Activation */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[1, 2, 3, 4, 5, 6].map((playerNum) => {
              const playerId = `player${playerNum}`;
              const isActive = gameState.activePlayers.includes(playerId);
              return (
                <button
                  key={playerId}
                  onClick={() => togglePlayer(playerId)}
                  className={`p-3 rounded-lg font-semibold transition-colors ${
                    isActive 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {playerId.toUpperCase()} {isActive ? '✅' : '❌'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto p-4">
        {/* VIP Mode Reveal Logic */}
        {mode === 'vip' && (
          <div className="mb-6">
            {/* Step 1: After 4 cards are dealt, select revealer if not set */}
            {gameState.gamePhase === 'waiting_for_reveal' && !gameState.vip_revealer && (
              <div className="bg-yellow-200 p-4 rounded mb-4 flex flex-col md:flex-row items-center gap-4">
                <span className="font-bold text-black">Select VIP Revealer:</span>
                <select
                  value={selectedRevealer}
                  onChange={e => setSelectedRevealer(e.target.value)}
                  className="p-2 rounded border text-black bg-white"
                >
                  <option value="">-- Select Player --</option>
                  {gameState.activePlayers.map(pid => (
                    <option key={pid} value={pid}>{pid.toUpperCase()}</option>
                  ))}
                </select>
                <button
                  onClick={handleSetRevealer}
                  disabled={!selectedRevealer}
                  className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
                >
                  Set Revealer
                </button>
              </div>
            )}
            {/* Step 2: Show Reveal button if revealer is set and not revealed */}
            {gameState.gamePhase === 'waiting_for_reveal' && gameState.vip_revealer && !gameState.cards_revealed && (
              <div className="bg-yellow-100 p-4 rounded mb-4 flex flex-col md:flex-row items-center gap-4">
                <span className="font-bold text-black">VIP Revealer: {gameState.vip_revealer.toUpperCase()}</span>
                <button
                  onClick={() => sendMessage({ action: 'vip_reveal', player_id: gameState.vip_revealer })}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Reveal Cards
                </button>
              </div>
            )}
          </div>
        )}
        {/* Non-Manual Mode Content */}
        {mode !== 'manual' && (
          <>
            {mode !== 'automatic' && (
              <div className="bg-gray-800 p-4 rounded-lg mb-4">
                <h3 className="font-bold mb-3 text-center text-white">🃏 Add Card</h3>
                <div className="flex gap-3 max-w-md mx-auto">
                  <input
                    type="text"
                    value={cardInput}
                    onChange={(e) => setCardInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCard()}
                    placeholder="e.g., AH, KS, 9D"
                    className="flex-1 p-3 border rounded-lg text-center font-mono text-lg bg-gray-700 text-white"
                    disabled={!connected || gameState.autoDealingInProgress}
                  />
                  <button 
                    onClick={addCard}
                    disabled={!connected || gameState.nextCardGoesTo === 'complete' || gameState.autoDealingInProgress}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 font-semibold"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
            {/* Burn Card Buttons for live and vip modes */}
            {(mode === 'live' || mode === 'vip') && (
              <div className="flex gap-4 mb-4 justify-center">
                <button
                  onClick={() => sendMessage({ action: 'start_burn_card' })}
                  disabled={
                    !connected ||
                    !gameState.burnAvailable ||
                    gameState.burnMode === 'active' ||
                    gameState.burnMode === 'completed' ||
                    gameState.autoDealingInProgress ||
                    (gameState.playerCards && gameState.playerCards.length >= 1)
                  }
                  className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 font-semibold"
                >
                  Start Burn Card
                </button>
                <button
                  onClick={() => sendMessage({ action: 'end_burn_card' })}
                  disabled={
                    !connected ||
                    gameState.burnMode !== 'active' ||
                    gameState.autoDealingInProgress ||
                    (gameState.playerCards && gameState.playerCards.length >= 1)
                  }
                  className="px-6 py-3 bg-orange-700 text-white rounded-lg hover:bg-orange-800 disabled:bg-gray-400 font-semibold"
                >
                  End Burn Card
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Game Board */}
              <div className="lg:col-span-2">
                <GameBoard gameState={gameState} hideCards={mode === 'vip' && !gameState.cards_revealed} />
              </div>
            </div>

            {/* Control buttons for non-manual modes */}
            <div className={`grid grid-cols-2 ${mode === 'live' || mode === 'vip' ? 'md:grid-cols-5' : 'md:grid-cols-5'} gap-4 mt-4`}>
              <button onClick={() => handleGameAction('start_new_game')} disabled={!connected || gameState.autoDealingInProgress} className="p-3 bg-green-600 text-black rounded-lg hover:bg-green-700 disabled:bg-gray-600 font-semibold">New Game</button>
              
              {mode === 'automatic' ? (
                <>
                  <button onClick={() => handleGameAction('shuffle_cards')} disabled={!connected || !gameState.canShuffle || gameState.autoDealingInProgress} className="p-3 bg-blue-600 text-black rounded-lg hover:bg-blue-700 disabled:bg-gray-600 font-semibold">🔀 Shuffle</button>
                  <button onClick={() => handleGameAction('auto_deal')} disabled={!connected || gameState.autoDealingInProgress || gameState.playerCards.length > 0 || gameState.bankerCards.length > 0} className="p-3 bg-indigo-600 text-black rounded-lg hover:bg-indigo-700 disabled:bg-gray-600 font-semibold">🤖 Auto Deal</button>
                </>
              ) : (
                <>
                  <button onClick={() => handleGameAction('undo')} disabled={!connected || !gameState.canUndo || gameState.autoDealingInProgress} className="p-3 bg-purple-600 text-black rounded-lg hover:bg-purple-700 disabled:bg-gray-600 font-semibold">↩️ Undo</button>
                  <button onClick={() => handleGameAction('delete_last_entry')} disabled={!connected || !canUndoLastWin || gameState.autoDealingInProgress} className="p-3 bg-purple-800 text-white rounded-lg hover:bg-purple-900 disabled:bg-gray-600 font-semibold">⏪ Undo Last Win</button>
                  <button onClick={() => handleGameAction('reset_game')} disabled={!connected || gameState.autoDealingInProgress} className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-600 font-semibold">🗑️ Reset All</button>
                  {(mode === 'live' || mode === 'vip') && (
                    <button
                      onClick={() => sendMessage({ action: 'shuffle_cards' })}
                      disabled={!connected || gameState.autoDealingInProgress}
                      className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
                    >
                      🔀 Shuffle
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* Manual Mode Content */}
        {mode === 'manual' && (
          <div>
            <div className="bg-yellow-100 p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4 text-black">Manual Result Entry</h3>
              <form onSubmit={handleManualSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center text-black">
                <div className="md:col-span-4">
                  <label className="font-semibold text-black mr-2">Winner:</label>
                  <select value={manualWinner} onChange={e => setManualWinner(e.target.value)} className="p-2 rounded border text-black bg-white">
                    <option value="player">Player</option>
                    <option value="banker">Banker</option>
                    <option value="tie">Tie</option>
                  </select>
                </div>
                <label className="text-black flex items-center gap-2"><input type="checkbox" checked={manualPlayerPair} onChange={e => setManualPlayerPair(e.target.checked)} /> Player Pair</label>
                <label className="text-black flex items-center gap-2"><input type="checkbox" checked={manualBankerPair} onChange={e => setManualBankerPair(e.target.checked)} /> Banker Pair</label>
                <label className="text-black flex items-center gap-2"><input type="checkbox" checked={manualPlayerNatural} onChange={e => setManualPlayerNatural(e.target.checked)} /> Player Natural</label>
                <label className="text-black flex items-center gap-2"><input type="checkbox" checked={manualBankerNatural} onChange={e => setManualBankerNatural(e.target.checked)} /> Banker Natural</label>
                <label className="text-black flex items-center gap-2"><input type="checkbox" checked={manualSuperSix} onChange={e => setManualSuperSix(e.target.checked)} /> Super Six</label>
                <div className="md:col-span-4 mt-4">
                  <button type="submit" disabled={manualSubmitting} className="w-full px-6 py-3 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 font-semibold text-lg">Submit Result</button>
                </div>
              </form>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <button onClick={() => handleGameAction('delete_last_entry')} disabled={!connected || !canUndoLastWin || gameState.autoDealingInProgress} className="p-4 text-lg bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-600 font-semibold">⏪ Delete Last Win</button>
                <button onClick={() => handleGameAction('reset_game')} disabled={!connected || gameState.autoDealingInProgress} className="p-4 text-lg bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-600 font-semibold">🗑️ Delete All Wins</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DealerPage;