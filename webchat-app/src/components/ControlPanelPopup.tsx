import React, { useState } from "react";

interface ControlPanelPopupProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  handleGameAction: (action: string) => void;
  stats: {
    banker_wins: number;
    player_wins: number;
    ties: number;
    player_pairs: number;
    banker_pairs: number;
    player_naturals: number;
    banker_naturals: number;
  };
  tableNumberInput: string;
  setTableNumberInput: (val: string) => void;
  saveTableNumber: () => void;
  maxBetInput: string;
  setMaxBetInput: (val: string) => void;
  minBetInput: string;
  setMinBetInput: (val: string) => void;
  saveMaxBet: () => void;
  saveMinBet: () => void;
  addCard: () => void;
  cardInput: string;
  setCardInput: (val: string) => void;
  sendMessage: (msg: Record<string, any>) => void;
  gameState: any;
  selectedMode : string;
  setSelectedMode : (val: any) => void;
  connected : boolean;
  setSelectedRevealer : (val: string) => void;
  canUndoLastWin: boolean;
}

const ControlPanelPopup: React.FC<ControlPanelPopupProps> = ({ open, onClose, children, handleGameAction, stats, tableNumberInput, setTableNumberInput, saveTableNumber, maxBetInput, setMaxBetInput, minBetInput, setMinBetInput, saveMaxBet, saveMinBet, addCard, cardInput, setCardInput, sendMessage, gameState, selectedMode, setSelectedMode, connected, setSelectedRevealer, canUndoLastWin}) => {
  // const [selectedMode, setSelectedMode] = useState<'automatic' | 'manual' | 'live'>('manual');
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [selectedRank, setSelectedRank] = useState<string | null>(null);
  const [selectedSuit, setSelectedSuit] = useState<string | null>(null);
  const [tempTableNumber, setTempTableNumber] = useState(1);
  const [isWinConditionModalOpen, setIsWinConditionModalOpen] = useState(false);
  // Manual Result Entry state for form
  const [manualWinner, setManualWinner] = useState('player');
  const [manualPlayerPair, setManualPlayerPair] = useState(false);
  const [manualBankerPair, setManualBankerPair] = useState(false);
  const [manualPlayerNatural, setManualPlayerNatural] = useState(false);
  const [manualBankerNatural, setManualBankerNatural] = useState(false);
  const [manualSuperSix, setManualSuperSix] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Manual result form submit handler
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualSubmitting(true);
    sendMessage({
      action: 'manual_result',
      winner: manualWinner,
      player_pair: manualPlayerPair,
      banker_pair: manualBankerPair,
      player_natural: manualPlayerNatural,
      banker_natural: manualBankerNatural,
      is_super_six: manualSuperSix
    });
    setTimeout(() => setManualSubmitting(false), 1000);
  };

  if (!open) return null;

  return (
    <>
      {isBetModalOpen && (
        <div className="fixed top-0 left-0 h-full w-full z-[60] flex items-center justify-center bg-black bg-opacity-60">
          <div className="rounded-lg shadow-lg p-8 relative min-w-[320px] max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center" style={{ backgroundColor: '#F0DEAD' }}>
            <h2 className="text-3xl font-bold mb-6 text-black">Change Bet Settings</h2>
            <div className="flex flex-col gap-4 w-full max-w-md">
              <div className="flex flex-col gap-2">
                <label className="text-xl font-semibold text-black">Minimum Bet</label>
                <input
                  type="number"
                  value={minBetInput}
                  onChange={(e) => setMinBetInput(e.target.value)}
                  className="px-4 py-2 border rounded-lg text-3xl text-black"
                  min="1"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xl font-semibold text-black">Maximum Bet</label>
                <input
                  type="number"
                  value={maxBetInput}
                  onChange={(e) => setMaxBetInput(e.target.value)}
                  className="px-4 py-2 border rounded-lg text-3xl text-black"
                  min="1"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button
                className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xl font-bold hover:bg-green-600"
                onClick={() => {
                  const min = Number(minBetInput);
                  const max = Number(maxBetInput);
                  if(max > min){
                  setBetError(null);
                  saveMinBet();
                  saveMaxBet();
                  setIsBetModalOpen(false);
                  }
                }}
              >
                Save Changes
              </button>
              <button
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xl font-bold hover:bg-red-600"
                onClick={() => { setIsBetModalOpen(false); setBetError(null); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {isTableModalOpen && (
        <div className="fixed top-0 left-0 h-full w-full z-[60] flex items-center justify-center bg-black bg-opacity-60">
          <div className="rounded-lg shadow-lg p-8 relative min-w-[320px] max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center" style={{ backgroundColor: '#F0DEAD' }}>
            <h2 className="text-3xl font-bold mb-6 text-black">Change Table Number</h2>
            <div className="flex flex-col gap-4 w-full max-w-md">
              <div className="flex flex-col gap-2">
                <label className="text-xl font-semibold text-black">Table Number</label>
                <input
                  type="text"
                  value={tableNumberInput}
                  onChange={(e) => setTableNumberInput(e.target.value)}
                  className="px-4 py-2 border rounded-lg text-3xl text-black"
                  min="1"
                  placeholder="Enter table number"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button
                className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xl font-bold hover:bg-green-600"
                onClick={() => { saveTableNumber(); setIsTableModalOpen(false); }}
              >
                Save Changes
              </button>
              <button
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xl font-bold hover:bg-red-600"
                onClick={() => setIsTableModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {isWinConditionModalOpen && (
        <div className="fixed top-0 left-0 h-full w-full z-[70] flex items-center justify-center bg-black bg-opacity-60">
          <div className="rounded-lg shadow-lg p-8 relative min-w-[320px] max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center" style={{ backgroundColor: '#F0DEAD' }}>
            <button
              onClick={() => setIsWinConditionModalOpen(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl font-bold focus:outline-none"
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-3xl font-bold mb-6 text-black">Win Condition</h2>
            <div className="flex flex-col gap-4 w-full max-w-md items-center">
              {['Player Pair', 'Banker Pair', 'Player Natural', 'Banker Natural', 'Super Six'].map((label, i) => (
                <button
                  key={`wincond-btn-${i}`}
                  className="w-64 h-14 rounded-lg bg-[#911606] text-white text-xl font-bold shadow mb-2"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="fixed top-0 left-0 h-full w-full z-50 flex items-center justify-center bg-black bg-opacity-60 overflow-y-auto p-4">
        <div
          className="rounded-lg shadow-lg p-8 relative min-w-[320px] min-h-[200px] max-w-[90vw] my-8 flex flex-col items-center justify-center"
          style={{ backgroundColor: '#F0DEAD' }}
        >
          <button
            onClick={onClose}
            // onTouchEnd={onClose}
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl font-bold focus:outline-none"
            aria-label="Close"
          >
            ×
          </button>
          <div className="flex flex-row items-center justify-center gap-6 w-full h-full mb-4">
            <button
              className="px-3 py-1.5 rounded-lg text-xl font-semibold shadow text-white transition-colors"
              style={{ width: 166, height: 49, backgroundColor: selectedMode === 'live' ? '#741003' : '#911606' }}
              onClick={() => setSelectedMode('live')}
            >
              Live Mode
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-xl font-semibold shadow text-white transition-colors whitespace-nowrap"
              style={{ height: 49, backgroundColor: selectedMode === 'automatic' ? '#741003' : '#911606' }}
              onClick={() => setSelectedMode('automatic')}
            >
              Automatic Mode
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-xl font-semibold shadow text-white transition-colors"
              style={{ width: 166, height: 49, backgroundColor: selectedMode === 'manual' ? '#741003' : '#911606' }}
              onClick={() => setSelectedMode('manual')}
            >
              Manual Mode
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-xl font-semibold shadow text-white transition-colors"
              style={{ width: 166, height: 49, backgroundColor: selectedMode === 'vip' ? '#741003' : '#911606' }}
              onClick={() => setSelectedMode('vip')}
            >
              VIP Mode
            </button>
          </div>
          {selectedMode === 'live' ? (
            <div className="flex flex-row w-full gap-6 justify-center items-center">
              {/* First column */}
              {/* <div className="flex-1 flex flex-col items-center gap-4">
                <button
                  className="h-36 rounded-lg shadow text-xl font-bold flex items-center justify-center"
                  style={{ width: 250, backgroundColor: '#911606', color: '#fff' }}
                >
                  Dealer wins
                </button>
                  <button
                    className="h-36 rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, backgroundColor: '#911606', color: '#fff' }}
                  >
                    Player wins
                  </button>
              </div> */}
              {/* Second column */}
              <div className="flex-1 flex flex-col h-full min-h-full">
                <div className="flex flex-col items-center gap-2">
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#741003', color: '#fff' }}
                    onClick={() => handleGameAction('start_new_game')}
                  >
                    New game
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => handleGameAction('undo')}
                    disabled={!connected || !gameState.canUndo || gameState.autoDealingInProgress}
                  >
                    Undo
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => handleGameAction('delete_last_entry')}
                    disabled={!connected || !canUndoLastWin || gameState.autoDealingInProgress}
                  >
                    Undo last Win
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => handleGameAction('reset_game')}
                  >
                    Reset All
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => handleGameAction('shuffle_cards')}
                    disabled={!connected || !gameState.canShuffle || gameState.autoDealingInProgress}
                  >
                    Shuffle
                  </button>
                </div>
                <div className="flex flex-col items-center gap-2 mt-8">
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center bg-[darkRed] text-white disabled:bg-[white] disabled:text-[darkRed]"
                    style={{ width: 250, height: 49}}
                    onClick={() => sendMessage({ action: 'start_burn_card' })}
                    disabled={
                      !connected ||
                      !gameState.burnAvailable ||
                      gameState.burnMode === 'active' ||
                      gameState.burnMode === 'completed' ||
                      gameState.autoDealingInProgress ||
                      (gameState.playerCards && gameState.playerCards.length >= 1)
                    }
                  >
                    Start card burning
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center bg-[darkRed] text-white disabled:bg-[white] disabled:text-[darkRed]"
                    style={{ width: 250, height: 49}}
                    onClick={() => sendMessage({ action: 'end_burn_card' })}
                    disabled={
                      !connected ||
                      gameState.burnMode !== 'active' ||
                      gameState.autoDealingInProgress ||
                      (gameState.playerCards && gameState.playerCards.length >= 1)
                    }
                  >
                    End card burning
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => setIsBetModalOpen(true)}
                  >
                    Change bets
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => setIsTableModalOpen(true)}
                  >
                    Enter table number
                  </button>
                </div>
              </div>
              {/* Third column */}
              <div className="flex-1 flex flex-col h-full min-h-full">
                {/* First group: 3x4 grid for ranks */}
                <div className="grid grid-cols-3 grid-rows-4 gap-4 mb-10 place-items-center">
                  <div />
                  <button
                    className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${selectedRank === 'A' ? 'text-white bg-[#741003]' : 'bg-white text-[#741003] '}`}
                    style={{ width: 80, height: 44 }}
                    onClick={() => setSelectedRank('A')}
                  >
                    A
                  </button>
                  <div />
                  {['2','3','4','5','6','7','8','9','T','J','Q','K'].map((rank) => (
                    <button
                      key={`grid-btn-${rank}`}
                      className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${selectedRank === rank ? 'text-white bg-[#741003]' : 'bg-white text-[#741003]'}`}
                      style={{ width: 80, height: 44 }}
                      onClick={() => setSelectedRank(rank)}
                    >
                      {rank}
                    </button>
                  ))}
                </div>
                {/* Second group: 2x2 grid for suits */}
                <div className="grid grid-cols-2 grid-rows-2 gap-4 mb-10 place-items-center">
                  {[
                    { symbol: '♠', value: 'S' },
                    { symbol: '♥', value: 'H' },
                    { symbol: '♦', value: 'D' },
                    { symbol: '♣', value: 'C' }
                  ].map((suit) => (
                    <button
                      key={`suit-btn-${suit.value}`}
                      className={`rounded-lg shadow text-xl font-bold flex items-center justify-center text-[#741003] ${(suit.value === 'H' || suit.value === 'D') ? 'text-red-600' : 'text-black'} ${selectedSuit === suit.value ? 'bg-[#741003]' : 'bg-white'}`}
                      style={{ width: 110, height: 44 }}
                      onClick={() => setSelectedSuit(suit.value)}
                    >
                      {suit.symbol}
                    </button>
                  ))}
                </div>
                {/* Third group: Send and Undo buttons */}
                <div className="flex flex-row gap-4 items-center justify-center">
                  <button
                    className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${selectedRank && selectedSuit ? 'bg-[#911606] text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                    style={{ width: 110, height: 44 }}
                    disabled={!(selectedRank && selectedSuit)}
                    onClick={() => {
                      if (selectedRank && selectedSuit) {
                        sendMessage({ action: 'add_card', card: selectedRank + selectedSuit });
                        setSelectedRank(null);
                        setSelectedSuit(null);
                      }
                    }}
                  >
                    Send card
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center bg-[#911606] text-white"
                    style={{ width: 110, height: 44 }}
                    onClick={() => {
                      setSelectedRank(null);
                      setSelectedSuit(null);
                      handleGameAction('undo')
                    }}
                    disabled={!connected || !gameState.canUndo || gameState.autoDealingInProgress}
                  >
                    Undo Card
                  </button>
                </div>
              </div>
            </div>
          ) : selectedMode === 'manual' ? (
            <div className="flex flex-col items-center justify-center w-full h-full mt-4">
              {/* Manual Result Entry Form */}
              <div className="p-6 rounded-lg shadow-md mb-6" style={{ backgroundColor: '#D6AB5D' }}>
                <h3 className="text-xl font-bold mb-4" style={{ color: '#911606' }}>Manual Result Entry</h3>
                <form onSubmit={handleManualSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center" style={{ color: '#741003' }}>
                  <div className="md:col-span-4">
                    <label className="font-semibold mr-2" style={{ color: '#911606' }}>Winner:</label>
                    <select value={manualWinner} onChange={e => setManualWinner(e.target.value)} className="p-2 rounded border" style={{ color: '#741003', backgroundColor: '#F0DEAD', borderColor: '#911606' }}>
                      <option value="player">Player</option>
                      <option value="banker">Banker</option>
                      <option value="tie">Tie</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2" style={{ color: '#741003' }}><input type="checkbox" checked={manualPlayerPair} onChange={e => setManualPlayerPair(e.target.checked)} className="accent-[#911606]" /> Player Pair</label>
                  <label className="flex items-center gap-2" style={{ color: '#741003' }}><input type="checkbox" checked={manualBankerPair} onChange={e => setManualBankerPair(e.target.checked)} className="accent-[#911606]" /> Banker Pair</label>
                  <label className="flex items-center gap-2" style={{ color: '#741003' }}><input type="checkbox" checked={manualPlayerNatural} onChange={e => setManualPlayerNatural(e.target.checked)} className="accent-[#911606]" /> Player Natural</label>
                  <label className="flex items-center gap-2" style={{ color: '#741003' }}><input type="checkbox" checked={manualBankerNatural} onChange={e => setManualBankerNatural(e.target.checked)} className="accent-[#911606]" /> Banker Natural</label>
                  <label className="flex items-center gap-2" style={{ color: '#741003' }}><input type="checkbox" checked={manualSuperSix} onChange={e => setManualSuperSix(e.target.checked)} className="accent-[#911606]" /> Super Six</label>
                  <div className="md:col-span-4 mt-4">
                    <button type="submit" disabled={manualSubmitting} className="w-full px-6 py-3 rounded-lg font-semibold text-lg transition-colors" style={{ backgroundColor: manualSubmitting ? '#DEBE83' : '#911606', color: '#F0DEAD' }}>Submit Result</button>
                  </div>
                </form>
              </div>
              <div className="flex flex-row gap-4 w-full mt-2">
                <button
                  onClick={() => handleGameAction('delete_last_entry')}
                  disabled={!connected || !canUndoLastWin || gameState.autoDealingInProgress}
                  className="flex-1 px-2 py-3 rounded-lg text-lg font-bold text-[darkRed] bg-white"
                >
                  Delete Last Win
                </button>
                <button
                  onClick={() => handleGameAction('reset_game')}
                  disabled={!connected || gameState.autoDealingInProgress}
                  className="flex-1 px-2 py-3 rounded-lg text-lg font-bold text-[darkRed] bg-white"
                >
                  Delete All Wins
                </button>
              </div>
            </div>
          ) : selectedMode === 'vip' ? (
            <div className="flex flex-row w-full gap-6 justify-center items-center">
              {/* First column */}
              <div className="flex-1 flex flex-col items-center gap-4">
                <button
                    className="bg-[darkBrown] text-[darkred] rounded-lg text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 60}}
                  >
                    Make someone VIP
                  </button>
                {Array.isArray(gameState.activePlayers) && [...gameState.activePlayers]
                  .sort((a: string, b: string) => {
                    // Extract the number from 'player1', 'player2', etc.
                    const numA = parseInt(a.replace(/[^0-9]/g, ''));
                    const numB = parseInt(b.replace(/[^0-9]/g, ''));
                    return numA - numB;
                  })
                  .map((playerId: string) => (
                    <button
                      key={playerId}
                      className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                      style={{ width: 250, height: 60, backgroundColor: '#911606', color: '#fff' }}
                      onClick={() => sendMessage({ action: 'set_vip_revealer', player_id: playerId })}
                    >
                      {(() => {
                        // Convert 'player1' to 'Player 1'
                        const match = playerId.match(/^(player)(\d+)$/i);
                        if (match) {
                          return `Player ${match[2]}`;
                        }
                        return playerId.charAt(0).toUpperCase() + playerId.slice(1);
                      })()}
                    </button>
                  ))}
              </div>
              {/* Second column */}
              <div className="flex-1 flex flex-col h-full min-h-full">
                <div className="flex flex-col items-center gap-2">
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#741003', color: '#fff' }}
                    onClick={() => handleGameAction('start_new_game')}
                  >
                    New game
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => handleGameAction('undo')}
                    disabled={!connected || !gameState.canUndo || gameState.autoDealingInProgress}
                  >
                    Undo
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => handleGameAction('delete_last_entry')}
                    disabled={!connected || !canUndoLastWin || gameState.autoDealingInProgress}
                  >
                    Undo last Win
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => handleGameAction('reset_game')}
                  >
                    Reset All
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => handleGameAction('shuffle_cards')}
                    disabled={!connected || !gameState.canShuffle || gameState.autoDealingInProgress}
                  >
                    Shuffle
                  </button>
                </div>
                <div className="flex flex-col items-center gap-2 mt-8">
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center bg-[darkRed] text-white disabled:bg-[white] disabled:text-[darkRed]"
                    style={{ width: 250, height: 49}}
                    onClick={() => sendMessage({ action: 'start_burn_card' })}
                    disabled={
                      !connected ||
                      !gameState.burnAvailable ||
                      gameState.burnMode === 'active' ||
                      gameState.burnMode === 'completed' ||
                      gameState.autoDealingInProgress ||
                      (gameState.playerCards && gameState.playerCards.length >= 1)
                    }
                  >
                    Start card burning
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center bg-[darkRed] text-white disabled:bg-[white] disabled:text-[darkRed]"
                    style={{ width: 250, height: 49}}
                    onClick={() => sendMessage({ action: 'end_burn_card' })}
                    disabled={
                      !connected ||
                      gameState.burnMode !== 'active' ||
                      gameState.autoDealingInProgress ||
                      (gameState.playerCards && gameState.playerCards.length >= 1)
                    }
                  >
                    End card burning
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => setIsBetModalOpen(true)}
                  >
                    Change bets
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => setIsTableModalOpen(true)}
                  >
                    Enter table number
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center"
                    style={{ width: 250, height: 49, backgroundColor: '#fff', color: '#741003' }}
                    onClick={() => sendMessage({ action: 'vip_reveal', player_id: gameState.vip_revealer })}
                  >
                    Reveal Cards
                  </button>
                </div>
              </div>
              {/* Third column */}
              <div className="flex-1 flex flex-col h-full min-h-full">
                {/* First group: 3x4 grid for ranks */}
                <div className="grid grid-cols-3 grid-rows-4 gap-4 mb-10 place-items-center">
                  <div />
                  <button
                    className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${selectedRank === 'A' ? 'text-white bg-[#741003]' : 'bg-white text-[#741003] '}`}
                    style={{ width: 80, height: 44 }}
                    onClick={() => setSelectedRank('A')}
                  >
                    A
                  </button>
                  <div />
                  {['2','3','4','5','6','7','8','9','T','J','Q','K'].map((rank) => (
                    <button
                      key={`vip-grid-btn-${rank}`}
                      className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${selectedRank === rank ? 'text-white bg-[#741003]' : 'bg-white text-[#741003]'}`}
                      style={{ width: 80, height: 44 }}
                      onClick={() => setSelectedRank(rank)}
                    >
                      {rank}
                    </button>
                  ))}
                </div>
                {/* Second group: 2x2 grid for suits */}
                <div className="grid grid-cols-2 grid-rows-2 gap-4 mb-10 place-items-center">
                  {[
                    { symbol: '♠', value: 'S' },
                    { symbol: '♥', value: 'H' },
                    { symbol: '♦', value: 'D' },
                    { symbol: '♣', value: 'C' }
                  ].map((suit) => (
                    <button
                      key={`vip-suit-btn-${suit.value}`}
                      className={`rounded-lg shadow text-xl font-bold flex items-center justify-center text-[#741003] ${(suit.value === 'H' || suit.value === 'D') ? 'text-red-600' : 'text-black'} ${selectedSuit === suit.value ? 'bg-[#741003]' : 'bg-white'}`}
                      style={{ width: 110, height: 44 }}
                      onClick={() => setSelectedSuit(suit.value)}
                    >
                      {suit.symbol}
                    </button>
                  ))}
                </div>
                {/* Third group: Send and Undo buttons */}
                <div className="flex flex-row gap-4 items-center justify-center">
                  <button
                    className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${selectedRank && selectedSuit ? 'bg-[#911606] text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                    style={{ width: 110, height: 44 }}
                    disabled={!(selectedRank && selectedSuit)}
                    onClick={() => {
                      if (selectedRank && selectedSuit) {
                        sendMessage({ action: 'add_card', card: selectedRank + selectedSuit });
                        setSelectedRank(null);
                        setSelectedSuit(null);
                      }
                    }}
                  >
                    Send card
                  </button>
                  <button
                    className="rounded-lg shadow text-xl font-bold flex items-center justify-center bg-[#911606] text-white"
                    style={{ width: 110, height: 44 }}
                    onClick={() => {
                      setSelectedRank(null);
                      setSelectedSuit(null);
                      handleGameAction('undo')
                    }}
                    disabled={!connected || !gameState.canUndo || gameState.autoDealingInProgress}
                  >
                    Undo Card
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full">
              <button
                className="m-2 rounded-lg text-xl font-bold shadow text-white bg-[#911606] hover:bg-[#741003] transition-colors"
                style={{ width: 192, height: 60 }}
                onClick={() => handleGameAction('auto_deal')}
              >
                Start automatic
              </button>
              <button
                className="m-2 px-5 py-3 rounded-lg text-xl font-bold shadow text-white bg-[#911606] hover:bg-[#741003] transition-colors"
                style={{ width: 192, height: 60 }}
                onClick={() => handleGameAction('start_new_game')}
              >
                New Game
              </button>
              <button
                className="m-2 px-5 py-3 rounded-lg text-xl font-bold shadow text-white bg-[#911606] hover:bg-[#741003] transition-colors"
                style={{ width: 192, height: 60 }}
                onClick={() => handleGameAction('shuffle_cards')}
                disabled={!connected || !gameState.canShuffle || gameState.autoDealingInProgress}
              >
                Shuffle
              </button>
              <button
                className="m-2 px-5 py-3 rounded-lg text-xl font-bold shadow text-white bg-[#911606] hover:bg-[#741003] transition-colors"
                style={{ width: 192, height: 60 }}
                onClick={() => handleGameAction('reset_game')}
              >
                Reset all
              </button>
              <button
                className="m-2 px-5 py-3 rounded-lg text-xl font-bold shadow text-white bg-[#911606] hover:bg-[#741003] transition-colors"
                style={{ width: 192, height: 60 }}
                onClick={() => handleGameAction('delete_last_entry')}
                disabled={!connected || !canUndoLastWin || gameState.autoDealingInProgress}
              >
                undo last win
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ControlPanelPopup; 