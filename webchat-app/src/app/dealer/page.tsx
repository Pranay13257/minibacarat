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
    lastGameResult: null
  });

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
          lastGameResult: data.lastGameResult || null
        };
        
        if (newGameState.burnEnabled && !hasBurnedCard) {
          setShowBurnPopup(true);
        }
        
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
    if (gameState.naturalWin) {
      reasons.push(`Natural ${gameState.naturalType === 'natural_9' ? '9' : '8'}`);
    }
    if (gameState.isSuperSix) reasons.push("Super Six");
    
    return reasons.join(", ");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Burn Card Popup */}
      {showBurnPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-center">🔥 Burn Card Required</h3>
            <p className="text-gray-600 mb-4 text-center">Enter a card to burn before dealing</p>
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={burnCardInput}
                onChange={(e) => setBurnCardInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && burnCard()}
                placeholder="e.g., 2C, JH, AS"
                className="flex-1 p-3 border rounded-lg text-center font-mono text-lg"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={burnCard}
                disabled={!burnCardInput.trim()}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 font-semibold"
              >
                🔥 Burn Card
              </button>
            </div>
          </div>
        </div>
      )}

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

          {/* Game Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-4 text-sm">
            <div className="bg-gray-800 p-3 rounded text-center">
              <div className="text-gray-400 text-xs">ROUND</div>
              <div className="font-bold text-lg">{gameState.round}</div>
            </div>
            <div className="bg-blue-900 p-3 rounded text-center">
              <div className="text-blue-300 text-xs">PLAYER</div>
              <div className="font-bold text-lg text-blue-200">{gameState.playerWins}</div>
            </div>
            <div className="bg-red-900 p-3 rounded text-center">
              <div className="text-red-300 text-xs">BANKER</div>
              <div className="font-bold text-lg text-red-200">{gameState.bankerWins}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded text-center">
              <div className="text-gray-400 text-xs">TIES</div>
              <div className="font-bold text-lg">{gameState.ties}</div>
            </div>
            <div className="bg-green-900 p-3 rounded text-center">
              <div className="text-green-300 text-xs">NATURALS</div>
              <div className="font-bold text-lg text-green-200">{gameState.naturalCount}</div>
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

          {/* Card Input */}
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

          {/* Control Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            <button 
              onClick={() => handleGameAction('start_new_game')} 
              disabled={!connected || gameState.autoDealingInProgress} 
              className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 font-semibold"
            >
              🎮 New Game
            </button>
            <button 
              onClick={() => handleGameAction('calculate_result')} 
              disabled={!connected || !gameState.canCalculate || gameState.autoDealingInProgress} 
              className="p-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-600 font-semibold"
            >
              🏆 Calculate
            </button>
            <button 
              onClick={() => handleGameAction('undo')} 
              disabled={!connected || !gameState.canUndo || gameState.autoDealingInProgress} 
              className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-600 font-semibold"
            >
              ↩️ Undo
            </button>
            <button 
              onClick={() => handleGameAction('shuffle_cards')} 
              disabled={!connected || !gameState.canShuffle || gameState.autoDealingInProgress} 
              className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 font-semibold"
            >
              🔀 Shuffle
            </button>
            <button 
              onClick={() => handleGameAction('reset_game')} 
              disabled={!connected || gameState.autoDealingInProgress} 
              className="p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-600 font-semibold"
            >
              🔄 Reset
            </button>
            <button 
              onClick={() => handleGameAction('auto_deal')} 
              disabled={!connected || gameState.autoDealingInProgress || gameState.playerCards.length > 0 || gameState.bankerCards.length > 0} 
              className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-600 font-semibold"
            >
              🤖 Auto Deal
            </button>
            <button
              onClick={() => handleGameAction('delete_last_entry')}
              disabled={!connected || gameState.autoDealingInProgress}
              className="p-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-gray-600 font-semibold"
            >
              ⏪ Last Win Undo
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Game Board */}
          <div className="lg:col-span-2">
            <GameBoard gameState={gameState} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealerPage;