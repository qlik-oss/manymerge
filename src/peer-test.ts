import Automerge from 'automerge';
import { Subject, interval } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Peer } from './peer';

const docAInput = new Subject();
const docBInput = new Subject();

interval(1000).subscribe(() => {
  // console.log("isStopped?", docAInput.isStopped);
  // console.log("closed", docAInput.closed);
});

const sendToA = (v: any) => docAInput.next(v);
const sendToB = (v: any) => docBInput.next(v);

const docAReceived = docAInput.pipe(delay(0));
const docBReceived = docBInput.pipe(delay(0));

const peerA = new Peer(sendToB);
const peerB = new Peer(sendToA);

let docA = Automerge.from({ foo: 42 });
let docB = Automerge.from({ bar: 'hi' });

docAReceived.subscribe(
  msg => {
    const maybeDoc = peerA.applyMessage(msg as any, docA);
    if (maybeDoc) {
      docA = maybeDoc;
      console.log('NEW DOC A', docA);
    }
  },
  error => {
    console.log('ERROR', error);
  },
  () => {
    console.log('COMPLETE');
  }
);

docBReceived.subscribe((msg: any) => {
  const maybeDoc = peerB.applyMessage(msg, docB);
  if (maybeDoc) {
    docB = maybeDoc;
    console.log('NEW DOC B', docB);
  }
});

// Goal: try to create 2 documents and sync them using new protocol

peerA.notify(docA);
peerB.notify(docB);

setTimeout(() => {
  docA = Automerge.change(docA, (doc: any) => {
    doc.baz = false;
  });
  peerA.notify(docA);
}, 1000);
