import asyncio
import websockets
import json
import logging
import random
from collections import defaultdict, deque
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ServerSelectionTimeoutError
from datetime import datetime

# MongoDB Configuration
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "game_db"
COLLECTION_NAME = "game_results"

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]

# Configure logging to suppress websocket handshake errors
logging.basicConfig(level=logging.INFO)
logging.getLogger('websockets.server').setLevel(logging.WARNING)
logging.getLogger('websockets').setLevel(logging.WARNING)

# Track connected clients
connected_clients = set()

# Game state - SIMPLIFIED
game_state = {
    "round": 0,
    "game_phase": "waiting",
    "natural_win": False,
    "natural_type": None,
    "can_calculate": False,
    "burn_mode": "inactive",  # inactive, active, completed
    "burn_available": False,  # NEW: controls when start burn is enabled
    "active_players": set(),
    "auto_dealing": False,
    "can_manage_players": True,
    "table_number": "13257",
    "max_bet": 100000,
    "min_bet": 10000,
    "game_mode": "manual",
    "vip_player_revealer": None,  # NEW: separate revealers
    "vip_banker_revealer": None,  # NEW: separate revealers
    "cards_revealed": False,  
    "winner": None
}

remaining_cards = None
card_duplicates = defaultdict(int)
last_card_info = {"card": None, "recipient": None}
last_game_result = None
player_cards = []
banker_cards = []
burn_card = None
burned_cards = []  # Track all burned cards in the current round

game_pairs = {
    "player_pair": False,
    "banker_pair": False
}
game_results = {
    "is_super_six": False
}

async def check_connection():
    try:
        await client.admin.command('ping')
        logging.info("Connected to MongoDB successfully.")
    except ServerSelectionTimeoutError as e:
        logging.error("Could not connect to MongoDB: %s", e)
        exit(1)

async def save_game_result(winner, round_num, is_super_six=False, player_pair=False, banker_pair=False, player_natural=False, banker_natural=False):
    try:
        game_doc = {
            "timestamp": datetime.utcnow(),
            "round": round_num,
            "winner": winner,
            "is_super_six": is_super_six,
            "player_pair": player_pair,
            "banker_pair": banker_pair,
            "player_natural": player_natural,  # New: separate natural tracking
            "banker_natural": banker_natural   # New: separate natural tracking
        }
        result = await collection.insert_one(game_doc)
        logging.info(f"Game {round_num} saved: {winner} wins - Super Six: {is_super_six}, Player Pair: {player_pair}, Banker Pair: {banker_pair}")
        return result.inserted_id
    except Exception as e:
        logging.error(f"Error saving to MongoDB: {e}")
        return None

async def delete_last_game_entry(websocket):
    try:
        last_entry = await collection.find_one(sort=[("timestamp", -1)])
        
        if last_entry:
            await collection.delete_one({"_id": last_entry["_id"]})
            # No local stat restoration, just update round if needed
            if last_entry.get("round") == game_state["round"]:
                game_state["round"] = max(0, game_state["round"] - 1)
                await send_success(websocket, f"Deleted last game entry (Round {last_entry.get('round', 'Unknown')})")
            else:
                await send_success(websocket, f"Deleted game entry: Round {last_entry.get('round', 'Unknown')}")
            logging.info(f"Deleted game entry: Round {last_entry.get('round', 'Unknown')}")
            await asyncio.sleep(1)
            await broadcast_refresh_stats()
            await broadcast_game_state()
            return True
        else:
            await send_error(websocket, "No entries found to delete")
            logging.info("No entries to delete")
            return False
    except Exception as e:
        logging.error(f"Error deleting last entry: {e}")
        await send_error(websocket, f"Error deleting entry: {str(e)}")
        return False

# Create 8-deck shoe (416 cards total)
def create_8_deck_shoe():
    suits = ['H', 'D', 'C', 'S']
    ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']
    cards = [rank + suit for _ in range(8) for suit in suits for rank in ranks]
    random.shuffle(cards)
    return deque(cards)

def card_value(card):
    rank = card[0]
    return 1 if rank == 'A' else (0 if rank in 'TJQK' else int(rank))

def calculate_hand_score(cards):
    return sum(card_value(card) for card in cards) % 10

def has_pair(cards):
    return len(cards) == 2 and cards[0][0] == cards[1][0]

def is_valid_card(card):
    return len(card) == 2 and card[0] in 'A23456789TJQK' and card[1] in 'HDCS'

def can_add_card(card):
    return card_duplicates[card] < 8

