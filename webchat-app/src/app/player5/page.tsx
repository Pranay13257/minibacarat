"use client";
import { useState, useEffect } from "react";
import GameBoard from "../../components/GameBoard";
import WinnerModal from "../../components/WinnerModal";
import { IP } from "../ip";

const PLAYER_ID = 'player5';

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
  table_number?: string;
  max_bet?: number;
  min_bet?: number;
  game_mode?: string;
  vip_revealer?: string | null;
  cards_revealed?: boolean;
  winner?: string | null;
  showWinnerModal: boolean;
  vip_player_revealer?: string | null;
  vip_banker_revealer?: string | null;
}

const Player5Page = () => {
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
    lastGameResult: null,
    table_number: "",
    max_bet: 0,
    min_bet: 0,
    game_mode: undefined,
    vip_revealer: null,
    cards_revealed: false,
    winner: null,
    showWinnerModal: false,
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
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        setConnectionStatus('Connecting...');
        const websocket = new WebSocket(`ws://${IP}:6789`);
        
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

  useEffect(() => {
    if (gameState.gamePhase === "finished") {
      setShowWinnerModal(true);
    } else {
      setShowWinnerModal(false);
    }
  }, [gameState.gamePhase]);

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
          lastGameResult: data.lastGameResult || null,
          table_number: data.table_number || "",
          max_bet: data.max_bet || 0,
          min_bet: data.min_bet || 0,
          game_mode: data.game_mode || undefined,
          vip_revealer: data.vip_revealer || null,
          cards_revealed: data.cards_revealed || false,
          winner: data.winner || null,
          showWinnerModal: data.showWinnerModal || false,
          vip_player_revealer: data.vip_player_revealer || null,
          vip_banker_revealer: data.vip_banker_revealer || null,
        };
        setGameState(newGameState);
        setIsActive(newGameState.activePlayers.includes(PLAYER_ID));
        break;
    }
  };

  const isVipMode = gameState.game_mode === 'vip';
  const isRevealer = isVipMode && gameState.vip_revealer === PLAYER_ID;
  const cardsRevealed = !!gameState.cards_revealed;

  const sendMessage = (msg: any) => {
    if (socket && connected) {
      socket.send(JSON.stringify(msg));
    }
  };

  return (
    isActive ? (
      <div className="min-h-screen bg-vdarkRed flex flex-col justify-between items-center">
        {/* Header */}
        <div className="w-full h-[12vh]" style={{ backgroundImage: 'url(/assets/wood.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="flex flex-row items-center justify-between ">
            <div className="flex flex-col items-center justify-center h-full min-w-[120px] z-10 ml-4 mr-4 mt-2 mb-4">
              <img
              src="/assets/mini_baccarat.png"
              alt="Mini Baccarat"
              className="h-14 w-auto mb-2 object-contain"
              />
              <span className="text-yellow-300 text-lg font-bold text-center">Table: {gameState.table_number}</span>
            </div>
            <img
                src="/assets/ocean7.png"
                className="h-14 w-auto object-contain scale-150"
              />
            <div className="flex flex-col items-center justify-center h-full min-w-[120px] z-10 ml-4 mr-4 mt-2 mb-4">
            <span className="text-yellow-300 text-lg font-bold text-center">Bet:</span>
            <span className="text-yellow-300 text-lg font-bold text-center">Max: {gameState.max_bet}</span>
            <span className="text-yellow-300 text-lg font-bold text-center">Min: {gameState.min_bet}</span>
          </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="h-[75vh] w-[95vw] border-4 border-yellow-500 bg-midRed m-4 grid grid-cols-12 grid-rows-12">

          <div className="col-start-2 col-end-5 row-start-4 row-end-11 relative overflow-hidden" style={{transform : "translateY(-30px)"}}>
            <img
              src="/assets/red_design.png"
              alt=""
              className="absolute left-1/2 top-1/2"
              style={{
                transform: "translate(-50%, -50%) rotate(-90deg)",
                width: "40vh",
                height: "auto",
                maxWidth: "none",
                maxHeight: "40vw",
              }}
            />
          </div>
          {/* Banker GameBoard (top, ends at row 7) */}
          <div className="col-start-4 col-end-10 row-start-3 row-end-7 flex justify-center items-end m-6">
            <GameBoard gameState={gameState} hideCards={isVipMode && !cardsRevealed} isBanker={true} extraWide={gameState.bankerCards.length === 3} playerId={PLAYER_ID}/>
          </div>
          {/* Player GameBoard (bottom, starts at row 7) */}
          <div className="col-start-4 col-end-10 row-start-7 row-end-11 flex justify-center items-start m-6">
            <GameBoard
              gameState={gameState}
              hideCards={isVipMode && !cardsRevealed}
              isBanker={false}
              extraWide={gameState.playerCards.length === 3}
              playerId={PLAYER_ID}
              vipRevealer={gameState.vip_revealer}
              connected={connected}
              onVipReveal={() => sendMessage({ action: 'vip_reveal', player_id: PLAYER_ID })}
            />
          </div>
          <div className="col-start-9 col-end-12 row-start-4 row-end-11 relative overflow-hidden" style={{transform : "translateY(-30px)"}}>
            <img
              src="/assets/red_design.png"
              alt=""
              className="absolute left-1/2 top-1/2"
              style={{
                transform: "translate(-50%, -50%) rotate(90deg)",
                width: "40vh",
                height: "auto",
                maxWidth: "none",
                maxHeight: "40vw",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="h-[10vh] w-full rotate-180" style={{ backgroundImage: 'url(/assets/wood.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        </div>

        {/* Winner Modal */}
        {showWinnerModal && (
          <WinnerModal
            show={showWinnerModal}
            winner={gameState.winner ?? null}
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
    ) : (
      <div className="flex justify-center items-center h-screen w-screen bg-black">
        <video autoPlay loop muted className="w-full h-full object-cover">
          <source src="/assets/ocean7vid.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    )
  );
};

export default Player5Page;
