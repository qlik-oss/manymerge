import {
  // applyChanges,
  BinarySyncMessage,
  generateSyncMessage,
  receiveSyncMessage,
  // Change,
  Doc,
  // getChanges,
  // Backend,
  SyncState,
  // decodeChange,
} from 'automerge';

/**
 * An Automerge Network protocol getting consensus
 * between two documents in different places.
 */
export class Hub {
  hubId: string;
  _broadcast: (msg: BinarySyncMessage) => void;
  _sendTo: (peerId: string, msg: BinarySyncMessage) => void;
  _ourHead = undefined;
  // map of last syncs from known peers
  _lastSyncs = new Map();
  // map of received changes from known peers. DONT THINK WE NEED THIS ANYMORE
  // _receivedChanges = new Map();
  // map of lastSyncMesssages from known peers
  _lastSyncMsg = new Map();
  _sentChanges = new Map();
  // try out not requesting same changes from multiple nodes...will need a way to clear this eventually? in case peer never comes through
  have = [];

  constructor(
    hubId: string,
    // Send message to just one peerId
    sendMsgTo: (peerId: string, msg: BinarySyncMessage) => void,
    // Send to everyone
    broadcastMsg: (msg: BinarySyncMessage) => void
  ) {
    this.hubId = hubId;
    this._sendTo = sendMsgTo;
    this._broadcast = broadcastMsg;
  }

  // public applyMessageBuffered<T>(
  //   msgs: { peerId: string; msg: Message }[],
  //   doc: Doc<T>
  // ): Doc<T> | undefined {
  //   // Keep a list of the peer clocks in this message buffer
  //   const peerClocks = new Map<string, Clock>();
  //   // A merge of all changes in the buffer
  //   let combinedChanges: Change[] = [];

  //   // Pull out all the clocks and merge all the changes
  //   for (var i = 0; i < msgs.length; i++) {
  //     const call = msgs[i];
  //     // Convert clock to Immutable Map in case its been serialized
  //     const msgClock = fromJS(call.msg.clock);
  //     peerClocks.set(call.peerId, msgClock);
  //     this._theirClocks = this._theirClocks.set(call.peerId, msgClock);
  //     combinedChanges = combinedChanges.concat(call.msg.changes ?? []);
  //   }

  //   let ourDoc = doc;

  //   // Keep track of whether we've broadcast our clock or not
  //   let hasBroadcastClock = false;

  //   // 1. If we received changes, try to apply them
  //   if (combinedChanges.length > 0) {
  //     // We apply changes locally and update our clock before broadcasting.
  //     // This way, in case the broadcast causes new messages to be delivered to us
  //     // synchronously, our clock is uptodate.
  //     ourDoc = applyChanges(doc, combinedChanges);
  //     // Determine the net new changes for the hub's doc based on the incoming message
  //     const newChanges = getChanges(doc, ourDoc);
  //     this._ourClock = getClock(ourDoc);
  //     // We broadcast FIRST for the other members of the hub
  //     // Since we'll assume these changes should be applied to everyone.
  //     // We only broadcast any changes that are new to this hub
  //     if (newChanges.length > 0) {
  //       this.broadcastMsg({
  //         clock: getClock(ourDoc),

  //         // We make the assumption that if someone's sent the hub
  //         // changes, they likely want those changes to be sent to
  //         // everyone else.
  //         changes: newChanges,
  //       });
  //       hasBroadcastClock = true;
  //     }
  //   }

  //   // 2. If we have any changes to let them know about,
  //   // we should send it to them.
  //   // Also loop through to see if we have any peers with earlier clocks
  //   let hasDetectedPeerWithEarlierClock = false;
  //   peerClocks.forEach((peerClock, peerId) => {
  //     const ourChanges = recentChanges(ourDoc, peerClock!);
  //     if (ourChanges.length > 0) {
  //       this.sendMsgTo(peerId!, {
  //         clock: getClock(ourDoc),
  //         changes: ourChanges,
  //       });
  //     } else if (
  //       later(peerClock!, this._ourClock) &&
  //       !hasDetectedPeerWithEarlierClock
  //     ) {
  //       hasDetectedPeerWithEarlierClock = true;
  //     }
  //   });

  //   // 3. If their clock is later than our clock,
  //   // then we should let them know, which will prompt
  //   // them to send us changes via 2. listed above.
  //   // TO DO: does this need to be broadcast? Or just sent to individual peer as part of step 2?
  //   if (hasDetectedPeerWithEarlierClock && !hasBroadcastClock) {
  //     this.broadcastMsg({
  //       clock: this._ourClock,
  //     });
  //   }

  //   // Finally, we we made changes, we should return the
  //   // doc to be cached. Otherwise return nothing.
  //   if (combinedChanges.length > 0) {
  //     return ourDoc;
  //   }
  //   return;
  // }

  public applyMessage<T>(
    peerId: string,
    msg: BinarySyncMessage,
    doc: Doc<T>
  ): Doc<T> | undefined {
    let nextDoc;

    // initialize empty sync state for new peer
    if (!this._lastSyncs.has(peerId)) {
      this._lastSyncs.set(peerId, undefined);
    }
    const lastSync = this._lastSyncs.get(peerId);

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

    // return newDoc;
    return nextDoc;
  }

  public notify<T>(doc: Doc<T>, exclude: string[] = []) {
    this._lastSyncs.forEach((lastSync, peerId) => {
      if (exclude.includes(peerId)) return;
      const [theirNextState, replyMsg] = generateSyncMessage(lastSync, doc);
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
    // special logic like surpressing duplicates might go here...
    this._sendTo(peerId, msg);
  }

  private broadcastMsg(msg: BinarySyncMessage) {
    // send msg first
    this._broadcast(msg);

    // optimistic update sync states? I dont think so, we dont know whether changes were sent or not...
  }
}
