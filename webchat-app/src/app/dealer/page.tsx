"use client";
import { useState, useEffect, useRef } from "react";
import GameBoard from "@/components/GameBoard";
import ControlPanelPopup from "@/components/ControlPanelPopup";
import Header from "@/components/Header";
import WinnerModal from "@/components/WinnerModal";
import { IP } from "../ip";

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
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  // VIP mode revealer selection state
  const [selectedRevealer, setSelectedRevealer] = useState('');

  useEffect(() => {
    if (gameState.gamePhase === "finished") {
      setShowWinnerModal(true);
    } else {
      setShowWinnerModal(false);
    }
  }, [gameState.gamePhase]);

  // Update mode from gameState
  useEffect(() => {
    if (gameState && gameState.game_mode) setMode(gameState.game_mode);
  }, [gameState.game_mode]);

  // Mode selection handler
  const handleModeChange = (e: string) => {
    // const newMode = e.target.value;
    const newMode = e;
    setMode(newMode);
    sendMessage({ action: 'set_game_mode', mode: newMode });
  };

  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);

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
        const websocket = new WebSocket(`ws://${IP}:6789`);
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
          burnMode: typeof data.burnMode !== 'undefined' ? data.burnMode : 'inactive',
          winner: data.winner || null
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
      // if (!window.confirm('Reset everything? This will clear all game data.')) {
      //   return;
      // }
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
    <div className="min-h-screen bg-vdarkRed flex flex-col justify-start items-center">
      <Header
        onMenuClick={() => setIsControlPanelOpen(true)}
        activePlayers={gameState.activePlayers}
        onTogglePlayer={togglePlayer}
        tableNumber={gameState.table_number}
        handleGameAction={handleGameAction}
      />
      {/* Control Panel Button and Popup */}
      <ControlPanelPopup 
        open={isControlPanelOpen}
        onClose={() => setIsControlPanelOpen(false)}
        handleGameAction={handleGameAction}
        stats={stats}
        tableNumberInput={tableNumberInput}
        setTableNumberInput={setTableNumberInput}
        saveTableNumber={saveTableNumber}
        maxBetInput={maxBetInput}
        setMaxBetInput={setMaxBetInput}
        minBetInput={minBetInput}
        setMinBetInput={setMinBetInput}
        saveMaxBet={saveMaxBet}
        saveMinBet={saveMinBet}
        addCard={addCard}
        cardInput={cardInput}
        setCardInput={setCardInput}
        sendMessage={sendMessage}
        gameState={gameState}
        selectedMode={mode}
        setSelectedMode={handleModeChange}
        connected={connected}
        setSelectedRevealer={setSelectedRevealer}
        canUndoLastWin={canUndoLastWin}
      />
      {/* {statusMessage && (
            <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4 text-center">
              {statusMessage}
            </div>
      )} */}
      {/* Main Content Area */}
      <div className="h-[80vh] w-[95vw] m-4 bg-midRed border-4 border-yellow-500 grid grid-cols-12 grid-rows-12">
        <div className="col-start-5 col-end-9 row-start-1 row-end-3 z-40" style={{transform: "translateY(-25%)"}}>
          <img src="/assets/golden_design.png" alt="" className=""/>
        </div>
        <div className="col-start-5 col-end-9 row-start-2 row-end-4" style={{transform: "translateX(1px)"}}>
          <img src="/assets/red_design.png" alt="" className="z-10"/>
        </div>
        <div className={`${gameState.bankerCards.length === 3 ? 'col-start-2 col-end-7' : 'col-start-4 col-end-7'} row-start-4 row-end-10 flex justify-end m-2`}>
          <GameBoard gameState={gameState} hideCards={mode === 'vip' && !gameState.cards_revealed} isBanker={true} extraWide={gameState.bankerCards.length === 3}/>
        </div>
        <div className={`${gameState.playerCards.length === 3 ? 'col-start-7 col-end-12' : 'col-start-7 col-end-10'} row-start-4 row-end-10 flex justify-start m-2`}>
          <GameBoard gameState={gameState} hideCards={mode === 'vip' && !gameState.cards_revealed} isBanker={false} extraWide={gameState.playerCards.length === 3}/>
        </div>
        <div className="col-start-5 col-end-9 row-start-10 row-end-12" style={{transform: "translateX(1/2px)"}}>
          <img src="/assets/red_design.png" alt="" className="rotate-180"/>
        </div>
        <div className="col-start-5 col-end-9 row-start-11 row-end-13 z-40 flex flex-col justify-start" style={{transform: "translateY(25%) translateX(1px)"}}>
          <img src="/assets/golden_design.png" alt="" className="rotate-180"/>
        </div>
        {showWinnerModal && (
          <WinnerModal
            show={showWinnerModal}
            winner={gameState.winner}
            isLuckySix={gameState.isSuperSix}
            isNatural={gameState.naturalWin}
            naturalType={gameState.naturalType}
            playerTotal={gameState.playerTotal}
            bankerTotal={gameState.bankerTotal}
            playerNatural={!!(
              gameState.naturalWin &&
              (gameState.playerTotal > gameState.bankerTotal) &&
              (gameState.naturalType === 'natural_8' || gameState.naturalType === 'natural_9')
            )}
            bankerNatural={!!(
              gameState.naturalWin &&
              (gameState.bankerTotal > gameState.playerTotal) &&
              (gameState.naturalType === 'natural_8' || gameState.naturalType === 'natural_9')
            )}
            onClose={() => setShowWinnerModal(false)}
            gameMode={gameState.game_mode}
          />
        )}
      </div>
    </div>
  );
};

export default DealerPage;