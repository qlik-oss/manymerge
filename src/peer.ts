import {
  Doc,
  generateSyncMessage,
  receiveSyncMessage,
  BinarySyncMessage,
  SyncState,
  initSyncState,
} from 'automerge';
import { debounce } from './debounce';

/**
 * An Automerge Network protocol getting consensus
 * between two documents in different places.
 */
export class Peer {
  _sendMsg: (msg: BinarySyncMessage) => void;
  lastSync: SyncState = initSyncState();
  notify: (doc: Doc<any>) => void;

  constructor(sendMsg: (msg: BinarySyncMessage) => void) {
    this._sendMsg = sendMsg;
    this.notify = debounce(this._notify.bind(this), 0);
  }

  public applyMessage<T>(msg: BinarySyncMessage, doc: Doc<T>): Doc<T> {
    // Apply the message received
    const [newDoc, nextState] = receiveSyncMessage(doc, this.lastSync, msg);
    this.lastSync = nextState;
    this.notify(newDoc);
    return newDoc;
  }

  private _notify<T>(doc: Doc<T>) {
    const [theirNextSyncState, msg] = generateSyncMessage(doc, this.lastSync);

    // Optimistically update their next sync state
    this.lastSync = theirNextSyncState;
    if (msg) {
      this.sendMsg(msg);
    }
  }

  private sendMsg(msg: BinarySyncMessage) {
    this._sendMsg(msg);
  }
}