def update_card_tracking(card, recipient, is_undo=False):
    global remaining_cards, card_duplicates, last_card_info
    
    if is_undo:
        card_duplicates[card] -= 1
        if card_duplicates[card] <= 0:
            del card_duplicates[card]
        remaining_cards.append(card)
        last_card_info = {"card": None, "recipient": None}
    else:
        if card in remaining_cards:
            remaining_cards.remove(card)
        card_duplicates[card] += 1
        last_card_info.update({"card": card, "recipient": recipient})

def new_round():
    global player_cards, banker_cards, last_card_info, game_pairs, last_game_result
    player_cards = []
    banker_cards = []
    last_card_info = {"card": None, "recipient": None}
    last_game_result = None
    game_pairs = {"player_pair": False, "banker_pair": False}
    game_results["is_super_six"] = False
    global burned_cards
    burned_cards = []
    game_state["winner"] = None
    
    is_vip_mode = game_state.get("game_mode") == "vip"

    # Reset both revealers and individual reveal states
    if is_vip_mode:
        game_state["vip_player_revealer"] = None
        game_state["vip_banker_revealer"] = None
        game_state["cards_revealed"] = False
    
    game_state.update({
        "game_phase": "waiting",
        "natural_win": False,
        "natural_type": None,
        "auto_dealing": False,
        "cards_revealed": not is_vip_mode,
        "can_manage_players": True,
        "winner": None
    })

async def broadcast_refresh_stats():
    if not connected_clients:
        return
    message = {"action": "refresh_stats"}
    websockets_to_remove = set()
    for websocket in connected_clients:
        try:
            await websocket.send(json.dumps(message))
        except websockets.exceptions.ConnectionClosed:
            websockets_to_remove.add(websocket)
    connected_clients.difference_update(websockets_to_remove)

async def reset_all():
    global remaining_cards, card_duplicates, burn_card
    remaining_cards = create_8_deck_shoe()
    card_duplicates = defaultdict(int)
    burn_card = None
    global burned_cards
    burned_cards = []
    new_round()
    try:
        await collection.delete_many({})
        logging.info("MongoDB collection cleared")
    except Exception as e:
        logging.error(f"Error clearing MongoDB: {e}")
    # Deactivate all players
    game_state["active_players"] = set()
    game_state.update({
        "round": 0,
        "burn_mode": "inactive",
        "burn_available": True,  # Enable burn after reset
        "can_manage_players": True
    })
    await broadcast_refresh_stats()

def get_next_card_recipient():
    if not game_state["auto_dealing"] and len(game_state["active_players"]) == 0:
        return "no_players"
    
    total_cards = len(player_cards) + len(banker_cards)
    
    if total_cards < 4:
        if total_cards%2 == 0:
            return "player"
        elif total_cards%2 == 1:
            return "banker"

    # In VIP mode, stop dealing after 4 cards until they are revealed
    if game_state["game_mode"] == "vip" and not game_state["cards_revealed"] and total_cards >= 4:
        return "complete"
        
    if total_cards == 4:
        player_score = calculate_hand_score(player_cards)
        banker_score = calculate_hand_score(banker_cards)
        
        if player_score >= 8 or banker_score >= 8:
            return "complete"
        
        if player_score <= 5:
            return "player"
        elif banker_score <= 5:
            return "banker"
        else:
            return "complete"
    
    if total_cards == 5 and len(player_cards) == 3:
        banker_score = calculate_hand_score(banker_cards)
        player_third = card_value(player_cards[2])
        
        if banker_score <= 2:
            return "banker"
        elif banker_score == 3 and player_third != 8:
            return "banker"
        elif banker_score == 4 and player_third in [2, 3, 4, 5, 6, 7]:
            return "banker"
        elif banker_score == 5 and player_third in [4, 5, 6, 7]:
            return "banker"
        elif banker_score == 6 and player_third in [6, 7]:
            return "banker"
        else:
            return "complete"
    
    return "complete"

async def shuffle_deck(mode=None):
    global remaining_cards, card_duplicates
    remaining_cards = create_8_deck_shoe()
    card_duplicates = defaultdict(int)
    game_state["burn_mode"] = "inactive"
    game_state["burn_available"] = True  # Enable burn after shuffle
    logging.info(f"Deck shuffled - {len(remaining_cards)} cards available")

async def burn_card_from_deck():
    global burn_card
    
    if len(remaining_cards) > 0:
        burn_card = remaining_cards.popleft()
        card_duplicates[burn_card] += 1
        game_state["burn_enabled"] = False
        logging.info(f"Burned card: {burn_card}")
        return burn_card
    return None

