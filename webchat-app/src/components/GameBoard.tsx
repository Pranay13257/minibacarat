"use client";
import { div } from "framer-motion/client";
import { useState, useEffect, useRef } from "react";

interface GameBoardProps {
  gameState: {
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
    winMessage?: string;
    naturalWin?: boolean;
    naturalType?: string | null;
    isSuperSix?: boolean;
    lastGameResult?: any;
    game_mode?: string;
    cards_revealed?: boolean;
    vip_player_revealer?: string | null;
    vip_banker_revealer?: string | null;
    // Add any other new fields from server.py here
  };
  hideCards?: boolean;
  isBanker: boolean;
  extraWide?: boolean;
  playerId?: string;
  vipRevealer?: string | null;
  connected?: boolean;
  onVipReveal?: () => void;
  sendMessage: (any:any) => void;
}

const GameBoard = ({ gameState, hideCards = false, isBanker, extraWide = false, playerId, vipRevealer, connected, onVipReveal, sendMessage }: GameBoardProps) => {
  const [cardInput, setCardInput] = useState("");
  const [isTouched, setIsTouched] = useState(false);
  const [currPage, setCurrPage] = useState<'dealer' | 'player' | 'stats'>('stats');
  const [canReveal, setCanReveal] = useState(false);
  const [counter,setCounter] = useState(0);
  const counterRef = useRef(0);

  useEffect(() => {
    console.log("vipPlayer="+[gameState.vip_player_revealer]);
    console.log("vipBanker="+[gameState.vip_banker_revealer]);
    if(!isBanker && gameState.vip_player_revealer == playerId){
      setCanReveal(true);
    }
    else if(isBanker && gameState.vip_banker_revealer == playerId){
      setCanReveal(true);
    }
    else{
      setCanReveal(false);
    }
  }, [gameState])

  // Reset counter when game state changes (new game starts)
  useEffect(() => {
    if (gameState.gamePhase === 'dealing' || gameState.gamePhase === 'waiting') {
      setCounter(0);
      counterRef.current = 0;
    }
  }, [gameState.gamePhase])

  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('dealer')) {
      setCurrPage('dealer');
    } else if (path.includes('player')) {
      setCurrPage('player');
    } else {
      setCurrPage('stats');
    }
  }, []);

  const cardClick = () => {
    if ((currPage === 'player' || currPage === 'dealer') && canReveal) {
      counterRef.current += 1; // Immediate update
      console.log(`Card ${counterRef.current} clicked`);
      
      // Use the updated value immediately
      isBanker 
        ? sendMessage({action: `reveal_banker_card_${counterRef.current}`})
        : sendMessage({action: `reveal_player_card_${counterRef.current}`});
    }
  }

  const handleTouchStart = () => {
    if ((currPage === 'player' || currPage === 'dealer') && canReveal) {
      console.log("touched");
      setCounter(prev => {
        const newCounter = prev + 1;
        isBanker ? sendMessage({action:`reveal_banker_card_${newCounter}`}) : sendMessage({action:`reveal_player_card_${newCounter}`});
        return newCounter;
      });
      setIsTouched(true);
    }
  };

  const handleTouchEnd = () => {
    if ((currPage === 'player' || currPage === 'dealer') && canReveal) {
      console.log("untouched");
      setIsTouched(false);
    }
  };

  const renderCard = (card: string) => {
    return (
      // <div key={card} className="relative">
      <div 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={`/cards/${card.toLowerCase()}.png`}
          alt={`Card ${card}`}
          className="w-24 h-36 object-contain"
        />
      </div>
        
      // </div>
    );
  };

  const getWinnerText = () => {
    if (!gameState || gameState.gamePhase !== 'finished') return null;
    if (gameState.winMessage) {
      return gameState.winMessage;
    }
    if (gameState.playerTotal > gameState.bankerTotal) {
      if (gameState.naturalWin && (gameState.naturalType === 'natural_8' || gameState.naturalType === 'natural_9')) {
        return `Player Wins by Natural ${gameState.naturalType === 'natural_8' ? '8' : '9'}`;
      }
      return `Player Wins by ${gameState.playerTotal}`;
    } else if (gameState.bankerTotal > gameState.playerTotal) {
      if (gameState.naturalWin && (gameState.naturalType === 'natural_8' || gameState.naturalType === 'natural_9')) {
        return `Banker Wins by Natural ${gameState.naturalType === 'natural_8' ? '8' : '9'}`;
      }
      return `Banker Wins by ${gameState.bankerTotal}`;
    } else {
      return "Tie";
    }
  };

  const getWinReason = () => {
    if (!gameState || gameState.gamePhase !== 'finished') return null;
    
    const reasons = [];
    if (gameState.playerPair) reasons.push("Player Pair");
    if (gameState.bankerPair) reasons.push("Banker Pair");
    if (gameState.isSuperSix) reasons.push("Super Six");
    
    return reasons.join(", ");
  };

  return (
    <div className={`relative bg-vlightRed rounded-lg shadow-lg p-6 flex flex-col items-center border-2 border-yellow-500 w-fit`}>
      <div className="flex flex-col items-center">
        <h2 className="text-xl mb-4 text-white">{isBanker ? 'BANKER' : 'PLAYER'}</h2>
        <div className="flex gap-4 w-fit">
          {(() => {
            const isVipMode = gameState.game_mode === 'vip';
            const cardsRevealed = !!gameState.cards_revealed;
            const cards = isBanker ? gameState.bankerCards : gameState.playerCards;
            if (cards.length === 0) {
              // No cards dealt: show 2 card backs
              return [0,1].map(i => (
                <img key={i} src="/cards/card_back.png" alt="Card Back" className="w-24 h-36 border rounded shadow-lg opacity-70 mb-2" />
              ));
            } else if (isVipMode && !cardsRevealed) {
              // VIP mode, cards dealt but not revealed: show BR.png for each card
              return cards.map((_, i) => (
                  <img 
                  key={i}
                  src={`/cards/${cards[i].toLowerCase()}.png`}
                  alt="VIP Hidden Card" 
                  className="w-24 h-36 rounded mb-2"
                  onTouchStart={cardClick}
                  onTouchEnd={handleTouchEnd}
                />
              ));
            } else {
              // Normal: show actual cards
              return cards.map(renderCard);
            }
          })()}
        </div>
        {/* VIP Reveal Button - under cards, above total */}
        {(() => {
          const isVipMode = gameState.game_mode === 'vip';
          const cardsRevealed = !!gameState.cards_revealed;
          const revealer = isBanker ? gameState.vip_banker_revealer : gameState.vip_player_revealer;
          const isRevealer = isVipMode && revealer && playerId && revealer === playerId;
          const cards = isBanker ? gameState.bankerCards : gameState.playerCards;
          // if (isVipMode && isRevealer && !cardsRevealed && cards.length > 0) {
          //   return (
          //     <div className="my-4 text-center">
          //       <button
          //         className="px-6 py-3 bg-darkRed text-white rounded-lg font-semibold text-xl"
          //         onClick={onVipReveal}
          //         disabled={!connected}
          //       >
          //         Reveal Cards
          //       </button>
          //     </div>
          //   );
          // }
          return null;
        })()}
      </div>
      <div
        className="absolute bottom-0 text-lg text-white border-2 border-yellow-500 py-2 px-6 bg-darkRed rounded-3xl font-bold shadow-lg"
        style={{ zIndex: 10, transform: "translateY(50%)" }}
      >
        Total: {(() => {
          const isVipMode = gameState.game_mode === 'vip';
          const cardsRevealed = !!gameState.cards_revealed;
          const cards = isBanker ? gameState.bankerCards : gameState.playerCards;
          if (isVipMode && cards.length > 0 && !cardsRevealed) {
            return '--';
          }
          return isBanker ? gameState.bankerTotal : gameState.playerTotal;
        })()}
        {((!gameState.game_mode || gameState.game_mode !== 'vip' || gameState.cards_revealed) && (
          isBanker && gameState.bankerPair && <span className="ml-2">(Pair)</span>
        ))}
        {((!gameState.game_mode || gameState.game_mode !== 'vip' || gameState.cards_revealed) && (
          !isBanker && gameState.playerPair && <span className="ml-2">(Pair)</span>
        ))}
      </div>
    </div>
  );
};

export default GameBoard;