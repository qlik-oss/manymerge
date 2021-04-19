import {
  BinarySyncMessage,
  generateSyncMessage,
  receiveSyncMessage,
  Doc,
  SyncState,
} from 'automerge';

/**
 * An Automerge Network protocol getting consensus
 * between two documents in different places.
 */
export class Hub {
  _broadcast: (msg: BinarySyncMessage) => void;
  _sendTo: (peerId: string, msg: BinarySyncMessage) => void;
  // map of last syncs from known peers
  _lastSyncs: Map<string, SyncState | undefined> = new Map();

  constructor(
    // Send message to just one peerId
    sendMsgTo: (peerId: string, msg: BinarySyncMessage) => void,
    // Send to everyone
    broadcastMsg: (msg: BinarySyncMessage) => void
  ) {
    this._sendTo = sendMsgTo;
    this._broadcast = broadcastMsg;
  }

  public applyMessage<T>(
    peerId: string,
    msg: BinarySyncMessage,
    doc: Doc<T>
  ): Doc<T> | undefined {
    let nextDoc;

    // Initialize empty sync state for new peer
    if (!this._lastSyncs.has(peerId)) {
      this._lastSyncs.set(peerId, undefined);
    }

    // Get latest sync state
    const lastSync = this._lastSyncs.get(peerId) as SyncState;

    // Apply the message received
    const [nextState, newDoc] = receiveSyncMessage(lastSync, doc, msg);

    // Save the nextState for peer
    this._lastSyncs.set(peerId, nextState);

    // Determine if we have a message to send
    const [theirState, replyMsg] = generateSyncMessage(nextState, newDoc);

    if (replyMsg) {
      this.sendMsgTo(peerId, replyMsg);
      this._lastSyncs.set(peerId, theirState);
    }

    // if the doc changed, notify other peers
    if (newDoc !== doc) {
      nextDoc = newDoc;
      this.notify(nextDoc, [peerId]);
    }

    return nextDoc;
  }

  public notify<T>(doc: Doc<T>, exclude: string[] = []) {
    this._lastSyncs.forEach((lastSync, peerId) => {
      // Don't send messages for excluded peers
      if (exclude.includes(peerId)) return;

      const [theirNextState, replyMsg] = generateSyncMessage(
        lastSync as SyncState,
        doc
      );
      if (replyMsg) {
        this.sendMsgTo(peerId, replyMsg);
        this._lastSyncs.set(peerId, theirNextState);
      }
    });
  }

  broadcast<T>(doc: Doc<T>) {
    const [, msg] = generateSyncMessage((null as any) as SyncState, doc);

    if (msg) {
      this.broadcastMsg(msg);
    }
  }

  private sendMsgTo(peerId: string, msg: BinarySyncMessage) {
    this._sendTo(peerId, msg);
  }

  private broadcastMsg(msg: BinarySyncMessage) {
    this._broadcast(msg);
  }
}
