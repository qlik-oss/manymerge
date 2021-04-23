import {
  Doc,
  generateSyncMessage,
  receiveSyncMessage,
  BinarySyncMessage,
  SyncState,
  initSyncState,
} from 'automerge';

/**
 * An Automerge Network protocol getting consensus
 * between two documents in different places.
 */
export class Peer {
  _sendMsg: (msg: BinarySyncMessage) => void;
  lastSync: SyncState = initSyncState();

  constructor(sendMsg: (msg: BinarySyncMessage) => void) {
    this._sendMsg = sendMsg;
  }

  public applyMessage<T>(msg: BinarySyncMessage, doc: Doc<T>): Doc<T> {
    // Apply the message received
    const [newDoc, nextState] = receiveSyncMessage(doc, this.lastSync, msg);
    // Determine if we have a message to send
    const [theirNextSyncState, replyMsg] = generateSyncMessage(
      newDoc,
      nextState
    );

    // Save the nextState for peer
    this.lastSync = theirNextSyncState;

    if (replyMsg) {
      this.sendMsg(replyMsg);
    }

    return newDoc;
  }

  public notify<T>(doc: Doc<T>) {
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
