import {
  Doc,
  generateSyncMessage,
  receiveSyncMessage,
  BinarySyncMessage,
  // Backend,
  // decodeChange,
} from 'automerge';

/**
 * An Automerge Network protocol getting consensus
 * between two documents in different places.
 */
export class Peer {
  _sendMsg: (msg: BinarySyncMessage) => void;
  // lastSync should be the known heads from the last sync
  lastSync: any = undefined;
  lastSyncMsg: BinarySyncMessage | undefined = undefined;
  peerId: string;

  constructor(sendMsg: (msg: BinarySyncMessage) => void, peerId: string) {
    this._sendMsg = sendMsg;
    this.peerId = peerId;
  }

  public applyMessage<T>(
    msg: BinarySyncMessage,
    doc: Doc<T>
  ): Doc<T> | undefined {
    let nextDoc;

    // Apply the message received
    const [nextState, newDoc] = receiveSyncMessage(this.lastSync, doc, msg);

    // Save the nextState for peer
    this.lastSync = nextState;

    // Determine if we have a message to send
    const [theirNextSyncState, replyMsg] = generateSyncMessage(
      this.lastSync,
      newDoc
    );

    if (replyMsg) {
      this.sendMsg(replyMsg);
      // optimisticly update their next sync state
      this.lastSync = theirNextSyncState;
    }

    // If the doc changes, return it
    if (newDoc !== doc) {
      nextDoc = newDoc;
      // const msgReceived = Backend.decodeSyncMessage(msg);
      // const changes = msgReceived.changes.map(decodeChange);
      // if (this.peerId === 'B') {
      //   console.log('MSG RECEIVED BY B', {
      //     ...msgReceived,
      //     changes,
      //   });
      // }
    }
    // return newDoc;
    return nextDoc;
  }

  public notify<T>(doc: Doc<T>) {
    const [theirNextSyncState, msg] = generateSyncMessage(this.lastSync, doc);

    // optimistic update their sync state?
    this.lastSync = theirNextSyncState;
    if (msg) {
      this.sendMsg(msg);
    }
  }

  // private, previously was updating clock
  private sendMsg(msg: BinarySyncMessage) {
    // getting some unnecessary messages, this didn't help...
    // if (this.lastSyncMsg && equalBytes(msg, this.lastSyncMsg)) return;
    this._sendMsg(msg);
    this.lastSyncMsg = msg;
  }
}

// function equalBytes(array1: any, array2: any) {
//   if (!(array1 instanceof Uint8Array) || !(array2 instanceof Uint8Array)) {
//     throw new TypeError('equalBytes can only compare Uint8Arrays');
//   }
//   if (array1.byteLength !== array2.byteLength) return false;
//   for (let i = 0; i < array1.byteLength; i++) {
//     if (array1[i] !== array2[i]) return false;
//   }
//   return true;
// }
