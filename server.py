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
COUNTERS_COLLECTION = "game_counters"

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]
counters_collection = db[COUNTERS_COLLECTION]

# Configure logging to suppress websocket handshake errors
logging.basicConfig(level=logging.INFO)
logging.getLogger('websockets.server').setLevel(logging.WARNING)
logging.getLogger('websockets').setLevel(logging.WARNING)

# Track connected clients
connected_clients = set()

# Game state - SIMPLIFIED
game_state = {
    "round": 0,
    "banker_wins": 0,
    "player_wins": 0,
    "ties": 0,
    "super_six_count": 0,
    "natural_count": 0,
    "game_phase": "waiting",
    "natural_win": False,
    "natural_type": None,
    "can_calculate": False,
    "burn_enabled": True,  # Always enabled by default
    "active_players": set(),
    "auto_dealing": False,
    "can_manage_players": True,
    "player_pair_count": 0,
    "banker_pair_count": 0
}

remaining_cards = None
card_duplicates = defaultdict(int)
last_card_info = {"card": None, "recipient": None}
last_game_result = None  # Store last game result for undo
player_cards = []
banker_cards = []
burn_card = None

# Store pairs detected at first 2 cards - PERSISTENT throughout game
game_pairs = {
    "player_pair": False,
    "banker_pair": False
}
game_results = {
    "is_super_six": False
}

last_round_auto_deal = False  # Track if last round was auto-deal

async def check_connection():
    try:
        await client.admin.command('ping')
        logging.info("Connected to MongoDB successfully.")
    except ServerSelectionTimeoutError as e:
        logging.error("Could not connect to MongoDB: %s", e)
        exit(1)

async def initialize_counters():
    """On server startup, delete all counters documents and create a new one with all counters zero."""
    try:
        # Delete all documents in the collection
        await counters_collection.delete_many({})
        # Create a new zeroed document
        zero_doc = {
            "_id": "game_counters",
            "round": 0,
            "banker_wins": 0,
            "player_wins": 0,
            "ties": 0,
            "super_six_count": 0,
            "natural_count": 0,
            "player_pair_count": 0,
            "banker_pair_count": 0,
            "last_updated": datetime.utcnow()
        }
        await counters_collection.insert_one(zero_doc)
        game_state.update({
            "round": 0,
            "banker_wins": 0,
            "player_wins": 0,
            "ties": 0,
            "super_six_count": 0,
            "natural_count": 0,
            "player_pair_count": 0,
            "banker_pair_count": 0
        })
        logging.info("[INIT] All counters reset to zero and MongoDB document recreated.")
    except Exception as e:
        logging.error(f"Error initializing counters: {e}")

async def update_counters_in_db():
    """Update the counters document in MongoDB to match in-memory game_state"""
    try:
        counters_doc = {
            "round": game_state["round"],
            "banker_wins": game_state["banker_wins"],
            "player_wins": game_state["player_wins"],
            "ties": game_state["ties"],
            "super_six_count": game_state["super_six_count"],
            "natural_count": game_state["natural_count"],
            "player_pair_count": game_state["player_pair_count"],
            "banker_pair_count": game_state["banker_pair_count"],
            "last_updated": datetime.utcnow()
        }
        logging.info(f"[MongoDB] Writing counters: {counters_doc}")
        result = await counters_collection.update_one(
            {"_id": "game_counters"},
            {"$set": counters_doc},
            upsert=True
        )
        logging.info(f"[MongoDB] Update result: matched={result.matched_count}, modified={result.modified_count}, upserted_id={result.upserted_id}")
    except Exception as e:
        logging.error(f"[MongoDB] Error updating counters: {e}")

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
    game_pairs = {"player_pair": False, "banker_pair": False}  # Reset pairs for new round
    
    game_state.update({
        "game_phase": "waiting",
        "natural_win": False,
        "natural_type": None,
        "can_calculate": False,
        "auto_dealing": False
    })

