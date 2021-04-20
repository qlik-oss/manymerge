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

  // public applyMessageBuffered<T>(
  //   msgs: { peerId: string; msg: BinarySyncMessage }[],
  //   doc: Doc<T>
  // ): Doc<T> | undefined {
  //   let nextDoc: Doc<T> | undefined;

  //   // console.log('APPLY MESSAGES BUFFERED', msgs);

  //   // Merge all the changes.
  //   const decodedMsgs = msgs.map(msg => ({
  //     ...msg,
  //     msg: Backend.decodeSyncMessage(msg.msg),
  //   }));
  //   console.log('DECODED MSGS', decodedMsgs);
  //   let combinedChanges: Uint8Array[] = [];
  //   decodedMsgs.forEach(msg => {
  //     combinedChanges.concat(msg.msg.changes);
  //   });

  //   // X - Store beforeHeads of original doc;

  //   const backend = Frontend.getBackendState(doc);

  //   console.log('COMBINED CHANGES', combinedChanges);

  //   // Apply them to the doc at the same time.
  //   if (combinedChanges.length > 0) {
  //     const [, patch] = Backend.applyChanges(
  //       backend,
  //       combinedChanges as BinaryChange[]
  //     );

  //     console.log('patch', patch);

  //     // Store that new doc
  //     if (patch) {
  //       console.log('PATCH', patch);
  //       nextDoc = Frontend.applyPatch(doc, patch);
  //     }
  //   }

  //   // Then, get last message from each peer and see if we have anything to send them
  //   // Do this by just removing changes from that last message? Do we need "beforeHeads"?
  //   const lastMessagesFromPeers: Record<string, SyncMessage> = {};
  //   decodedMsgs.forEach(msg => {
  //     lastMessagesFromPeers[msg.peerId] = {
  //       ...msg.msg,
  //       changes: [],
  //     };
  //   });

  //   console.log('lastMessagesFromPeers', lastMessagesFromPeers);

  //   Object.entries(lastMessagesFromPeers).forEach(([peerId, msg]) => {
  //     // Initialize empty sync state for new peer
  //     if (!this._lastSyncs.has(peerId)) {
  //       this._lastSyncs.set(peerId, initSyncState());
  //     }

  //     // Get latest sync state
  //     const lastSync = this._lastSyncs.get(peerId) as SyncState;
  //     const [anotherNewDoc, nextState] = receiveSyncMessage(
  //       nextDoc ?? doc,
  //       lastSync,
  //       Backend.encodeSyncMessage(msg)
  //     );

  //     nextDoc = anotherNewDoc;

  //     // Save the nextState for peer
  //     this._lastSyncs.set(peerId, nextState);

  //     // Determine if we have a message to send
  //     const [theirState, replyMsg] = generateSyncMessage(doc, nextState);

  //     if (replyMsg) {
  //       this.sendMsgTo(peerId, replyMsg);
  //       this._lastSyncs.set(peerId, theirState);
  //     }
  //   });

  //   if (nextDoc) {
  //     console.log('NEXT DOC', nextDoc);
  //     this.notify(nextDoc);
  //     // this.notify(nextDoc, Object.keys(lastMessagesFromPeers));
  //   }

  //   return nextDoc;
  // }

  public applyMessage<T>(
    peerId: string,
    msg: BinarySyncMessage,
    doc: Doc<T>
  ): Doc<T> | undefined {
    let nextDoc;

    // Initialize empty sync state for new peer
    if (!this._lastSyncs.has(peerId)) {
      this._lastSyncs.set(peerId, initSyncState());
    }

    // Get latest sync state
    const lastSync = this._lastSyncs.get(peerId) as SyncState;

    // Apply the message received
    const [newDoc, nextState] = receiveSyncMessage(doc, lastSync, msg);

    // Save the nextState for peer
    this._lastSyncs.set(peerId, nextState);

    // Determine if we have a message to send
    const [theirState, replyMsg] = generateSyncMessage(newDoc, nextState);

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

      const [theirNextState, replyMsg] = generateSyncMessage(doc, lastSync);
      if (replyMsg) {
        this.sendMsgTo(peerId, replyMsg);
        this._lastSyncs.set(peerId, theirNextState);
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
