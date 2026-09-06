import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from './socketEvents';

const getSocketUrl = () => {
    const configured = (import.meta.env.VITE_API_URL || '').trim();
    if (configured) return configured;

    if (typeof window !== 'undefined') {
        return window.location.origin;
    }

    return 'http://localhost:4000';
};

class SocketService {
    private socket: Socket | null = null;
    private connectionPromise: Promise<void> | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private knownBuildVersion: string | null = null;

    private readonly clientBuildId = (import.meta.env.VITE_BUILD_ID || '').trim();

    private alreadyReloadedFor(version: string): boolean {
        try {
            return sessionStorage.getItem('app:reloaded-build') === version;
        } catch {
            return false;
        }
    }

    private markReloadedFor(version: string) {
        try {
            sessionStorage.setItem('app:reloaded-build', version);
        } catch {
        }
    }

    private handleServerVersion(version: string) {
        if (!version) return;

        if (this.knownBuildVersion === null) {
            this.knownBuildVersion = version;
            if (this.clientBuildId && this.clientBuildId !== version && !this.alreadyReloadedFor(version)) {
                this.markReloadedFor(version);
                console.log('[Socket.io] Stale bundle detected on load, reloading…');
                window.location.reload();
            }
            return;
        }

        if (this.knownBuildVersion !== version) {
            console.log('[Socket.io] New build detected, reloading…');
            window.location.reload();
        }
    }

    connect() {
        if (this.socket?.connected) return Promise.resolve();
        if (this.connectionPromise) return this.connectionPromise;

        this.connectionPromise = new Promise((resolve, reject) => {
            this.socket = io(getSocketUrl(), {
                reconnectionAttempts: this.maxReconnectAttempts,
                timeout: 10000,
                withCredentials: true, // Crucial for HttpOnly cookies!
            });

            this.socket.on(SOCKET_EVENTS.SERVER_VERSION, (version: string) => {
                this.handleServerVersion(version);
            });

            this.socket.on('connect', () => {
                console.log('[Socket.io] Connected');
                this.reconnectAttempts = 0;
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.warn('[Socket.io] Connection error:', error.message);
                this.reconnectAttempts++;
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    reject(error);
                }
            });
        });

        return this.connectionPromise;
    }

    reconnect() {
        if (this.socket) {
            this.socket.disconnect().connect();
        }
    }

    joinAdmin() {
        this.socket?.emit('join:admin');
    }

    joinClub(clubId: string) {
        this.socket?.emit('join:club', clubId);
    }

    on(event: string, callback: (...args: any[]) => void) {
        this.socket?.on(event, callback);
    }

    off(event: string, callback?: (...args: any[]) => void) {
        this.socket?.off(event, callback);
    }

    getSocketInstance() {
        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.connectionPromise = null;
    }
}

export const socketService = new SocketService();

export const getSocket = () => {
    const existing = socketService.getSocketInstance();
    if (existing) {
        return existing;
    }

    void socketService.connect().catch((error) => {
        console.warn('[Socket.io] Initial lazy connect failed:', error);
    });

    return socketService.getSocketInstance();
};

export const reconnectSocket = () => {
    socketService.reconnect();
};

// Re-establish socket when the browser restores the page from the
// Back-Forward Cache (BFCache). In that case the old WebSocket is already
// closed by the browser, so we must disconnect cleanly and reconnect.
if (typeof window !== 'undefined') {
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            console.log('[Socket.io] Page restored from BFCache — reconnecting…');
            socketService.disconnect();
            void socketService.connect().catch((error) => {
                console.warn('[Socket.io] BFCache reconnect failed:', error);
            });
        }
    });
}

export { SOCKET_EVENTS };