async def reset_all():
    global remaining_cards, card_duplicates, burn_card
    remaining_cards = create_8_deck_shoe()  # Reset to full 416 cards
    card_duplicates = defaultdict(int)
    burn_card = None
    new_round()
    game_state.update({
        "round": 0,
        "banker_wins": 0,
        "player_wins": 0,
        "ties": 0,
        "super_six_count": 0,
        "natural_count": 0,
        "player_pair_count": 0,
        "banker_pair_count": 0,
        "burn_enabled": True,
        "can_manage_players": True  # Always enabled after reset
    })
    logging.info(f"[RESET] In-memory counters after reset: { {k: game_state[k] for k in ['round','banker_wins','player_wins','ties','super_six_count','natural_count','player_pair_count','banker_pair_count']} }")
    await update_counters_in_db()
    logging.info("All data reset successfully")

# FIXED: More precise next card recipient logic for auto-dealing
def get_next_card_recipient():
    # Check if players are active (for manual mode)
    if not game_state["auto_dealing"] and len(game_state["active_players"]) == 0:
        return "no_players"
    
    total_cards = len(player_cards) + len(banker_cards)
    
    # Initial 4 cards - alternate starting with player
    if total_cards == 0:
        return "player"  # First card to player
    elif total_cards == 1:
        return "banker"  # Second card to banker
    elif total_cards == 2:
        return "player"  # Third card to player
    elif total_cards == 3:
        return "banker"  # Fourth card to banker
    
    # After 4 cards, check for natural or third card rules
    if total_cards == 4:
        player_score = calculate_hand_score(player_cards)
        banker_score = calculate_hand_score(banker_cards)
        
        # Natural win - no more cards
        if player_score >= 8 or banker_score >= 8:
            return "complete"
        
        # Third card rules
        if player_score <= 5:
            return "player"  # Player gets 5th card
        elif banker_score <= 5:
            return "banker"  # Banker gets 5th card if player stands
        else:
            return "complete"
    
    # After player gets third card (5 total cards)
    if total_cards == 5 and len(player_cards) == 3:
        banker_score = calculate_hand_score(banker_cards)
        player_third = card_value(player_cards[2])
        
        # Banker third card rules
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

async def shuffle_deck():
    """Shuffle remaining cards and reset to 416 total"""
    global remaining_cards, card_duplicates
    
    # Create fresh 8-deck shoe
    remaining_cards = create_8_deck_shoe()
    card_duplicates = defaultdict(int)
    
    # Enable burn card after shuffle
    game_state["burn_enabled"] = True
    game_state["can_manage_players"] = True
    
    logging.info(f"Deck shuffled - {len(remaining_cards)} cards available")

async def burn_card_from_deck():
    """Burn a card from the deck"""
    global burn_card
    
    if len(remaining_cards) > 0:
        burn_card = remaining_cards.popleft()
        card_duplicates[burn_card] += 1
        game_state["burn_enabled"] = False  # Disable after use
        logging.info(f"Burned card: {burn_card}")
        return burn_card
    return None

# SINGLE broadcast function
async def broadcast_game_state():
    """Broadcast game state to all connected clients"""
    if not connected_clients:
        return
    
    next_recipient = get_next_card_recipient()
    
    message = {
        "action": "game_state",
        "playerCards": player_cards,
        "bankerCards": banker_cards,
        "playerTotal": calculate_hand_score(player_cards),
        "bankerTotal": calculate_hand_score(banker_cards),
        "nextCardGoesTo": next_recipient,
        "gamePhase": game_state["game_phase"],
        "playerPair": game_pairs["player_pair"],  # Use persistent pairs
        "bankerPair": game_pairs["banker_pair"],   # Use persistent pairs
        "remainingCards": len(remaining_cards),
        "usedCards": sum(card_duplicates.values()),
        "canUndo": len(player_cards) > 0 or len(banker_cards) > 0 or (last_game_result and game_state["game_phase"] == "finished"),
        "canCalculate": game_state["can_calculate"],
        "canShuffle": len(remaining_cards) < 52,  # Manual mode shuffle condition
        "burnEnabled": game_state["burn_enabled"],
        "burnCard": burn_card,
        "naturalWin": game_state["natural_win"],
        "naturalType": game_state["natural_type"],
        "round": game_state["round"],
        "playerWins": game_state["player_wins"],
        "bankerWins": game_state["banker_wins"],
        "ties": game_state["ties"],
        "SuperSixCount": game_state["super_six_count"],
        "naturalCount": game_state["natural_count"],
        "activePlayers": list(game_state["active_players"]),
        "autoDealingInProgress": game_state["auto_dealing"],
        "noPlayersActive": next_recipient == "no_players",
        "canManagePlayers": game_state["can_manage_players"],
        "playerPairCount": game_state["player_pair_count"],
        "bankerPairCount": game_state["banker_pair_count"]
    }
    
    websockets_to_remove = set()
    for websocket in connected_clients:
        try:
            await websocket.send(json.dumps(message))
        except websockets.exceptions.ConnectionClosed:
            websockets_to_remove.add(websocket)
    
    connected_clients.difference_update(websockets_to_remove)

