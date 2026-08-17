/**
 * Network & Connectivity Simulator for Chess 960 Game Engine
 * Simulates:
 * 1. Offline Bot Adapter
 * 2. Peer-to-Peer / Local WiFi / Bluetooth Direct Connection
 * 3. Online Google Account Authentication & Room Matchmaking Lobby
 */

export class OfflineBotAdapter {
    constructor(botEngine) {
        this.bot = botEngine;
    }

    async requestMove(chessEngine) {
        // Simulate thinking time for realistic human-like feel
        const delay = Math.floor(Math.random() * 300) + 400;
        await new Promise(res => setTimeout(res, delay));
        return await this.bot.getBestMove(chessEngine);
    }
}

export class P2PBluetoothWifiSimulator {
    constructor() {
        this.state = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING
        this.peerId = null;
        this.connectionType = 'WiFi Direct'; // 'Bluetooth' or 'WiFi Direct'
        this.simulatedPingMs = 45;
        this.packetLossRate = 0.0;
        this.eventListeners = {};
        this.packetLog = [];
    }

    on(event, callback) {
        if (!this.eventListeners[event]) this.eventListeners[event] = [];
        this.eventListeners[event].push(callback);
    }

    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(cb => cb(data));
        }
    }

    async connect(targetPeerId = 'Peer-Player-2', type = 'WiFi Direct') {
        this.connectionType = type;
        this.state = 'CONNECTING';
        this.emit('state_change', { state: this.state, msg: `Initiating ${type} handshake with ${targetPeerId}...` });

        // Step 1: Handshake SYN
        await new Promise(res => setTimeout(res, 200));
        this.logPacket('OUTBOUND', 'SYN_HANDSHAKE', { targetPeerId });

        // Step 2: Handshake SYN-ACK
        await new Promise(res => setTimeout(res, 250));
        this.logPacket('INBOUND', 'SYN_ACK_HANDSHAKE', { status: 'ACCEPTED' });

        this.peerId = targetPeerId;
        this.state = 'CONNECTED';
        this.emit('state_change', { state: this.state, peerId: this.peerId, msg: `${type} connected successfully!` });
        return true;
    }

    disconnect() {
        this.state = 'DISCONNECTED';
        this.peerId = null;
        this.emit('state_change', { state: this.state, msg: 'P2P connection closed.' });
    }

    async sendMove(moveData) {
        if (this.state !== 'CONNECTED') {
            throw new Error("Cannot send move over P2P: Network disconnected.");
        }

        // Simulate packet loss drop check
        if (Math.random() < this.packetLossRate) {
            this.logPacket('DROPPED', 'MOVE_PACKET', moveData);
            this.emit('error', { msg: 'Packet loss detected. Retransmitting...' });
            await new Promise(res => setTimeout(res, 300)); // Retransmit delay
        }

        // Simulate network latency
        await new Promise(res => setTimeout(res, this.simulatedPingMs));
        this.logPacket('OUTBOUND', 'MOVE_PACKET', moveData);
        this.emit('move_sent', moveData);

        return { status: 'ACK', latencyMs: this.simulatedPingMs };
    }

    logPacket(dir, type, payload) {
        const pkt = {
            id: 'PKT_' + Math.floor(Math.random() * 100000),
            timestamp: new Date().toISOString(),
            direction: dir,
            type: type,
            payload: payload
        };
        this.packetLog.push(pkt);
        if (this.packetLog.length > 50) this.packetLog.shift();
        this.emit('packet_logged', pkt);
    }
}

export class OnlineGoogleAuthSimulator {
    constructor() {
        this.currentUser = null; // { googleId, name, email, avatar, rating }
        this.currentRoom = null;
        this.eventListeners = {};
    }

    on(event, callback) {
        if (!this.eventListeners[event]) this.eventListeners[event] = [];
        this.eventListeners[event].push(callback);
    }

    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(cb => cb(data));
        }
    }

    async signInWithGoogle() {
        await new Promise(res => setTimeout(res, 400));
        this.currentUser = {
            googleId: 'g_user_960_8849',
            name: 'Grandmaster Alex',
            email: 'alex.chess960@gmail.com',
            avatar: '👤',
            rating: 1850
        };
        this.emit('auth_change', { authenticated: true, user: this.currentUser });
        return this.currentUser;
    }

    signOut() {
        this.currentUser = null;
        this.currentRoom = null;
        this.emit('auth_change', { authenticated: false, user: null });
    }

    async createRoom(spIndex = 518, modeName = 'Blitz 3+2') {
        if (!this.currentUser) throw new Error("Must be signed in to create online room.");

        await new Promise(res => setTimeout(res, 300));
        const roomId = 'ROOM_' + Math.floor(Math.random() * 9000 + 1000);
        this.currentRoom = {
            id: roomId,
            host: this.currentUser,
            opponent: null,
            spIndex: spIndex,
            modeName: modeName,
            status: 'WAITING_FOR_OPPONENT',
            createdAt: new Date().toISOString()
        };
        this.emit('room_update', this.currentRoom);
        return this.currentRoom;
    }

    async simulatedOpponentJoin() {
        if (!this.currentRoom) return;
        await new Promise(res => setTimeout(res, 600));
        this.currentRoom.opponent = {
            googleId: 'g_user_4491',
            name: 'ChessRival_Online',
            email: 'rival.online@gmail.com',
            avatar: '⚔️',
            rating: 1820
        };
        this.currentRoom.status = 'GAME_IN_PROGRESS';
        this.emit('room_update', this.currentRoom);
        this.emit('game_start', this.currentRoom);
    }

    async sendOnlineMove(moveSAN, fen) {
        if (!this.currentRoom || this.currentRoom.status !== 'GAME_IN_PROGRESS') {
            throw new Error("No active online room session.");
        }
        await new Promise(res => setTimeout(res, 60));
        this.emit('online_move_synced', { moveSAN, fen, player: this.currentUser.name });
    }
}
