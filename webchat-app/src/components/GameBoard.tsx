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
    vip_revealer?: string | null;
    // Add any other new fields from server.py here
  };
  hideCards?: boolean;
  isBanker: boolean;
  extraWide?: boolean;
  playerId?: string;
  vipRevealer?: string | null;
  connected?: boolean;
  onVipReveal?: () => void;
}

const GameBoard = ({ gameState, hideCards = false, isBanker, extraWide = false, playerId, vipRevealer, connected, onVipReveal }: GameBoardProps) => {
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
    
    const playerScore = gameState.playerTotal;
    const bankerScore = gameState.bankerTotal;
    
    if (playerScore > bankerScore) {
      if (gameState.naturalWin && gameState.playerPair) {
        return `Player wins by Natural ${gameState.naturalType === 'natural_9' ? '9' : '8'}`;
      }
      return `Player wins by ${playerScore}`;
    } else if (bankerScore > playerScore) {
      if (gameState.isSuperSix) {
        return `Banker wins by Super Six`;
      } else if (gameState.naturalWin && gameState.bankerPair) {
        return `Banker wins by Natural ${gameState.naturalType === 'natural_9' ? '9' : '8'}`;
      }
      return `Banker wins by ${bankerScore}`;
    } else {
      return `Tie on ${playerScore}`;
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
                <img key={i} src="/cards/card_back.png" alt="Card Back" className="w-24 h-36 border rounded shadow-lg opacity-70 mb-2" />
              ));
            } else if (isVipMode && !cardsRevealed) {
              // VIP mode, cards dealt but not revealed: show BR.png for each card
              return cards.map((_, i) => (
                <img key={i} src="/cards/BR.png" alt="VIP Hidden Card" className="w-24 h-36 border rounded shadow-lg opacity-70 mb-2" />
              ));
            } else {
              // Normal: show actual cards
              return cards.map(renderCard);
            }
          })()}
        </div>
        {/* VIP Reveal Button for Player - under cards, above total */}
        {!isBanker && (() => {
          const isVipMode = gameState.game_mode === 'vip';
          const cardsRevealed = !!gameState.cards_revealed;
          const isRevealer = isVipMode && vipRevealer && playerId && vipRevealer === playerId;
          const cards = gameState.playerCards;
          if (isVipMode && isRevealer && !cardsRevealed && cards.length > 0) {
            return (
              <div className="my-4 text-center">
                <button
                  className="px-6 py-3 bg-darkRed text-white rounded-lg font-semibold text-xl"
                  onClick={onVipReveal}
                  disabled={!connected}
                >
                  Reveal Cards
                </button>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Player Cards */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-black">Player Cards</h2>
        <div className="flex gap-4">
          {gameState.playerCards.map(renderCard)}
        </div>
        <div className="mt-2 text-lg font-semibold text-black">
          Total: {gameState.playerTotal}
        </div>
        {gameState.playerPair && (
          <div className="mt-1 text-sm font-bold text-red-600">
            PAIR
          </div>
        )}
      </div>

      {/* Banker Cards */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-black">Banker Cards</h2>
        <div className="flex gap-4">
          {gameState.bankerCards.map(renderCard)}
        </div>
        <div className="mt-2 text-lg font-semibold text-black">
          Total: {gameState.bankerTotal}
        </div>
        {gameState.bankerPair && (
          <div className="mt-1 text-sm font-bold text-red-600">
            PAIR
          </div>
        )}
      </div>
    </div>
  );
};

export default GameBoard;