async def broadcast_result(result_data):
    """Broadcast game result to all connected clients"""
    if not connected_clients:
        return
        
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

# UNIFIED add_card function for both manual and auto-dealing
async def handle_add_card(websocket, card, is_auto_deal=False):
    # For auto-deal, skip manual validation and player checks
    if not is_auto_deal:
        # Block manual card adding during auto-dealing
        if game_state["auto_dealing"]:
            await send_error(websocket, "Cannot add cards manually during auto-dealing")
            return False
        
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
    
    # Add card to appropriate hand
    if recipient == "player":
        player_cards.append(card)
    else:
        banker_cards.append(card)
    
    if len(player_cards) == 1 :
        game_state["can_manage_players"] = False
        logging.info("Player management disabled - cards being dealt")
    # FIXED: Different tracking for auto-deal vs manual
    
    if is_auto_deal:
        # For auto-deal, only update duplicates count (card already popped from deck)
        card_duplicates[card] += 1
        last_card_info.update({"card": card, "recipient": recipient})
    else:
        # For manual mode, use normal tracking
        update_card_tracking(card, recipient)
    
    # Check for pairs ONLY when second card is dealt (PERSISTENT)
    if recipient == "player" and len(player_cards) == 2:
        game_pairs["player_pair"] = has_pair(player_cards)
        logging.info(f"Player pair detected: {player_cards} -> {game_pairs['player_pair']}")
    elif recipient == "banker" and len(banker_cards) == 2:
        game_pairs["banker_pair"] = has_pair(banker_cards)
        logging.info(f"Banker pair detected: {banker_cards} -> {game_pairs['banker_pair']}")
    
    # Check for natural win after 4 cards
    total_cards = len(player_cards) + len(banker_cards)
    if total_cards == 4:
        player_score = calculate_hand_score(player_cards)
        banker_score = calculate_hand_score(banker_cards)
        game_state["can_calculate"] = True
        
        if player_score >= 8 or banker_score >= 8:
            game_state["natural_win"] = True
            game_state["natural_type"] = "natural_9" if (player_score == 9 or banker_score == 9) else "natural_8"
            # Only auto-calculate for manual mode, not during auto-deal
            if not is_auto_deal:
                await calculate_result()
                return True
    
    # Auto-calculate when game is complete (only for manual mode)
    if not is_auto_deal and get_next_card_recipient() == "complete":
        await calculate_result()
    
    return True

async def calculate_result():
    """Calculate and broadcast game result"""
    global last_game_result, last_round_auto_deal
    
    player_score = calculate_hand_score(player_cards)
    banker_score = calculate_hand_score(banker_cards)
    
    # Super Six: Banker wins with 6 points using exactly 3 cards
    is_super_six = (banker_score == 6 and banker_score > player_score and len(banker_cards) == 3)
    
    # Use PERSISTENT pair status
    player_pair = game_pairs["player_pair"]
    banker_pair = game_pairs["banker_pair"]
    
    is_natural = game_state["natural_win"]
    natural_type = game_state["natural_type"]
    
    # Store previous state for potential undo
    previous_state = {
        "round": game_state["round"],
        "player_wins": game_state["player_wins"],
        "banker_wins": game_state["banker_wins"],
        "ties": game_state["ties"],
        "super_six_count": game_state["super_six_count"],
        "natural_count": game_state["natural_count"]
    }
    
    # Determine winner
    if player_score > banker_score:
        winner = "player"
        game_state["player_wins"] += 1
    elif banker_score > player_score:
        winner = "banker"
        game_state["banker_wins"] += 1
        if is_super_six:
            game_state["super_six_count"] += 1
    else:
        winner = "tie"
        game_state["ties"] += 1
    
    if is_natural:
        game_state["natural_count"] += 1
    if player_pair:
        game_state["player_pair_count"] += 1
    if banker_pair:
        game_state["banker_pair_count"] += 1
    
    # Save to database (update counters only)
    await update_counters_in_db()
    
    # Store result for potential undo
    last_game_result = {
        "winner": winner,
        "is_super_six": is_super_six,
        "is_natural": is_natural,
        "previous_state": previous_state
    }
    
    # IMPORTANT: Set game phase to finished
    game_state["game_phase"] = "finished"
    game_state["can_calculate"] = False
    last_round_auto_deal = False  # Manual result, so not auto-deal
    
    # Create result message
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
        "round": game_state["round"],
        "playerWins": game_state["player_wins"],
        "bankerWins": game_state["banker_wins"],
        "ties": game_state["ties"],
        "SuperSixCount": game_state["super_six_count"],
        "naturalCount": game_state["natural_count"]
    }
    
    # Broadcast result first
    await broadcast_result(result_data)
    
    # Then broadcast updated game state
    await broadcast_game_state()
    
