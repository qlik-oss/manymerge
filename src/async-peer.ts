import { Change, Doc, Patch } from 'automerge';
import { later, union } from 'automerge-clocks';
import { Map, fromJS } from 'immutable';
import { Message } from './types';

type Clock = Map<string, number>;
type ApplyChangesAsync<T> = (
  doc: Doc<T>,
  changes: Change[]
) => Promise<[Doc<T>, Patch]>;
type GetClockAsync = (doc: Doc<any>) => Promise<Clock>;
type RecentChangesAsync = (
  doc: Doc<any>,
  theirClock: Clock
) => Promise<Change[]>;

/**
 * An Automerge Network protocol getting consensus
 * between two documents in different places.
 */
export class AsyncPeer<T> {
  _theirClock: Map<string, number>;
  _sendMsg: (msg: Message) => void;
  _applyChanges: ApplyChangesAsync<T>;
  _getClock: GetClockAsync;
  _recentChanges: RecentChangesAsync;

  constructor(
    sendMsg: (msg: Message) => void,
    options: {
      applyChanges: ApplyChangesAsync<T>;
      getClock: GetClockAsync;
      recentChanges: RecentChangesAsync;
    }
  ) {
    this._theirClock = Map();
    this._sendMsg = sendMsg;
    this._applyChanges = options.applyChanges;
    this._getClock = options.getClock;
    this._recentChanges = options.recentChanges;
  }

  public async applyMessage(
    msg: Message,
    doc: Doc<T>
  ): Promise<[Doc<T> | undefined, Patch | undefined]> {
    let ourDoc = doc;
    let patch = undefined;

    // Convert msg clock to Immutable Map incase its been serialized
    const msgClock = fromJS(msg.clock);

    // 1. If they've sent us changes, we'll try to apply them.
    if (msg.changes) {
      [ourDoc, patch] = await this._applyChanges(doc, msg.changes);
    }

    // 2. If we have any changes to let them know about,
    // we should send it to them.
    const ourChanges = await this._recentChanges(doc, msgClock);
    const ourClock = await this._getClock(ourDoc);
    if (ourChanges.length > 0) {
      this.sendMsg({
        clock: ourClock,
        changes: ourChanges,
      });
    }

    // 3. If our clock is still earlier than their clock,
    // then we should let them know, which will prompt
    // them to send us changes via 2. listed above.

    if (later(msgClock, ourClock)) {
      this.sendMsg({
        clock: ourClock,
      });
    }

    if (msg.changes) {
      return [ourDoc, patch];
    }

    return [undefined, undefined];
  }

  public async notify<T>(doc: Doc<T>) {
    // 1. If we think that we have changes to share, we'll send them.
    const ourChanges = await this._recentChanges(doc, this._theirClock);
    const ourClock = await this._getClock(doc);
    if (ourChanges.length > 0) {
      this.sendMsg({
        clock: ourClock,
        changes: ourChanges,
      });
      return;
    }

    // 2. Otherwise, we just let them know where we're at.
    // If our copy of "theirClock" is wrong, they'll
    // update us via 3. in 'applyMessage'.
    this.sendMsg({
      clock: ourClock,
    });
  }

  private sendMsg(msg: Message) {
    // Whenever we send a message, we should optimistically
    // update theirClock with what we're about to send them.
    this._theirClock = union(this._theirClock, msg.clock);
    this._sendMsg(msg);
  }
}