async def handle_start_burn_card(websocket):
    """Handle start burn card button"""
    if game_state["auto_dealing"]:
        await send_error(websocket, "Cannot start burn during auto-dealing")
        return False
    if not game_state["burn_available"]:
        await send_error(websocket, "Burn card not available")
        return False
    if game_state["burn_mode"] != "inactive":
        await send_error(websocket, "Burn mode already active")
        return False
    game_state["burn_mode"] = "active"
    game_state["burn_available"] = False  # Immediately disable Start Burn button
    await send_success(websocket, "Burn mode activated. Next cards will be burned.")
    logging.info("Burn mode activated")
    return True

async def handle_end_burn_card(websocket):
    """Handle end burn card button"""
    if game_state["burn_mode"] != "active":
        game_state["burn_available"] = False  # Always disable End Burn button on click
        await send_error(websocket, "Burn mode not active")
        return False
    game_state["burn_mode"] = "completed"
    game_state["burn_available"] = False  # Immediately disable End Burn button
    await send_success(websocket, "Burn mode ended.")
    logging.info("Burn mode ended.")
    return True

async def broadcast_game_state():
    if not connected_clients:
        return
    
    # Check if there are any entries in MongoDB for undo last win
    has_mongo_entries = await collection.count_documents({}) > 0
    
    next_recipient = get_next_card_recipient()
    mode = game_state.get("game_mode", "manual")
    if mode == "automatic":
        can_shuffle = len(remaining_cards) < 52
    else:
        can_shuffle = False
    message = {
        "action": "game_state",
        "playerCards": player_cards,
        "bankerCards": banker_cards,
        "playerTotal": calculate_hand_score(player_cards),
        "bankerTotal": calculate_hand_score(banker_cards),
        "nextCardGoesTo": next_recipient,
        "gamePhase": game_state["game_phase"],
        "playerPair": game_pairs["player_pair"],
        "bankerPair": game_pairs["banker_pair"],
        "remainingCards": len(remaining_cards),
        "usedCards": sum(card_duplicates.values()),
        "canUndo": len(player_cards) > 0 or len(banker_cards) > 0 or (last_game_result and game_state["game_phase"] == "finished"),
        "canUndoLastWin": has_mongo_entries,
        "canCalculate": game_state["can_calculate"],
        "canShuffle": can_shuffle,
        "burnMode": game_state["burn_mode"],  # Changed from burnEnabled 
        "burnAvailable": game_state["burn_available"],  # NEW: for frontend logic
        "burnCard": burn_card,
        "naturalWin": game_state["natural_win"],
        "naturalType": game_state["natural_type"],
        "round": game_state["round"],
        "activePlayers": list(game_state["active_players"]),
        "autoDealingInProgress": game_state["auto_dealing"],
        "noPlayersActive": next_recipient == "no_players",
        "canManagePlayers": game_state["can_manage_players"],
        "is_super_six": game_results["is_super_six"],
        "table_number": game_state["table_number"],
        "max_bet": game_state["max_bet"],
        "min_bet": game_state["min_bet"],
        "game_mode": game_state["game_mode"],
        "vip_player_revealer": game_state["vip_player_revealer"], # Changed from vip_revealer
        "vip_banker_revealer": game_state["vip_banker_revealer"], # Changed from vip_revealer
        "cards_revealed": game_state["cards_revealed"],
        "winner": game_state["winner"]
    }
    websockets_to_remove = set()
    for websocket in connected_clients:
        try:
            await websocket.send(json.dumps(message))
        except websockets.exceptions.ConnectionClosed:
            websockets_to_remove.add(websocket)
    connected_clients.difference_update(websockets_to_remove)

async def broadcast_result(result_data):
    if not connected_clients:
        return

    result_data["canUndoLastWin"] = await collection.count_documents({}) > 0
        
    websockets_to_remove = set()
    for websocket in connected_clients:
        try:
            await websocket.send(json.dumps(result_data))
        except websockets.exceptions.ConnectionClosed:
            websockets_to_remove.add(websocket)
    
    connected_clients.difference_update(websockets_to_remove)

async def send_error(websocket, message):
    await websocket.send(json.dumps({"action": "error", "message": message}))

async def send_success(websocket, message):
    await websocket.send(json.dumps({"action": "success", "message": message}))