async def handle_burn_card(websocket, card):
    global burn_card
    
    # Block manual burn during auto-dealing
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
    """
    Unified undo: after finished game (manual or auto-deal), restores stats and removes last card. Otherwise, undoes last card as before.
    """
    global last_game_result, last_round_auto_deal

    # Block undo only if auto_dealing is currently True (not after auto-deal is finished)
    if game_state["auto_dealing"]:
        await send_error(websocket, "Cannot undo during auto-dealing in progress")
        return False

    # Block undo if last round was auto-deal and game is finished
    if game_state["game_phase"] == "finished" and last_round_auto_deal:
        await send_error(websocket, "Undo is not allowed after auto-deal round.")
        return False

    # If game is finished and last_game_result exists, restore stats and remove last card
    if last_game_result and game_state["game_phase"] == "finished":
        previous_state = last_game_result["previous_state"]
        # Restore all previous stats and flags
        game_state.update(previous_state)
        game_state["game_phase"] = "waiting"
        game_state["can_calculate"] = True
        game_state["natural_win"] = False
        game_state["natural_type"] = None
        # Always decrement pair counts if last result had a pair
        if last_game_result.get("player_pair"):
            game_state["player_pair_count"] = max(0, game_state["player_pair_count"] - 1)
        if last_game_result.get("banker_pair"):
            game_state["banker_pair_count"] = max(0, game_state["banker_pair_count"] - 1)
        last_game_result = None
        # Remove the last card (from the correct hand)
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
            await update_counters_in_db()
            await send_success(websocket, "Undid game result, no cards left to undo.")
            return True
        # Remove the last card
        if last_recipient == "player":
            player_cards.pop()
        else:
            banker_cards.pop()
        update_card_tracking(last_card_to_undo, last_recipient, is_undo=True)
        # Recalculate pair flags for display only
        game_pairs["player_pair"] = len(player_cards) == 2 and has_pair(player_cards)
        game_pairs["banker_pair"] = len(banker_cards) == 2 and has_pair(banker_cards)
        # Reset game state flags based on remaining cards
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
        await update_counters_in_db()
        await send_success(websocket, f"Undid game result and last card: {last_card_to_undo} from {last_recipient}")
        return True

    # Otherwise, undo the last card as before
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
    # Remove the last card
    if last_recipient == "player":
        player_cards.pop()
    else:
        banker_cards.pop()
    update_card_tracking(last_card_to_undo, last_recipient, is_undo=True)
    # Recalculate pairs based on remaining cards
    game_pairs["player_pair"] = len(player_cards) == 2 and has_pair(player_cards)
    game_pairs["banker_pair"] = len(banker_cards) == 2 and has_pair(banker_cards)
    # Reset game state flags based on remaining cards
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
    await update_counters_in_db()
    return True

async def handle_shuffle_cards(websocket):
    # Block manual shuffle during auto-dealing
    if game_state["auto_dealing"]:
        await send_error(websocket, "Cannot shuffle manually during auto-dealing")
        return False
    
    # Manual mode - only show popup if less than 52 cards
    if len(remaining_cards) >= 52:
        await send_error(websocket, "Too many cards remaining to shuffle")
        return False
    
    await shuffle_deck()
    await send_success(websocket, "Cards shuffled! Deck reset to 416 cards. Burn card enabled.")
    return True

