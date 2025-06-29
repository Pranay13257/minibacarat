"use client";
import { useState } from "react";

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
    // Add any other new fields from server.py here
  };
  hideCards?: boolean;
  isBanker: boolean;
  extraWide?: boolean;
}

const GameBoard = ({ gameState, hideCards = false, isBanker, extraWide = false }: GameBoardProps) => {
  const [cardInput, setCardInput] = useState("");

  const renderCard = (card: string) => {
    return (
      <div key={card} className="relative">
        <img
          src={`/cards/${card.toLowerCase()}.png`}
          alt={`Card ${card}`}
          className="w-24 h-36 object-contain"
        />
      </div>
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
        <h2 className="text-xl mb-4 text-white">{isBanker ? 'Banker Cards' : 'Player Cards'}</h2>
        <div className="flex gap-4 w-fit">
          {(() => {
            const isVipMode = gameState.game_mode === 'vip';
            const cardsRevealed = !!gameState.cards_revealed;
            const cards = isBanker ? gameState.bankerCards : gameState.playerCards;
            if (cards.length === 0) {
              // No cards dealt: show 2 card backs
              return [0,1].map(i => (
                <img key={i} src="/cards/card_back.png" alt="Card Back" className="w-24 h-36 border rounded shadow-lg opacity-70" />
              ));
            } else if (isVipMode && !cardsRevealed) {
              // VIP mode, cards dealt but not revealed: show BR.png for each card
              return cards.map((_, i) => (
                <img key={i} src="/cards/BR.png" alt="VIP Hidden Card" className="w-24 h-36 border rounded shadow-lg opacity-70" />
              ));
            } else {
              // Normal: show actual cards
              return cards.map(renderCard);
            }
          })()}
        </div>
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
      </div>
    </div>
  );
};

export default GameBoard;