async def handle_add_card(websocket, card, is_auto_deal=False):
    if not is_auto_deal:
        if game_state["auto_dealing"]:
            await send_error(websocket, "Cannot add cards manually during auto-dealing")
            return False
        
        # MULTI-BURN: If in burn mode, burn every card added until burn mode ends
        if game_state["burn_mode"] == "active":
            if not card or not is_valid_card(card) or not can_add_card(card):
                await send_error(websocket, f"Invalid burn card: {card}")
                return False
            global burned_cards
            if card in remaining_cards:
                remaining_cards.remove(card)
            card_duplicates[card] += 1
            burned_cards.append(card)
            burn_card = card
            # Do NOT set burn_mode to completed here; only when End Burn is clicked
            # burn_available remains False
            await send_success(websocket, f"Card burned: {card}")
            logging.info(f"Card burned: {card}")
            return True
        
        if not card or not is_valid_card(card) or not can_add_card(card):
            await send_error(websocket, f"Invalid card: {card}")
            return False
    
    recipient = get_next_card_recipient()
    
    if not is_auto_deal and recipient == "no_players":
        await send_error(websocket, "No active players - cannot deal cards")
        return False
    
    if recipient == "complete":
        if not is_auto_deal:
            await send_error(websocket, "Cannot add more cards")
        return False
    
    if recipient == "player":
        player_cards.append(card)
        # Once the first card is dealt to player, disable burn buttons
        if len(player_cards) == 1:
            game_state["burn_available"] = False
            game_state["burn_mode"] = "completed"
    else:
        banker_cards.append(card)
    
    if len(player_cards) + len(banker_cards) == 1:
        game_state["can_manage_players"] = False
        logging.info("Player management disabled - cards being dealt")
    
    if is_auto_deal:
        card_duplicates[card] += 1
        last_card_info.update({"card": card, "recipient": recipient})
    else:
        update_card_tracking(card, recipient)
    
    if recipient == "player" and len(player_cards) == 2:
        game_pairs["player_pair"] = has_pair(player_cards)
        logging.info(f"Player pair detected: {player_cards} -> {game_pairs['player_pair']}")
    elif recipient == "banker" and len(banker_cards) == 2:
        game_pairs["banker_pair"] = has_pair(banker_cards)
        logging.info(f"Banker pair detected: {banker_cards} -> {game_pairs['banker_pair']}")
    
    total_cards = len(player_cards) + len(banker_cards)

    # NEW: VIP logic to pause after 4 cards for reveal
    if total_cards == 4 and game_state["game_mode"] == "vip" and not game_state["cards_revealed"]:
        game_state["game_phase"] = "waiting_for_reveal"
        game_state["can_calculate"] = False # Cannot calculate until reveal
        await broadcast_game_state()
        return True # Stop dealing process

    if total_cards == 4:
        player_score = calculate_hand_score(player_cards)
        banker_score = calculate_hand_score(banker_cards)
        game_state["can_calculate"] = True
        
        if player_score >= 8 or banker_score >= 8:
            game_state["natural_win"] = True
            game_state["natural_type"] = "natural_9" if (player_score == 9 or banker_score == 9) else "natural_8"
            if not is_auto_deal:
                await calculate_result()
                return True
    
    if not is_auto_deal and get_next_card_recipient() == "complete":
        await calculate_result()
    
    return True

async def calculate_result():
    global last_game_result
    player_score = calculate_hand_score(player_cards)
    banker_score = calculate_hand_score(banker_cards)
    is_super_six = (banker_score == 6 and banker_score > player_score and len(banker_cards) == 3)
    player_pair = game_pairs["player_pair"]
    banker_pair = game_pairs["banker_pair"]
    game_results["is_super_six"] = is_super_six
    is_natural = game_state["natural_win"]
    natural_type = game_state["natural_type"]
    # UPDATED: Separate natural detection
    player_natural = is_natural and player_score >= 8 and player_score > banker_score
    banker_natural = is_natural and banker_score >= 8 and banker_score > player_score
    previous_state = {
        "round": game_state["round"]
    }
    if player_score > banker_score:
        winner = "player"
    elif banker_score > player_score:
        winner = "banker"
    else:
        winner = "tie"
    game_state["round"] += 1
    await save_game_result(
        winner, game_state["round"],
        is_super_six, player_pair, banker_pair, 
        player_natural, banker_natural
    )
    game_state["winner"] = winner
    
    last_game_result = {
        "winner": winner,
        "is_super_six": is_super_six,
        "player_natural": player_natural,
        "banker_natural": banker_natural,
        "previous_state": previous_state
    }
    game_state["game_phase"] = "finished"
    game_state["can_calculate"] = False
    result_data = {
        "action": "game_result",
        "winner": winner,
        "playerCards": player_cards,
        "bankerCards": banker_cards,
        "playerTotal": player_score,
        "bankerTotal": banker_score,
        "playerPair": player_pair,
        "bankerPair": banker_pair,
        "is_super_six": is_super_six,
        "isNatural": is_natural,
        "naturalType": natural_type,
        "playerNatural": player_natural,  # New
        "bankerNatural": banker_natural,  # New
        "round": game_state["round"]
    }
    await broadcast_result(result_data)
    await broadcast_game_state()
    await broadcast_refresh_stats()