async def handle_auto_deal(websocket):
    global last_round_auto_deal
    try:
        if game_state["auto_dealing"]:
            await send_error(websocket, "Auto-dealing already in progress")
            return False

        if len(player_cards) > 0 or len(banker_cards) > 0:
            await send_error(websocket, "Please start a new game before auto-dealing")
            return False

        # Block auto-deal if there are no active players
        if not game_state["active_players"]:
            await send_error(websocket, "Cannot auto-deal: No active players.")
            return False

        game_state["auto_dealing"] = True
        game_state["game_phase"] = "auto_dealing"

        await send_success(websocket, "Starting auto-deal...")
        await broadcast_game_state()

        if len(remaining_cards) < 52:
            await shuffle_deck()
            await broadcast_game_state()
            await asyncio.sleep(1.0)

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
            await asyncio.sleep(1.5)

        if get_next_card_recipient() == "complete":
            await calculate_result()
            await broadcast_game_state()

        game_state["auto_dealing"] = False
        game_state["game_phase"] = "finished"
        last_round_auto_deal = True

        await send_success(websocket, "Auto-deal completed!")
        await broadcast_game_state()
        return True

    except Exception as e:
        game_state["auto_dealing"] = False
        game_state["game_phase"] = "waiting"
        await send_error(websocket, f"Auto-deal failed: {str(e)}")
        await broadcast_game_state()
        return False

async def handle_delete_last_entry(websocket):
    # Delete the document and recreate it with zeros
    await counters_collection.delete_many({})
    zero_doc = {
        "_id": "game_counters",
        "round": 0,
        "banker_wins": 0,
        "player_wins": 0,
        "ties": 0,
        "super_six_count": 0,
        "natural_count": 0,
        "player_pair_count": 0,
        "banker_pair_count": 0,
        "last_updated": datetime.utcnow()
    }
    await counters_collection.insert_one(zero_doc)
    game_state.update({
        "round": 0,
        "banker_wins": 0,
        "player_wins": 0,
        "ties": 0,
        "super_six_count": 0,
        "natural_count": 0,
        "player_pair_count": 0,
        "banker_pair_count": 0
    })
    await send_success(websocket, "All counters reset to zero (all history deleted)")
    await broadcast_game_state()
    return True

async def handle_client(websocket):
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
                        
                elif action == "calculate_result":
                    # Block manual calculation during auto-dealing
                    if game_state["auto_dealing"]:
                        await send_error(websocket, "Cannot calculate manually during auto-dealing")
                    elif not game_state["can_calculate"]:
                        await send_error(websocket, "Cannot calculate yet")
                    else:
                        await calculate_result()
                        
                elif action == "start_new_game":
                    # Block new game during auto-dealing
                    if game_state["auto_dealing"]:
                        await send_error(websocket, "Cannot start new game during auto-dealing")
                    else:
                        new_round()
                        await send_success(websocket, "New game started!")
                        await broadcast_game_state()
                    
                elif action == "reset_game":
                    # Block reset during auto-dealing
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
                        
                elif action == "burn_card":
                    success = await handle_burn_card(websocket, data.get("card", "").strip().upper())
                    if success:
                        await broadcast_game_state()
                        
                elif action == "update_players":
                    # RESTRICTION: Only allow player management at specific times
                    if game_state["auto_dealing"]:
                        await send_error(websocket, "Cannot update players during auto-dealing")
                    elif not game_state["can_manage_players"]:
                        await send_error(websocket, "Cannot add/remove players now. Use Reset or Shuffle to enable player management.")
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
                    
                elif action == "auto_deal":
                    await handle_auto_deal(websocket)
                
                elif action == "delete_last_entry":
                    await handle_delete_last_entry(websocket)
                
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
    await initialize_counters()
    
    # Initialize with full 8-deck shoe (416 cards)
    global remaining_cards
    remaining_cards = create_8_deck_shoe()
    
    print(f"Baccarat WebSocket server running on localhost:6789")
    print(f"Initialized with {len(remaining_cards)} cards")
    
    async with websockets.serve(handle_client, "localhost", 6789):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())