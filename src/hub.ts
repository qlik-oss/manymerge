import {
  BinarySyncMessage,
  generateSyncMessage,
  receiveSyncMessage,
  Doc,
  SyncState,
  initSyncState,
} from 'automerge';
import { debounce } from './debounce';

/**
 * An Automerge Network protocol getting consensus
 * between two documents in different places.
 */
export class Hub {
  _broadcast: (msg: BinarySyncMessage) => void;
  _sendTo: (peerId: string, msg: BinarySyncMessage) => void;
  // map of last syncs from known peers
  _lastSyncs: Map<string, SyncState> = new Map();
  notify: (doc: Doc<any>) => void;

  constructor(
    // Send message to just one peerId
    sendMsgTo: (peerId: string, msg: BinarySyncMessage) => void,
    // Send to everyone
    broadcastMsg: (msg: BinarySyncMessage) => void
  ) {
    this._sendTo = sendMsgTo;
    this._broadcast = broadcastMsg;

    this.notify = debounce(this._notify.bind(this), 0);
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
    this._lastSyncs.set(peerId, nextState);
    // how to notify others ONLY on change? while still debouncing...
    // basically, need to notify the peer that messaged always.
    // but technically only need to notify everyone else if changes were received.
    // maybe this is a microoptimization though
    this.notify(newDoc);

    return newDoc;
  }

  private _notify<T>(doc: Doc<T>) {
    this._lastSyncs.forEach((lastSync, peerId) => {
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