async def handle_burn_card(websocket, card):
    global burn_card
    
    if game_state["auto_dealing"]:
        await send_error(websocket, "Cannot burn cards manually during auto-dealing")
        return False
    
    if not game_state["burn_enabled"]:
        await send_error(websocket, "Burn card not available")
        return False
    
    if not card or not is_valid_card(card) or not can_add_card(card):
        await send_error(websocket, f"Invalid burn card: {card}")
        return False
    
    if card in remaining_cards:
        remaining_cards.remove(card)
    card_duplicates[card] += 1
    burn_card = card
    game_state["burn_enabled"] = False
    
    await send_success(websocket, f"Burned card: {card}")
    return True

async def handle_undo_card(websocket):
    global last_game_result
    # 1. Block undo after auto-deal (auto_dealing just finished)
    if last_game_result and last_game_result.get("auto_deal", False):
        await send_error(websocket, "Undo is not allowed after auto-deal. Please reset or start a new game.")
        return False
    if game_state["auto_dealing"]:
        await send_error(websocket, "Cannot undo during auto-dealing")
        return False
    # 2. Undo after game finished: update stats and remove last card
    if last_game_result and game_state["game_phase"] == "finished":
        try:
            last_entry = await collection.find_one(sort=[("timestamp", -1)])
            if last_entry and last_entry.get("round") == game_state["round"]:
                await collection.delete_one({"_id": last_entry["_id"]})
                previous_state = last_game_result["previous_state"]
                game_state.update(previous_state)
                game_state["game_phase"] = "waiting"
                game_state["can_calculate"] = True
                game_state["natural_win"] = False
                game_state["natural_type"] = None
                # Remove last card dealt (from player or banker)
                total_cards = len(player_cards) + len(banker_cards)
                if total_cards > 0:
                    if len(banker_cards) > 0 and (total_cards % 2 == 0):
                        last_card_to_undo = banker_cards.pop()
                        update_card_tracking(last_card_to_undo, "banker", is_undo=True)
                    elif len(player_cards) > 0:
                        last_card_to_undo = player_cards.pop()
                        update_card_tracking(last_card_to_undo, "player", is_undo=True)
                last_game_result = None
                await send_success(websocket, f"Undid game result for Round {last_entry.get('round')}, removed last card.")
                logging.info(f"Undid game result for Round {last_entry.get('round')}, removed last card.")
                await asyncio.sleep(0.2)
                await broadcast_refresh_stats()
                await broadcast_game_state()
                return True
        except Exception as e:
            logging.error(f"Error undoing game result: {e}")
            await send_error(websocket, "Error undoing game result")
            return False
    last_card_to_undo = None
    last_recipient = None
    if len(player_cards) > 0 and len(banker_cards) > 0:
        total_cards = len(player_cards) + len(banker_cards)
        if total_cards == 2:
            last_card_to_undo = banker_cards[-1]
            last_recipient = "banker"
        elif total_cards == 3:
            last_card_to_undo = player_cards[-1]
            last_recipient = "player"
        elif total_cards == 4:
            last_card_to_undo = banker_cards[-1]
            last_recipient = "banker"
        elif total_cards == 5:
            last_card_to_undo = player_cards[-1]
            last_recipient = "player"
        elif total_cards == 6:
            last_card_to_undo = banker_cards[-1]
            last_recipient = "banker"
    elif len(player_cards) > 0:
        last_card_to_undo = player_cards[-1]
        last_recipient = "player"
    elif len(banker_cards) > 0:
        last_card_to_undo = banker_cards[-1]
        last_recipient = "banker"
    else:
        await send_error(websocket, "No cards to undo")
        return False
    if last_recipient == "player":
        player_cards.pop()
    else:
        banker_cards.pop()
    update_card_tracking(last_card_to_undo, last_recipient, is_undo=True)
    game_pairs["player_pair"] = len(player_cards) == 2 and has_pair(player_cards)
    game_pairs["banker_pair"] = len(banker_cards) == 2 and has_pair(banker_cards)
    total_cards = len(player_cards) + len(banker_cards)
    if total_cards < 4:
        game_state.update({
            "natural_win": False,
            "natural_type": None,
            "can_calculate": False,
            "game_phase": "waiting"
        })
    elif total_cards == 4:
        player_score = calculate_hand_score(player_cards)
        banker_score = calculate_hand_score(banker_cards)
        if player_score >= 8 or banker_score >= 8:
            game_state["natural_win"] = True
            game_state["natural_type"] = "natural_9" if (player_score == 9 or banker_score == 9) else "natural_8"
        else:
            game_state["natural_win"] = False
            game_state["natural_type"] = None
        game_state["can_calculate"] = True
        game_state["game_phase"] = "waiting"
    if total_cards == 0:
        game_state["can_manage_players"] = True
    await send_success(websocket, f"Undid card: {last_card_to_undo} from {last_recipient}")
    logging.info(f"Undid card: {last_card_to_undo} from {last_recipient}")
    await asyncio.sleep(0.2)
    await broadcast_refresh_stats()
    await broadcast_game_state()
    return True

