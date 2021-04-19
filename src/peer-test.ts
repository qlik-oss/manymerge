import Automerge from 'automerge';
import { Peer } from './peer';

// hack to keep process running until we manually exit
setInterval(() => {}, 1 << 30);

const sendToA = (msg: any) => {
  setTimeout(() => {
    const maybeDoc = peerA.applyMessage(msg as any, docA);
    if (maybeDoc) {
      console.log('NEW DOC A', maybeDoc);
      docA = maybeDoc;
    }
  }, 0);
};

const sendToB = (msg: any) => {
  setTimeout(() => {
    const maybeDoc = peerB.applyMessage(msg, docB);
    if (maybeDoc) {
      docB = maybeDoc;
      console.log('NEW DOC B', docB);
    }
  }, 0);
};

const peerA = new Peer(sendToB, 'A');
const peerB = new Peer(sendToA, 'B');

let docA = Automerge.from({ foo: 42 });
let docB = Automerge.from({ bar: 'hi' });

// Goal: try to create 2 documents and sync them using new protocol
peerA.notify(docA);
peerB.notify(docB);

setTimeout(() => {
  docA = Automerge.change(docA, (doc: any) => {
    doc.baz = false;
  });
  peerA.notify(docA);
}, 1000);
