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
}

const WinnerModal = ({ show, onClose, winner, isLuckySix, isNatural, naturalType }: WinnerModalProps) => {
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

  if (!show) return null;

  const getWinnerText = () => {
    if (!winner) return '';
    if (winner === 'tie') return 'Tie Game!';
    return `${winner.charAt(0).toUpperCase() + winner.slice(1)} Wins!`;
  };

  const getSpecialWinText = () => {
    if (isLuckySix) return 'Lucky Six!';
    if (isNatural) {
      return `Natural ${naturalType === 'natural_9' ? '9' : '8'}!`;
    }
    return '';
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
            {getSpecialWinText() && (
              <div className="text-2xl font-bold text-yellow-600 text-center mb-4">
                {getSpecialWinText()}
              </div>
            )}
            <div className="flex items-center justify-center">
              {winner === '0' && (
                <>
                <img src="/assets/blue_a.png" alt="Andar Wins" className="w-24 h-24 mr-4" />
                <div className="text-4xl font-bold text-gray-800 text-center mb-4 w-full">
              BANKER WINS!!
              </div>
              </>
              )}
              {winner === '1' && (
                <>
                <img src="/assets/red_b.png" alt="Bahar Wins" className="w-24 h-24 mr-4" />
                <div className="text-4xl font-bold text-gray-800 text-center mb-4 w-full">
              PLAYER WINS!!
              </div>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="bg-darkRed text-white px-6 py-2 rounded-lg text-xl font-bold hover:bg-blue-700"
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