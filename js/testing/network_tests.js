/**
 * Network & Connectivity Test Suite
 * Validates:
 * 1. Offline Bot move response and decision quality
 * 2. P2P Direct Wireless channel handshake, move packet transmission, and latency logging
 * 3. Online Google OAuth sign-in, room creation, and matchmaking state machine
 */

import { ChessBot } from '../engine/bot.js';
import { Chess960Engine } from '../engine/chess960.js';
import { OfflineBotAdapter, P2PBluetoothWifiSimulator, OnlineGoogleAuthSimulator } from '../network/network_simulator.js';

export function registerNetworkTests(runner) {
    runner.describe('Offline Game Engine Bot', () => {
        runner.it('Bot generates valid legal move within reasonable depth', async (assert) => {
            const engine = new Chess960Engine(518);
            const bot = new ChessBot('easy');
            const adapter = new OfflineBotAdapter(bot);

            const move = await adapter.requestMove(engine);

            assert.isTrue(!!move, 'Bot must return a valid Move object');
            assert.isTrue(engine.getLegalMoves().some(m => m.from === move.from && m.to === move.to), 'Bot move must be legal');
        });
    });

    runner.describe('P2P / Local WiFi / Bluetooth Direct Channel', () => {
        runner.it('Executes 3-way handshake and sends move packet with ACK', async (assert) => {
            const p2p = new P2PBluetoothWifiSimulator();
            let connectedState = false;

            p2p.on('state_change', (evt) => {
                if (evt.state === 'CONNECTED') connectedState = true;
            });

            await p2p.connect('Player2_Device', 'Bluetooth');
            assert.isTrue(connectedState, 'P2P state must transition to CONNECTED after handshake');

            const ack = await p2p.sendMove({ moveSAN: 'e4', fen: 'startfen' });
            assert.equal(ack.status, 'ACK', 'Sent move must return ACK');
            assert.isTrue(p2p.packetLog.length > 0, 'Packet log must record network packets');

            p2p.disconnect();
            assert.equal(p2p.state, 'DISCONNECTED', 'P2P state must be DISCONNECTED after teardown');
        });
    });

    runner.describe('Online Google Auth & Matchmaking Lobby', () => {
        runner.it('Performs Google sign-in, creates cloud room, and joins opponent', async (assert) => {
            const online = new OnlineGoogleAuthSimulator();

            const user = await online.signInWithGoogle();
            assert.equal(user.name, 'Grandmaster Alex', 'User profile must match Google Auth simulation');

            const room = await online.createRoom(959, 'Rapid 10+0');
            assert.equal(room.status, 'WAITING_FOR_OPPONENT', 'Newly created room must wait for opponent');

            await online.simulatedOpponentJoin();
            assert.equal(room.status, 'GAME_IN_PROGRESS', 'Room status must become GAME_IN_PROGRESS upon join');
            assert.isTrue(!!room.opponent, 'Opponent profile must be populated');

            online.signOut();
            assert.equal(online.currentUser, null, 'User profile must be null after sign out');
        });
    });
}
