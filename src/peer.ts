import {
  Doc,
  generateSyncMessage,
  receiveSyncMessage,
  BinarySyncMessage,
  SyncState,
} from 'automerge';

/**
 * An Automerge Network protocol getting consensus
 * between two documents in different places.
 */
export class Peer {
  _sendMsg: (msg: BinarySyncMessage) => void;
  lastSync: SyncState | undefined = undefined;

  constructor(sendMsg: (msg: BinarySyncMessage) => void) {
    this._sendMsg = sendMsg;
  }

  public applyMessage<T>(
    msg: BinarySyncMessage,
    doc: Doc<T>
  ): Doc<T> | undefined {
    let nextDoc;

    // Apply the message received
    const [nextState, newDoc] = receiveSyncMessage(
      this.lastSync as SyncState,
      doc,
      msg
    );

    // Save the nextState for peer
    this.lastSync = nextState;

    // Determine if we have a message to send
    const [theirNextSyncState, replyMsg] = generateSyncMessage(
      this.lastSync,
      newDoc
    );

    if (replyMsg) {
      this.sendMsg(replyMsg);
      // Optimisticly update their next sync state
      this.lastSync = theirNextSyncState;
    }

    // If the doc changes, return it
    if (newDoc !== doc) {
      nextDoc = newDoc;
    }

    return nextDoc;
  }

  public notify<T>(doc: Doc<T>) {
    const [theirNextSyncState, msg] = generateSyncMessage(
      this.lastSync as SyncState,
      doc
    );

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
