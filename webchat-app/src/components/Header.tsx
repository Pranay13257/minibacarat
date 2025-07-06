import React from "react";

interface HeaderProps {
  onMenuClick?: () => void;
  activePlayers: string[];
  onTogglePlayer: (playerId: string) => void;
  tableNumber?: string;
  handleGameAction: (action: string) => void
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, activePlayers, onTogglePlayer, tableNumber, handleGameAction }) => {
  return (
    <div className="flex items-center justify-between w-full h-[15vh] font-questrial px-4 overflow-hidden" style={{ backgroundImage: 'url(/assets/wood.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {/* Optional: Black overlay for contrast */}
      
      {/* Left: Image + Table Number */}
      <div className="flex flex-col items-center justify-center h-full min-w-[120px] z-10 mb-2">
        <img
          src="/assets/mini_baccarat.png"
          alt="Mini Baccarat"
          className="h-14 w-auto mb-2 object-contain"
        />
        <span className="text-yellow-300 text-lg font-bold text-center">Table: {tableNumber || '-'}</span>
      </div>

      {/* Center: 6 Hats for Players */}
      <div className="flex-1 flex justify-center items-center gap-4 z-10 mb-2">
        {[1,2,3,4,5,6].map((num) => {
          const playerId = `player${num}`;
          const isActive = activePlayers.includes(playerId);
          return (
            <img
              key={playerId}
              src={isActive ? "/assets/whitehat.png" : "/assets/redhat.png"}
              alt={isActive ? "White Hat (Active)" : "Red Hat (Inactive)"}
              className="h-14 w-auto object-contain cursor-pointer transition-transform hover:scale-110"
              onClick={() => onTogglePlayer(playerId)}
            />
          );
        })}
      </div>

      {/* Right: Menu */}
      <div className="flex flex-col items-center justify-end h-full min-w-[60px] z-10 pb-6 gap-0.5">
        <img
          src="/assets/menu.png"
          alt="Menu"
          className="h-16 w-auto object-contain mr-2 cursor-pointer"
          onClick={onMenuClick}
        />
        <button
          className="rounded-lg shadow text-xl font-bold flex items-center justify-center text-wrap mr-1"
          style={{ width: 140, height: 35, backgroundColor: '#741003', color: '#fff' }}
          onClick={() => handleGameAction('start_new_game')}
        >
          New game
        </button>
      </div>
    </div>
  );
};

export default Header;
