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
    // Add any other new fields from server.py here
  };
}

const GameBoard = ({ gameState }: GameBoardProps) => {
  const [cardInput, setCardInput] = useState("");

  const renderCard = (card: string) => {
    return (
      <div key={card} className="relative">
        <img
          src={`/cards/${card.toLowerCase()}.png`}
          alt={`Card ${card}`}
          className="w-24 h-36 border rounded shadow-lg"
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
      return `Player Wins by ${gameState.playerTotal}`;
    } else if (gameState.bankerTotal > gameState.playerTotal) {
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
    if (gameState.naturalWin) {
      reasons.push(`Natural ${gameState.naturalType === 'natural_9' ? '9' : '8'}`);
    }
    if (gameState.isSuperSix) reasons.push("Super Six");
    
    return reasons.join(", ");
  };

  if (!gameState) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Game Info */}
      <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-100 p-2 rounded">
          <div className="text-gray-600">Round</div>
          <div className="font-bold text-black">{gameState.round}</div>
        </div>
        <div className="bg-gray-100 p-2 rounded">
          <div className="text-gray-600">Remaining Cards</div>
          <div className="font-bold text-black">{gameState.remainingCards}</div>
        </div>
      </div>

      {/* Player Cards */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-black">Player Cards</h2>
        <div className="flex gap-4">
          {gameState.playerCards.map(renderCard)}
        </div>
        <div className="mt-2 text-lg font-semibold text-black">
          Total: {gameState.playerTotal}
          {gameState.playerPair && <span className="ml-2">(Pair)</span>}
        </div>
      </div>

      {/* Banker Cards */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-black">Banker Cards</h2>
        <div className="flex gap-4">
          {gameState.bankerCards.map(renderCard)}
        </div>
        <div className="mt-2 text-lg font-semibold text-black">
          Total: {gameState.bankerTotal}
          {gameState.bankerPair && <span className="ml-2">(Pair)</span>}
        </div>
      </div>

      {/* Game Result */}
      {gameState.gamePhase === 'finished' && (
        <div className="mt-8 text-center">
          <div className="text-2xl font-bold text-black mb-2">
            {getWinnerText()}
          </div>
          <div className="text-lg text-black">
            {getWinReason()}
          </div>
        </div>
      )}

      {gameState.lastGameResult && (
        <div className="mt-4 p-2 bg-yellow-100 rounded text-yellow-800">
          <div className="font-bold">Last Game Undo Info:</div>
          <pre className="text-xs">{JSON.stringify(gameState.lastGameResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default GameBoard;