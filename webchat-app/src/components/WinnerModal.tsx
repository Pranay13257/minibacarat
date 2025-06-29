import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { motion, AnimatePresence } from "framer-motion";

interface WinnerModalProps {
  show: boolean;
  onClose: () => void;
  winner: string | null;
  isLuckySix?: boolean;
  isNatural?: boolean;
  naturalType?: string | null;
  playerNatural?: boolean;
  bankerNatural?: boolean;
  playerTotal?: number;
  bankerTotal?: number;
}

const WinnerModal = ({ 
  show, 
  onClose, 
  winner, 
  isLuckySix, 
  isNatural, 
  naturalType,
  playerNatural,
  bankerNatural,
  playerTotal = 0,
  bankerTotal = 0
}: WinnerModalProps) => {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (show) {
      setShowConfetti(true);
      console.log("Winner:", winner);

      // Play the audio when modal opens
      const audio = new Audio("/assets/winner-sound.mp3");
      // audio.play();

      // Hide the modal after 7 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      // Stop confetti after 5 seconds
      const confettiTimer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);

      return () => {
        clearTimeout(timer);
        clearTimeout(confettiTimer);
      };
    }
  }, [show, onClose]);

  const getWinnerText = () => {
    if (!winner) return '';
    
    if (winner === 'tie') {
      return `Tie on ${playerTotal}`;
    }
    
    if (winner === 'player') {
      if (playerNatural) {
        return `Player wins by Natural ${naturalType === 'natural_9' ? '9' : '8'}`;
      } else {
        return `Player wins by ${playerTotal}`;
      }
    }
    
    if (winner === 'banker') {
      if (isLuckySix) {
        return `Banker wins by Super Six`;
      } else if (bankerNatural) {
        return `Banker wins by Natural ${naturalType === 'natural_9' ? '9' : '8'}`;
      } else {
        return `Banker wins by ${bankerTotal}`;
      }
    }
    
    return '';
  };

  const getScoreText = () => {
    return `Player ${playerTotal} - Banker ${bankerTotal}`;
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed h-screen w-full z-50 inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
          {showConfetti && <Confetti />}
          
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md flex flex-col items-center text-black"
          >
           
            <div className="text-4xl font-bold text-gray-800 text-center mb-4">
              {getWinnerText()}
            </div>
            <div className="text-lg text-gray-600 text-center mb-4">
              {getScoreText()}
            </div>
            <button
              onClick={onClose}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-xl font-bold hover:bg-blue-700"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default WinnerModal;