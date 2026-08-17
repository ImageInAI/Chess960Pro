/**
 * P2P WebRTC Multiplayer Network Engine
 * Supports Online Room Codes, Direct Link Sharing, LAN/WiFi connectivity, and In-Game Chat.
 */

export class P2PNetwork {
  constructor({ onConnected, onDisconnected, onData, onError } = {}) {
    this.peer = null;
    this.conn = null;
    this.peerId = null;
    this.isHost = false;
    this.connected = false;

    this.onConnected = onConnected;
    this.onDisconnected = onDisconnected;
    this.onData = onData;
    this.onError = onError;
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `CH960-${code}`;
  }

  async initPeer(customId = null) {
    return new Promise((resolve, reject) => {
      // Check if PeerJS is available in window
      if (typeof window.Peer === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
        script.onload = () => this.createPeerInstance(customId, resolve, reject);
        script.onerror = () => reject(new Error('Failed to load WebRTC Peer library'));
        document.head.appendChild(script);
      } else {
        this.createPeerInstance(customId, resolve, reject);
      }
    });
  }

  createPeerInstance(customId, resolve, reject) {
    try {
      const config = {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      };

      this.peer = customId ? new window.Peer(customId, config) : new window.Peer(config);

      this.peer.on('open', id => {
        this.peerId = id;
        resolve(id);
      });

      this.peer.on('connection', conn => {
        // Incoming connection (Host receiving guest)
        this.conn = conn;
        this.setupConnectionHandlers();
      });

      this.peer.on('error', err => {
        if (this.onError) this.onError(err);
        reject(err);
      });

      this.peer.on('disconnected', () => {
        if (this.onDisconnected) this.onDisconnected();
      });
    } catch (e) {
      reject(e);
    }
  }

  async createRoom(roomCode = null) {
    const code = roomCode || this.generateRoomCode();
    this.isHost = true;
    await this.initPeer(code);
    return code;
  }

  async joinRoom(roomCode) {
    this.isHost = false;
    await this.initPeer();

    return new Promise((resolve, reject) => {
      this.conn = this.peer.connect(roomCode, { reliable: true });

      this.conn.on('open', () => {
        this.connected = true;
        this.setupConnectionHandlers();
        if (this.onConnected) this.onConnected({ isHost: false, peerId: this.peerId });
        resolve();
      });

      this.conn.on('error', err => {
        if (this.onError) this.onError(err);
        reject(err);
      });

      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timed out. Please verify the Room Code.'));
        }
      }, 10000);
    });
  }

  setupConnectionHandlers() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      this.connected = true;
      if (this.onConnected) this.onConnected({ isHost: this.isHost, peerId: this.peerId });
    });

    this.conn.on('data', data => {
      if (this.onData) this.onData(data);
    });

    this.conn.on('close', () => {
      this.connected = false;
      if (this.onDisconnected) this.onDisconnected();
    });

    this.conn.on('error', err => {
      if (this.onError) this.onError(err);
    });
  }

  send(type, payload = {}) {
    if (this.conn && this.conn.open) {
      this.conn.send({ type, payload, timestamp: Date.now() });
    }
  }

  disconnect() {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connected = false;
  }
}
