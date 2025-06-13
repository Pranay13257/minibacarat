import { useState, useEffect } from "react";

const Header = ({ socket, table }: { socket: WebSocket | null; table: string | null }) => {
  const [tableNumber, setTableNumber] = useState<string | null>(table);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      console.log("Received WebSocket message:", event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.action === "table_number_set") {
          setTableNumber(data.tableNumber); // ✅ Update table number state
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket]); // ✅ Re-run when `socket` changes

  return (
    <div className="flex justify-between items-center bg-black relative font-questrial">
      <img src="/assets/ocean7.png" alt="ocean7" className="w-20 h-20 p-1" />
      <img
        src="/assets/logo.png"
        alt="logo"
        className="absolute left-1/2 z-20 transform -translate-x-1/2 h-40"
      />
      <div className="text-6xl font-ramaraja text-yellow-300 text-center">
        TABLE NUMBER <br />
        FT{tableNumber ?? "Waiting..."} {/* Show table number or default text */}
      </div>
    </div>
  );
};

export default Header;