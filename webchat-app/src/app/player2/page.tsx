"use client";
import { useState, useEffect } from "react";

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
  winMessage: string;
  naturalWin: boolean;
  naturalType: string | null;
  isSuperSix: boolean;
  lastGameResult?: any;
}

const Player2Page = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isActive, setIsActive] = useState(false);
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
    winMessage: '',
    naturalWin: false,
    naturalType: null,
    isSuperSix: false,
    lastGameResult: null
  });

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        setConnectionStatus('Connecting...');
        const websocket = new WebSocket('ws://localhost:6789');
        
        websocket.onopen = () => {
          setConnected(true);
          setConnectionStatus('Connected');
          setSocket(websocket);
        };

        websocket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          handleMessage(data);
        };

        websocket.onclose = () => {
          setConnected(false);
          setConnectionStatus('Disconnected');
          setSocket(null);
          setTimeout(connectWebSocket, 3000);
        };

        websocket.onerror = () => {
          setConnectionStatus('Connection Error');
        };

      } catch (error) {
        setConnectionStatus('Connection Failed');
        console.error('WebSocket error:', error);
      }
    };

    connectWebSocket();
    return () => socket?.close();
  }, []);

  const handleMessage = (data: any) => {
    switch(data.action) {
      case 'game_state':
        const newGameState = {
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
          burnCard: data.burnCard,
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
          winMessage: data.winMessage || '',
          naturalWin: data.naturalWin || false,
          naturalType: data.naturalType || null,
          isSuperSix: data.is_super_six || false,
          lastGameResult: data.lastGameResult || null
        };
        setGameState(newGameState);
        setIsActive(newGameState.activePlayers.includes('player2'));
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <h1 className="text-3xl font-bold mb-2">🎰 Mini Baccarat - Player 2</h1>
            <div className="flex justify-center items-center gap-4">
              <div className={`text-lg font-semibold ${connected ? 'text-green-400' : 'text-red-400'}`}>
                {connected ? '🟢' : '🔴'} {connectionStatus}
              </div>
              <div className={`text-lg font-semibold ${isActive ? 'text-green-400' : 'text-red-400'}`}>
                {isActive ? '🟢' : '🔴'} {isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>

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
            <div className="bg-gray-800 p-3 rounded text-center">
              <div className="text-gray-400 text-xs">NATURAL</div>
              <div className="font-bold text-lg">{gameState.naturalCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Game Board */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6">
              {/* Player Section */}
              <div className="mb-8 bg-blue-50 p-4 rounded-lg">
                <h2 className="text-2xl font-bold mb-4 text-blue-900">Player</h2>
                <div className="flex gap-4">
                  {gameState.playerCards.map((card, index) => (
                    <div key={index} className="relative">
                      <img
                        src={`/cards/${card.toLowerCase()}.png`}
                        alt={`Card ${card}`}
                        className="w-24 h-36 border rounded shadow-lg"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xl font-semibold text-blue-900">
                  Total: {gameState.playerTotal}
                  {gameState.playerPair && <span className="ml-2">(Pair)</span>}
                </div>
              </div>

              {/* Banker Section */}
              <div className="mb-8 bg-red-50 p-4 rounded-lg">
                <h2 className="text-2xl font-bold mb-4 text-red-900">Banker</h2>
                <div className="flex gap-4">
                  {gameState.bankerCards.map((card, index) => (
                    <div key={index} className="relative">
                      <img
                        src={`/cards/${card.toLowerCase()}.png`}
                        alt={`Card ${card}`}
                        className="w-24 h-36 border rounded shadow-lg"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xl font-semibold text-red-900">
                  Total: {gameState.bankerTotal}
                  {gameState.bankerPair && <span className="ml-2">(Pair)</span>}
                </div>
              </div>

              {/* Game Result */}
              {gameState.gamePhase === 'finished' && (
                <div className="mt-8 text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {gameState.winMessage || (gameState.playerTotal > gameState.bankerTotal ? `Player Wins by ${gameState.playerTotal}` : 
                     gameState.bankerTotal > gameState.playerTotal ? `Banker Wins by ${gameState.bankerTotal}` : "Tie")}
                  </div>
                  <div className="text-xl text-gray-700">
                    {[
                      gameState.playerPair && "Player Pair",
                      gameState.bankerPair && "Banker Pair",
                      gameState.naturalWin && `Natural ${gameState.naturalType === 'natural_9' ? '9' : '8'}`,
                      gameState.isSuperSix && "Super Six"
                    ].filter(Boolean).join(", ")}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Game Info Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-xl font-bold mb-4 text-gray-900">Game Info</h3>
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600 text-sm">Remaining Cards</div>
                  <div className="font-bold text-lg">{gameState.remainingCards}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600 text-sm">Used Cards</div>
                  <div className="font-bold text-lg">{gameState.usedCards}</div>
                </div>
                {gameState.burnCard && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-gray-600 text-sm">Burn Card</div>
                    <div className="font-bold text-lg">{gameState.burnCard}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player2Page;
