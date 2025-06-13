"use client";
import { useState, useEffect } from "react";
import WinnerModal from "@/components/WinnerModal";
import Header from "@/components/Header"
import { motion, AnimatePresence } from "framer-motion";

const WinsBoards = ({ socket, joker }: { socket: WebSocket | null, joker: string | null }) => {
  // const [joker, setJoker] = useState<string | null>(null);
  const [andar, setAndar] = useState<string[]>([]);
  const [bahar, setBahar] = useState<string[]>([]);
  const [cardInput, setCardInput] = useState("");
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState(1);
  const [gameOver, setGameOver] = useState(false); // Track if game has ended
  const [tableNumber, setTableNumber] = useState("1234");
  const [table, setTable] = useState<string | null>("1234");
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      console.log("Received:", data);

      // if (data.action === "set_joker") {
      //   setJoker(data.joker);
      // } else 
      if (data.action === "update_game" && !gameOver) {
        // setJoker(data.joker);
        setAndar(data.andar);
        setBahar(data.bahar);

        // Calculate the correct section based on total cards
        const totalCards = data.andar.length + data.bahar.length;
        setSectionId(totalCards % 2 === 0 ? 1 : 0);



      } else if (data.action === "reset_game") {
        // setJoker(null);
        setAndar([]);
        setBahar([]);
        setSectionId(1);
        setGameOver(() => false);
        setShowWinnerModal(false); // Hide modal on reset
      } else if (data.action === "update_players") {
        console.log(data.players, "players");
      }
      // else if (data.action === "game_won"&& !gameOver) {
      else if (data.action === "game_won") {
        setWinner(data.winner);
        console.log("Winner:", data.winner);
        setGameOver(() => true);
        setShowWinnerModal(true);

        // Auto-hide the modal after 7 seconds
        // setTimeout(() => {
        //   setShowWinnerModal(false);

        // }, 10000);
      }
      else if (data.action === "delete_all_wins") {
        console.log("deleted all wins");
        window.location.reload();
        
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, gameOver]);
  const resetGame = () => {
    if (socket) {
      socket.send(JSON.stringify({ action: "reset_game" }));
      window.location.reload();


    }
  };


  return (
    <div className="flex flex-col items-center   bg-[#8F1504]  w-full">
      <div className="w-full">
      <div className="font-ramaraja p-4 rounded-lg shadow-lg text-left w-full relative bg-wood-pattern">
  <div className="flex justify-between items-center">
    {/* Table Number on the Left */}
    <div className="text-xl text-yellow-300 font-ramaraja">
      Table FT {tableNumber}
    </div>

    {/* Logo in the Center */}
    {/* <div className="flex justify-center items-center">
      <img src="/assets/logo.png" alt="logo" className="h-14" />
    </div> */}

    {/* Image on the Right */}
    <div>
      <img src="/assets/ocean7.png" alt="ocean" className="h-14" />
    </div>
  </div>
</div>

      </div>

      <WinnerModal show={showWinnerModal} onClose={() => setShowWinnerModal(false)} winner={winner} />

      <div className=" grid grid-cols-3 grid-rows-2 w-full border-4 border-yellow-600 h-screen">

        <div className="col-span-2 row-span-1 flex relative  justify-between p-4 border-b-4 border-r-4 border-yellow-600 bg-[#8F1504] " >
          <div className="text-yellow-600 font-ramaraja text-6xl mt-10 font-bold mr-4">
            A
          </div>
          <div className="border-dashed relative border-2 border-yellow-600 rounded-lg w-full h-full bg-[#450A0366]  flex items-center justify-left">
            {/* {andar.map((card, index) => (
            <img key={index} src={`/cards/${card}.png`} alt={card} className="w-60 flex justify-center absolute align-middle" style={{ left: `${index * 25}px`, zIndex: index }} />
          ))} */}
            {andar.map((card, index) => {
              const batchIndex = Math.floor(index / 10);
              const positionInBatch = index % 10;
              const isTenthCard = (index + 1) % 10 === 0;
              const isCurrentBatch = batchIndex === Math.floor((andar.length - 1) / 10);

              // Only render cards from the current batch
              if (!isCurrentBatch) return null;

              // For the 10th card (when it exists)
              if (isTenthCard) {
                return (
                  <AnimatePresence key={`card-${index}`}>
                    <motion.img
                      key={`motion-${index}`}
                      src={`/cards/${card}.png`}
                      alt={card}
                      className="w-60 flex justify-center absolute align-middle"
                      style={{
                        zIndex: 10, // Always on top
                      }}
                      initial={{ x: 225 /* Starting position to the right */ }}
                      animate={{ x: 0 /* Final position at left */ }}
                      transition={{ duration: 0.5 }}
                    />
                  </AnimatePresence>
                );
              }

              // For cards 1-9 that get swept away
              return (
                <AnimatePresence key={`card-${index}`}>
                  <motion.img
                    key={`motion-${index}`}
                    src={`/cards/${card}.png`}
                    alt={card}
                    className="w-60 flex justify-center absolute align-middle"
                    style={{
                      left: `${positionInBatch * 25}px`,
                      zIndex: positionInBatch,
                    }}
                    // When the 10th card exists, animate these cards out in sequence
                    animate={
                      andar.length % 10 === 0 && andar.length >= 10 ?
                        {
                          opacity: 0,
                          x: -100 // Move left as they disappear
                        } :
                        { opacity: 1 }
                    }
                    transition={{
                      // Stagger the disappearing effect based on position
                      duration: 0.3,
                      delay: andar.length % 10 === 0 ? (9 - positionInBatch) * 0.05 : 0
                      // Cards closer to the right disappear first (10th card comes from right)
                    }}
                  />
                </AnimatePresence>
              );
            })}
          </div>
        </div>
        <div className="col-span-1 row-span-1 flex flex-col justify-center border-b-4 border-yellow-600 h-full">
          <div className="ml-2 font-ramaraja text-4xl font-bold w-full p-4 h-full flex flex-col">
            <div className="p-2 w-full h-full flex flex-col gap-4">
              {/* First Section */}
              <div
                className={`flex justify-between items-center p-5 w-full h-1/2 flex-grow ${sectionId === 0 ? "bg-[#07740C]" : "bg-[#FFF8D6]"
                  } text-black text-2xl font-bold`}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-12 h-12">
                    <img src="/assets/blue_a.png" alt="a" className="w-16" />
                  </div>
                  <span className="text-black text-5xl">{andar.length}</span>
                </div>
              </div>

              {/* Second Section */}
              <div
                className={`flex justify-between items-center p-5 w-full h-1/2 flex-grow ${sectionId === 1 ? "bg-[#07740C]" : "bg-[#FFF8D6]"
                  } text-black text-2xl font-bold`}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-12 h-16 pt-1">
                    <img src="/assets/red_b.png" alt="b" className="w-16" />
                  </div>
                  <span className="text-black text-5xl">{bahar.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>


        <div className="col-span-2 row-span-1 flex relative  justify-between p-4 border-r-4 border-yellow-600 bg-[#8F1504] ">
          <div className="text-yellow-600 font-ramaraja text-6xl mt-10 font-bold mr-4 ">
            B
          </div>
          <div className="relative border-dashed border-2 border-yellow-600 rounded-lg w-full h-full bg-[#450A0366] flex items-center justify-left">
            {/* {bahar.map((card, index) => (
            <img key={index} src={`/cards/${card}.png`} alt={card} className="w-60 flex justify-center absolute align-middle" style={{ left: `${index * 25}px`, zIndex: index }} />
          ))} */}
            {bahar.map((card, index) => {
              const batchIndex = Math.floor(index / 10);
              const positionInBatch = index % 10;
              const isTenthCard = (index + 1) % 10 === 0;
              const isCurrentBatch = batchIndex === Math.floor((bahar.length - 1) / 10);

              // Only render cards from the current batch
              if (!isCurrentBatch) return null;

              // For the 10th card (when it exists)
              if (isTenthCard) {
                return (
                  <AnimatePresence key={`card-${index}`}>
                    <motion.img
                      key={`motion-${index}`}
                      src={`/cards/${card}.png`}
                      alt={card}
                      className="w-60 flex justify-center absolute align-middle"
                      style={{
                        zIndex: 10, // Always on top
                      }}
                      initial={{ x: 225 /* Starting position to the right */ }}
                      animate={{ x: 0 /* Final position at left */ }}
                      transition={{ duration: 0.5 }}
                    />
                  </AnimatePresence>
                );
              }

              // For cards 1-9 that get swept away
              return (
                <AnimatePresence key={`card-${index}`}>
                  <motion.img
                    key={`motion-${index}`}
                    src={`/cards/${card}.png`}
                    alt={card}
                    className="w-60 flex justify-center absolute align-middle"
                    style={{
                      left: `${positionInBatch * 25}px`,
                      zIndex: positionInBatch,
                    }}
                    // When the 10th card exists, animate these cards out in sequence
                    animate={
                      bahar.length % 10 === 0 && bahar.length >= 10 ?
                        {
                          opacity: 0,
                          x: -100 // Move left as they disappear
                        } :
                        { opacity: 1 }
                    }
                    transition={{
                      // Stagger the disappearing effect based on position
                      duration: 0.3,
                      delay: bahar.length % 10 === 0 ? (9 - positionInBatch) * 0.05 : 0
                      // Cards closer to the right disappear first (10th card comes from right)
                    }}
                  />
                </AnimatePresence>
              );
            })}
          </div>
        </div>
        <div className="col-span-1 row-span-1 flex flex-col items-center justify-between bg-[#8F1504] h-full w-full p-4">

          {/* Joker Text - Takes up flexible space */}
          <div className="text-yellow-600 font-ramaraja text-6xl font-bold  mb-4">
            JOKER
          </div>

          {/* Dotted Border Box - Takes up flexible space */}
          <div className="w-full border-dashed border-2 border-yellow-600 bg-[#450A0366] rounded-lg flex justify-center items-center flex-grow ">

            <div className="flex justify-center items-center h-full">
              {joker ? (
                <img src={`/cards/${joker}.png`} alt={joker} className="w-60" />
              ) : (
                <img src="/assets/ocean7.png" alt="ocean7" className="w-24 h-24" />
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default WinsBoards;