async def handle_shuffle_cards(websocket):
    if game_state["auto_dealing"]:
        await send_error(websocket, "Cannot shuffle manually during auto-dealing")
        return False
    
    mode = game_state.get("game_mode", "manual")
    
    # Check card count only for automatic mode
    if mode == "automatic" and len(remaining_cards) >= 52:
        await send_error(websocket, "Too many cards remaining to shuffle")
        return False
    
    # Shuffle deck and send response (same for all modes)
    await shuffle_deck(mode)
    await send_success(websocket, "Cards shuffled! Deck reset to 416 cards. Burn card enabled.")
    await broadcast_game_state()
    return True

async def handle_auto_deal(websocket):
    try:
        if game_state["auto_dealing"]:
            await send_error(websocket, "Auto-dealing already in progress")
            return False
        # 3. Only allow auto-deal if there is at least one active player
        if len(game_state["active_players"]) == 0:
            await send_error(websocket, "Cannot auto-deal: No active players.")
            return False
        if len(player_cards) > 0 or len(banker_cards) > 0:
            await send_error(websocket, "Please start a new game before auto-dealing")
            return False
        game_state["auto_dealing"] = True
        game_state["game_phase"] = "auto_dealing"
        game_state["can_manage_players"] = False  # 5. Block player management after auto-deal
        await send_success(websocket, "Starting auto-deal...")
        await broadcast_game_state()
        if len(remaining_cards) < 52:
            await shuffle_deck()
            await broadcast_game_state()
            await asyncio.sleep(2.5)
        card_count = 0
        while True:
            recipient = get_next_card_recipient()
            if recipient in ["complete", "no_players"]:
                break
            if len(remaining_cards) == 0:
                raise Exception("No cards available to deal")
            card = remaining_cards.popleft()
            success = await handle_add_card(websocket, card, is_auto_deal=True)
            if not success:
                break
            card_count += 1
            logging.info(f"Auto-deal progress: {card_count} cards dealt ({card} to {recipient})")
            await broadcast_game_state()
            await asyncio.sleep(2.5)
        if get_next_card_recipient() == "complete":
            await calculate_result()
            await broadcast_game_state()
        game_state["auto_dealing"] = False
        game_state["game_phase"] = "finished"
        # Mark last_game_result as auto_deal for undo restriction
        if last_game_result:
            last_game_result["auto_deal"] = True
        await send_success(websocket, "Auto-deal completed!")
        await broadcast_game_state()
        return True
    except Exception as e:
        game_state["auto_dealing"] = False
        game_state["game_phase"] = "waiting"
        await send_error(websocket, f"Auto-deal failed: {str(e)}")
        await broadcast_game_state()
        return False

async def handle_manual_result(websocket, data):
    """Handle manual game result entry"""
    # Reinitialize round for manual mode (since no explicit new_round)
    new_round()
    await broadcast_game_state()
    try:
        winner = data.get("winner")
        is_super_six = data.get("is_super_six", False)
        player_pair = data.get("player_pair", False)
        banker_pair = data.get("banker_pair", False)
        player_natural = data.get("player_natural", False)
        banker_natural = data.get("banker_natural", False)
        
        if winner not in ["player", "banker", "tie"]:
            await send_error(websocket, "Invalid winner")
            return False
        
        game_state["round"] += 1
        await save_game_result(
            winner, game_state["round"],
            is_super_six, player_pair, banker_pair,
            player_natural, banker_natural
        )
        
        game_state["game_phase"] = "finished"
        game_state["winner"] = winner
        await send_success(websocket, f"Manual result saved: {winner} wins (Round {game_state['round']})")
        await broadcast_refresh_stats()
        await broadcast_game_state()
        return True
        
    except Exception as e:
        logging.error(f"Error handling manual result: {e}")
        await send_error(websocket, f"Error saving manual result: {str(e)}")
        return False

