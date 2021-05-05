import {
  Doc,
  BinarySyncMessage,
  SyncState,
  initSyncState,
  Patch,
} from 'automerge';
import { debounce } from './debounce';

/**
 * An Automerge Network protocol getting consensus
 * between two documents in different places.
 */

type ReceiveSyncMessageAsync<T> = (
  doc: Doc<T>,
  syncState: SyncState,
  message: BinarySyncMessage
) => Promise<[Doc<T>, SyncState, Patch?]>;
type GenrateSyncMessageAsync<T> = (
  doc: Doc<T>,
  syncState: SyncState
) => Promise<[SyncState, BinarySyncMessage?]>;

export class AsyncPeer {
  _sendMsg: (msg: BinarySyncMessage) => void;
  lastSync: SyncState = initSyncState();
  notify: (doc: Doc<any>) => void;
  receiveSyncMessage: ReceiveSyncMessageAsync<any>;
  generateSyncMessage: GenrateSyncMessageAsync<any>;

  constructor(
    sendMsg: (msg: BinarySyncMessage) => void,
    options: {
      receiveSyncMessage: ReceiveSyncMessageAsync<any>;
      generateSyncMessage: GenrateSyncMessageAsync<any>;
    }
  ) {
    this._sendMsg = sendMsg;
    this.notify = debounce(this._notify.bind(this), 0);
    this.receiveSyncMessage = options.receiveSyncMessage;
    this.generateSyncMessage = options.generateSyncMessage;
  }

  public async applyMessage<T>(
    msg: BinarySyncMessage,
    doc: Doc<T>
  ): Promise<Doc<T>> {
    // Apply the message received
    const [newDoc, nextState] = await this.receiveSyncMessage(
      doc,
      this.lastSync,
      msg
    );
    this.lastSync = nextState;
    this.notify(newDoc);
    return newDoc;
  }

  private async _notify<T>(doc: Doc<T>) {
    const [theirNextSyncState, msg] = await this.generateSyncMessage(
      doc,
      this.lastSync
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
