import { useState, useEffect } from 'react';
import Image from 'next/image';

interface PlayerBoardProps {
  socket: WebSocket | null;
}

const PlayerBoard = ({ socket }: PlayerBoardProps) => {
  const [gameState, setGameState] = useState<any>(null);
  const [playerCards, setPlayerCards] = useState<string[]>([]);
  const [bankerCards, setBankerCards] = useState<string[]>([]);
  const [playerTotal, setPlayerTotal] = useState<number>(0);
  const [bankerTotal, setBankerTotal] = useState<number>(0);
  const [gamePhase, setGamePhase] = useState<string>('waiting');
  const [playerPair, setPlayerPair] = useState<boolean>(false);
  const [bankerPair, setBankerPair] = useState<boolean>(false);
  const [isLuckySix, setIsLuckySix] = useState<boolean>(false);
  const [isNatural, setIsNatural] = useState<boolean>(false);
  const [naturalType, setNaturalType] = useState<string | null>(null);
  const [winMessage, setWinMessage] = useState<string | null>(null);
  const [round, setRound] = useState<number>(0);
  const [remainingCards, setRemainingCards] = useState<number>(0);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      console.log('Received game state:', data);

      if (data.action === 'game_state') {
        setGameState(data);
        setPlayerCards(data.playerCards || []);
        setBankerCards(data.bankerCards || []);
        setPlayerTotal(data.playerTotal || 0);
        setBankerTotal(data.bankerTotal || 0);
        setGamePhase(data.gamePhase || 'waiting');
        setPlayerPair(data.playerPair || false);
        setBankerPair(data.bankerPair || false);
        setRound(data.round || 0);
        setRemainingCards(data.remainingCards || 0);
      } else if (data.action === 'game_result') {
        setIsLuckySix(data.isLuckySix || false);
        setIsNatural(data.isNatural || false);
        setNaturalType(data.naturalType || null);
        setWinMessage(data.winMessage || null);
        setGamePhase('finished');
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket]);

  const getCardImage = (card: string) => {
    if (!card) return '/cards/back.png';
    return `/cards/${card.toLowerCase()}.png`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-black text-white p-4">
      {/* Game Status */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold">
          {gamePhase === 'waiting' && 'Waiting for game to start...'}
          {gamePhase === 'third_card_phase' && 'Third Card Phase'}
          {gamePhase === 'finished' && 'Game Finished'}
        </h2>
      </div>

      {/* Game Info */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="bg-gray-800 p-3 rounded text-center">
          <div className="text-gray-400 text-xs">ROUND</div>
          <div className="font-bold text-lg">{round}</div>
        </div>
        <div className="bg-gray-800 p-3 rounded text-center">
          <div className="text-gray-400 text-xs">REMAINING CARDS</div>
          <div className="font-bold text-lg">{remainingCards}</div>
        </div>
      </div>

      {/* Player Section */}
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-2">Player</h3>
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            {playerCards.map((card, index) => (
              <div key={index} className="relative w-24 h-36">
                <Image
                  src={getCardImage(card)}
                  alt={`Player card ${index + 1}`}
                  fill
                  className="object-contain"
                />
              </div>
            ))}
          </div>
          <div className="text-2xl font-bold">
            Total: {playerTotal}
            {playerPair && <span className="ml-2 text-yellow-400">Pair!</span>}
          </div>
        </div>
      </div>

      {/* Banker Section */}
      <div>
        <h3 className="text-xl font-bold mb-2">Banker</h3>
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            {bankerCards.map((card, index) => (
              <div key={index} className="relative w-24 h-36">
                <Image
                  src={getCardImage(card)}
                  alt={`Banker card ${index + 1}`}
                  fill
                  className="object-contain"
                />
              </div>
            ))}
          </div>
          <div className="text-2xl font-bold">
            Total: {bankerTotal}
            {bankerPair && <span className="ml-2 text-yellow-400">Pair!</span>}
          </div>
        </div>
      </div>

      {/* Game Results */}
      {gamePhase === 'finished' && (
        <div className="mt-8 text-center">
          {winMessage && (
            <div className="text-2xl font-bold text-yellow-400 mb-2">
              {winMessage}
            </div>
          )}
          {isLuckySix && <div className="text-yellow-400 text-xl">Lucky Six!</div>}
          {isNatural && (
            <div className="text-green-400 text-xl">
              Natural {naturalType === 'natural_9' ? '9' : '8'}!
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PlayerBoard; 