async def handle_set_vip_revealer(websocket, player_id, reveal_for):
    """Set the VIP revealer for player or banker cards - simplified version."""
    if game_state["game_mode"] != "vip":
        await send_error(websocket, "VIP revealer can only be set in VIP mode")
        return False
    
    if player_id not in game_state["active_players"]:
        await send_error(websocket, "Player must be active to be a revealer")
        return False
    
    # Set the revealer (reveal_for is automatically determined)
    revealer_key = f"vip_{reveal_for}_revealer"
    game_state[revealer_key] = player_id
    await send_success(websocket, f"Player {player_id} set as VIP revealer for {reveal_for} cards")
    await broadcast_game_state()
    return True

async def handle_dealer_final_reveal(websocket):
    """Dealer triggers final reveal for all cards in VIP mode."""
    if game_state["game_mode"] != "vip":
        await send_error(websocket, "Final reveal only available in VIP mode")
        return False
    if game_state["game_phase"] != "waiting_for_reveal":
        await send_error(websocket, "Final reveal can only be triggered during waiting_for_reveal phase")
        return False
    game_state["cards_revealed"] = True
    # Now, after final reveal, calculate result if needed
    player_score = calculate_hand_score(player_cards)
    banker_score = calculate_hand_score(banker_cards)
    is_natural = player_score >= 8 or banker_score >= 8
    if is_natural:
        game_state["natural_win"] = True
        game_state["natural_type"] = "natural_9" if (player_score == 9 or banker_score == 9) else "natural_8"
        await calculate_result()
    else:
        game_state["game_phase"] = "waiting"
        await broadcast_game_state()
    await send_success(websocket, "Dealer triggered final reveal. All cards are now visible.")
    return True

