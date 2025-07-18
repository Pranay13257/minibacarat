import subprocess
import webbrowser
import os
import time
import socket
import serial
import sys
import signal
import shutil

# Path to your venv's python.exe
#VENV_PYTHON = r"D:\Projects\venv\Scripts\python.exe"


node_proc = None
python_proc = None

# URL to open
WEB_URL = "http://192.168.2.190:3000"

# Tkinter setup
# root = tk.Tk()
# root.title("Mini Flush Server Control")
# root.geometry("350x220")

# status_node = tk.StringVar()
# status_python = tk.StringVar()
# status_node.set("Node App: Not running")
# status_python.set("Python Server: Not running")

SERIAL_PORT = "COM1"  # Match with server.py
BAUD_RATE = 9600

# --- Chrome detection ---
def find_chrome_path():
    # Try to find Chrome in common Windows locations
    chrome_names = [
        os.path.join(os.environ.get('PROGRAMFILES', ''), 'Google', 'Chrome', 'Application', 'chrome.exe'),
        os.path.join(os.environ.get('PROGRAMFILES(X86)', ''), 'Google', 'Chrome', 'Application', 'chrome.exe'),
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]
    for path in chrome_names:
        if os.path.isfile(path):
            return path
    # Try PATH
    chrome_path = shutil.which('chrome')
    if chrome_path:
        return chrome_path
    return None

# --- Server management ---
def start_servers():
    global node_proc, python_proc
    if node_proc is None or node_proc.poll() is not None:
        node_proc = subprocess.Popen(
            'cd /d "webchat-app" && npx next dev --port 3000 --hostname 0.0.0.0',
            shell=True
        )
    if python_proc is None or python_proc.poll() is not None:
        python_proc = subprocess.Popen(
            # f'"{VENV_PYTHON}" server.py',
            "python server.py", 
            cwd=os.getcwd(),
            shell=True
        )


def open_web():
    webbrowser.open(WEB_URL)

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('0.0.0.0', port)) == 0 or s.connect_ex(('127.0.0.1', port)) == 0

def close_serial_port():
    """Close the serial port if it's in use."""
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        if ser.is_open:
            ser.close()
            print(f"Closed {SERIAL_PORT} successfully.")
    except serial.SerialException as e:
        print(f"Could not close {SERIAL_PORT}: {e}")

def close_servers():
    global node_proc, python_proc
    if node_proc is not None and node_proc.poll() is None:
        node_proc.terminate()
        try:
            node_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            node_proc.kill()
        time.sleep(1)
        if is_port_open(3000):
            print("Node App: Port still in use!")
        else:
            print("Node App: Stopped")
    if python_proc is not None and python_proc.poll() is None:
        python_proc.terminate()
        try:
            python_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            python_proc.kill()
        print("Python Server: Stopped")
    close_serial_port()

def signal_handler(sig, frame):
    print("\nReceived exit signal. Cleaning up...")
    close_servers()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# --- Main logic ---
def main():
    print("Starting servers...")
    start_servers()
    time.sleep(3)  # Give servers time to start
    chrome_path = find_chrome_path()
    browser_proc = None
    if chrome_path:
        print("Opening Chrome in fullscreen mode...")
        browser_proc = subprocess.Popen([
            chrome_path,
            '--start-fullscreen',
            '--new-window',
            WEB_URL
        ])
        try:
            browser_proc.wait()
        except KeyboardInterrupt:
            pass
        print("Chrome closed. Shutting down servers...")
    else:
        print("Chrome not found. Opening in default browser (no fullscreen, press Enter to exit)...")
        webbrowser.open(WEB_URL)
        try:
            input("Press Enter after closing the browser to stop servers...")
        except KeyboardInterrupt:
            pass
    close_servers()
    print("Cleanup complete. Exiting.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}")
        close_servers()
        sys.exit(1)
