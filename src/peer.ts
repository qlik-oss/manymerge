import { Frontend, Doc } from 'automerge';
// import { getClock, later, recentChanges, union } from 'automerge-clocks';
// import { Map, fromJS } from 'immutable';
import { Message } from './types';

const FrontendT = Frontend as any;

/**
 * An Automerge Network protocol getting consensus
 * between two documents in different places.
 */
export class Peer {
  _sendMsg: (msg: Message) => void;
  // lastSync should be the known heads from the last sync
  lastSync: any = undefined;
  lastSyncMsg: Message | undefined = undefined;
  // We need to store changes until we have enough to apply (no missing dependencies)
  queuedChanges: any[] = [];
  // We need to keep track of changes we've sent so that we don't send duplicates
  // Open question: How do we clear this over time, as it could get stale or we could have changes that we thought we sent but didn't make it? a TTL?
  sentChanges: any[] = [];

  constructor(sendMsg: (msg: Message) => void) {
    this._sendMsg = sendMsg;
  }

  public applyMessage<T>(msg: Message, doc: Doc<T>): Doc<T> | undefined {
    let nextDoc;

    // Apply the message received
    const [newDoc, nextState] = FrontendT.receiveSyncMessage(
      doc,
      msg,
      this.lastSync
    );

    // Save the nextState for peer
    this.lastSync = nextState;

    // Determine if we have a message to send
    const [, replyMsg] = FrontendT.generateSyncMessage(newDoc, this.lastSync);

    if (replyMsg) {
      this.sendMsg(replyMsg);
    }

    nextDoc = newDoc;

    return nextDoc;
  }

  public notify<T>(doc: Doc<T>) {
    const [, msg] = FrontendT.generateSyncMessage(doc, this.lastSync);
    if (msg) {
      this.sendMsg(msg);
    }
  }

  // private, previously was updating clock
  private sendMsg(msg: Message) {
    // Suppress duplicate sync/change messages
    // if (msg.type === 'sync') {
    //   // If we already sent this message, don't send again
    //   const encodedPayload = Backend.encodeSyncMessage(msg.payload);
    //   if (this.lastSyncMsg && equalBytes(this.lastSyncMsg, encodedPayload))
    //     return;
    //   // Store last sync message sent
    //   this.lastSyncMsg = encodedPayload;
    // } else if (msg.type === 'change') {
    //   // Filter out any changes that you think you already sent
    //   const changesToSend = msg.payload.filter(
    //     change => !this.sentChanges.some(prior => equalBytes(change, prior))
    //   );
    //   // only send the unsent changes
    //   msg.payload = changesToSend;
    //   // update your state about what youve sent
    //   this.sentChanges = [...this.sentChanges, ...changesToSend];
    //   this.lastSyncMsg = undefined;
    // }
    this._sendMsg(msg);
  }
}
