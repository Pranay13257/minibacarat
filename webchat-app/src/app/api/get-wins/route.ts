import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { IP } from "../../ip";

const MONGO_URI = `mongodb://${IP}:27017`;
const DB_NAME = "game_db";
const COLLECTION_NAME = "game_results";

export async function GET() {
  try {
    const client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const winsCollection = db.collection(COLLECTION_NAME);

    // Fetch the last 10 wins, sorted by latest
    const wins = await winsCollection.find().sort({ timestamp: -1 }).limit(30).toArray();
    client.close();

    return NextResponse.json(wins);
  } catch (error) {
    console.error("Error fetching wins:", error);
    return NextResponse.json({ error: "Failed to fetch wins" }, { status: 500 });
  }
}
