import type { TaroWsEvent } from '@taro/shared';

interface WsLike {
  readyState: number;
  send(data: string): void;
}

const OPEN = 1;

/**
 * Per-job WebSocket fan-out. MCP tools and the TrueForge event router both
 * publish here; every browser tab watching a job receives the same stream.
 */
export class WsHub {
  private readonly rooms = new Map<string, Set<WsLike>>();

  register(jobId: string, socket: WsLike & { on(ev: string, fn: () => void): void }): void {
    let room = this.rooms.get(jobId);
    if (!room) {
      room = new Set();
      this.rooms.set(jobId, room);
    }
    room.add(socket);
    socket.on('close', () => {
      room.delete(socket);
      if (room.size === 0) this.rooms.delete(jobId);
    });
  }

  broadcast(event: TaroWsEvent): void {
    const room = this.rooms.get(event.jobId);
    if (!room) return;
    const payload = JSON.stringify(event);
    for (const socket of room) {
      if (socket.readyState === OPEN) socket.send(payload);
    }
  }

  connectionCount(jobId: string): number {
    return this.rooms.get(jobId)?.size ?? 0;
  }
}