counter=0
async def handle_client(websocket):
    global counter
    try:
        connected_clients.add(websocket)
        await broadcast_game_state()
        
        async for message in websocket:
            try:
                data = json.loads(message)
                action = data.get("action")
                
                if action == "add_card":
                    success = await handle_add_card(websocket, data.get("card", "").strip().upper())
                    if success:
                        await broadcast_game_state()
                
                elif action == "start_new_game":
                    if game_state["auto_dealing"]:
                        await send_error(websocket, "Cannot start new game during auto-dealing")
                    else:
                        new_round()
                        await send_success(websocket, "New game started!")
                        await broadcast_game_state()
                    
                elif action == "reset_game":
                    if game_state["auto_dealing"]:
                        await send_error(websocket, "Cannot reset during auto-dealing")
                    else:
                        await reset_all()
                        await send_success(websocket, "Game reset! 416 cards available. Burn card enabled.")
                        await broadcast_game_state()
                    
                elif action == "undo":
                    success = await handle_undo_card(websocket)
                    if success:
                        await broadcast_game_state()
                        
                elif action == "shuffle_cards":
                    success = await handle_shuffle_cards(websocket)
                    if success:
                        await broadcast_game_state()
                        
                elif action == "delete_last_entry":
                    await delete_last_game_entry(websocket)
                    
                elif action == "auto_deal":
                    await handle_auto_deal(websocket)
                    await broadcast_game_state()
                    
                elif action == "set_game_mode":
                    mode = data.get("mode", "manual")
                    if mode not in ["manual", "live", "automatic", "vip"]:
                        await send_error(websocket, "Invalid game mode")
                    else:
                        old_mode = game_state["game_mode"]
                        game_state["game_mode"] = mode
                        
                        # Enable burn ONLY on first switch to live/vip mode
                        if (old_mode == "manual" or old_mode=="automatic" )and mode in ["live", "vip"] and counter==0:
                            game_state["burn_available"] = True
                            logging.info(f"Burn enabled for first switch to {mode} mode")
                            counter=1
                        
                        if mode == "vip":
                            game_state["vip_player_revealer"] = None
                            game_state["vip_banker_revealer"] = None
                            game_state["cards_revealed"] = False
                        else:
                            game_state["vip_player_revealer"] = None
                            game_state["vip_banker_revealer"] = None
                            game_state["cards_revealed"] = True
                        await send_success(websocket, f"Game mode set to {mode}")
                        await broadcast_game_state()

                elif action == "manual_result":
                    if game_state["game_mode"] != "manual":
                        await send_error(websocket, "Manual result only allowed in manual mode")
                    else:
                        await handle_manual_result(websocket, data)

                elif action == "set_vip_revealer":
                    player_id = data.get("player_id")
                    if game_state["vip_player_revealer"] is None:
                        reveal_for = "player"  # First selection = player revealer
                    elif game_state["vip_banker_revealer"] is None:
                        if player_id == game_state["vip_player_revealer"]:
                            await send_error(websocket, f"Player {player_id} is already the player revealer. Please select a different player for banker revealer.")
                            continue
                        reveal_for = "banker"  # Second selection = banker revealer
                    else:
                        await send_error(websocket, "Both revealers already assigned for this round")
                        continue
                    await handle_set_vip_revealer(websocket, player_id, reveal_for)
                    print(game_state["vip_player_revealer"], game_state["vip_banker_revealer"])

                elif action == "update_players":
                    if not game_state["can_manage_players"]:
                        await send_error(websocket, "Cannot add/remove players while a round is in progress. Start a new game to manage players.")
                    else:
                        player_id = data.get("player_id")
                        is_active = data.get("is_active", False)
                        if is_active:
                            game_state["active_players"].add(player_id)
                            await send_success(websocket, f"Player {player_id} added")
                        else:
                            game_state["active_players"].discard(player_id)
                            await send_success(websocket, f"Player {player_id} removed")
                        await broadcast_game_state()
                        
                elif action == "set_table_number":
                    table_number = data.get("table_number", "13257")
                    game_state["table_number"] = table_number
                    await send_success(websocket, f"Table number set to {table_number}")
                    await broadcast_game_state()
                    
                elif action == "set_max_bet":
                    max_bet = int(data.get("max_bet", 100000))
                    game_state["max_bet"] = max_bet
                    await send_success(websocket, f"Max bet set to {max_bet}")
                    await broadcast_game_state()
                    
                elif action == "set_min_bet":
                    min_bet = int(data.get("min_bet", 10000))
                    game_state["min_bet"] = min_bet
                    await send_success(websocket, f"Min bet set to {min_bet}")
                    await broadcast_game_state()
                    
                elif action == "get_stats":
                    stats = {
                        "banker_wins": await get_banker_wins(),
                        "player_wins": await get_player_wins(),
                        "ties": await get_ties(),
                        "player_pairs": await get_player_pairs(),
                        "banker_pairs": await get_banker_pairs(),
                        "player_naturals": await get_player_naturals(),
                        "banker_naturals": await get_banker_naturals(),
                    }
                    await websocket.send(json.dumps({"action": "stats", **stats}))

                elif action == "start_burn_card":
                    success = await handle_start_burn_card(websocket)
                    if success:
                        await broadcast_game_state()
                
                elif action == "end_burn_card":
                    success = await handle_end_burn_card(websocket)
                    if success:
                        await broadcast_game_state()
                   
                elif action == "dealer_final_reveal":
                    await handle_dealer_final_reveal(websocket)

                else:
                    await send_error(websocket, f"Unknown action: {action}")
                    
            except json.JSONDecodeError:
                await send_error(websocket, "Invalid JSON")
                
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        logging.error(f"Error: {e}")
    finally:
        connected_clients.discard(websocket)

async def main():
    await check_connection()
    
    # Initialize with full 8-deck shoe (416 cards)
    global remaining_cards
    remaining_cards = create_8_deck_shoe()
    
    print(f"Baccarat WebSocket server running on localhost:6789")
    print(f"Initialized with {len(remaining_cards)} cards")
    
    async with websockets.serve(handle_client, "0.0.0.0",6789):
        await asyncio.Future()

# --- MongoDB stat aggregation functions ---
async def get_banker_wins():
    return await collection.count_documents({"winner": "banker"})

async def get_player_wins():
    return await collection.count_documents({"winner": "player"})

async def get_ties():
    return await collection.count_documents({"winner": "tie"})

async def get_player_pairs():
    return await collection.count_documents({"player_pair": True})

async def get_banker_pairs():
    return await collection.count_documents({"banker_pair": True})

async def get_player_naturals():
    return await collection.count_documents({"winner": "player", "player_natural": True})

async def get_banker_naturals():
    return await collection.count_documents({"winner": "banker", "banker_natural": True})

if __name__ == "__main__":
    asyncio.run(main())


