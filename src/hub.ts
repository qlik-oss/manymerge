import {
  BinarySyncMessage,
  generateSyncMessage,
  receiveSyncMessage,
  Doc,
  SyncState,
  initSyncState,
  // Backend,
  // Frontend,
  // BinaryChange,
  // SyncMessage,
} from 'automerge';

/**
 * An Automerge Network protocol getting consensus
 * between two documents in different places.
 */
export class Hub {
  _broadcast: (msg: BinarySyncMessage) => void;
  _sendTo: (peerId: string, msg: BinarySyncMessage) => void;
  // map of last syncs from known peers
  _lastSyncs: Map<string, SyncState> = new Map();

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
  ): Doc<T> {
    // Get latest sync state
    const lastSync = this._lastSyncs.get(peerId) || initSyncState();

    // Apply the message received
    const [newDoc, nextState] = receiveSyncMessage(doc, lastSync, msg);

    // Determine if we have a message to send
    const [theirState, replyMsg] = generateSyncMessage(newDoc, nextState);
    this._lastSyncs.set(peerId, theirState);

    if (replyMsg) {
      this.sendMsgTo(peerId, replyMsg);
    }

    // if the doc changed, notify other peers
    if (newDoc !== doc) {
      this.notify(newDoc, [peerId]);
    }

    return newDoc;
  }

  public notify<T>(doc: Doc<T>, exclude: string[] = []) {
    this._lastSyncs.forEach((lastSync, peerId) => {
      // Don't send messages for excluded peers
      if (exclude.includes(peerId)) return;

      const [theirNextState, replyMsg] = generateSyncMessage(doc, lastSync);
      this._lastSyncs.set(peerId, theirNextState);
      if (replyMsg) {
        this.sendMsgTo(peerId, replyMsg);
      }
    });
  }

  broadcast<T>(doc: Doc<T>) {
    const [, msg] = generateSyncMessage(doc, initSyncState());

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
