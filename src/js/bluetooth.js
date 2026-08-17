/**
 * Web Bluetooth Proximity Connectivity Engine
 * Connects two nearby devices over Bluetooth GATT service where supported by browser/hardware.
 */

// Custom Chess960 Bluetooth GATT Service UUIDs
const CHESS_SERVICE_UUID = '0000ff00-0000-1000-8000-00805f9b34fb';
const CHESS_DATA_CHAR_UUID = '0000ff01-0000-1000-8000-00805f9b34fb';

export class BluetoothConnector {
  constructor({ onMessage, onConnected, onDisconnected, onError } = {}) {
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.isConnected = false;

    this.onMessage = onMessage;
    this.onConnected = onConnected;
    this.onDisconnected = onDisconnected;
    this.onError = onError;
  }

  isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  async scanAndConnect() {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth API is not supported in this browser. Please use Local WiFi / WebRTC room code mode.');
    }

    try {
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [CHESS_SERVICE_UUID, 'generic_access']
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.isConnected = false;
        if (this.onDisconnected) this.onDisconnected();
      });

      this.server = await this.device.gatt.connect();
      this.isConnected = true;

      if (this.onConnected) {
        this.onConnected({ deviceName: this.device.name || 'Bluetooth Chess Device' });
      }

      return { success: true, name: this.device.name };
    } catch (err) {
      if (this.onError) this.onError(err);
      throw err;
    }
  }

  async send(data) {
    if (!this.characteristic || !this.isConnected) return;
    try {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(JSON.stringify(data));
      await this.characteristic.writeValue(encoded);
    } catch (e) {
      console.warn('Bluetooth send error:', e);
    }
  }

  disconnect() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
  }
}
