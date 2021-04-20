import { performance, PerformanceObserver } from 'perf_hooks';
import { Peer } from '../src';
import { BinarySyncMessage, change, from } from 'automerge';

setTimeout(() => {}, 1 << 30);

const n = 100;

const perfObserver = new PerformanceObserver(items => {
  items.getEntries().forEach(entry => {
    console.log(entry);
  });
});

perfObserver.observe({ entryTypes: ['measure'], buffered: true });

const START_MARKER = `start`;
const END_MARKER = `end`;

const msgCallbackGenerator = (
  ctx: {
    peer: Peer;
    doc: any;
  },
  onNewDoc: (doc: any) => any
) => (msg: BinarySyncMessage) => {
  setTimeout(() => {
    const maybeDoc = ctx.peer.applyMessage(msg, ctx.doc);
    if (maybeDoc) {
      onNewDoc(maybeDoc);
    }
  }, 0);
};

// Setup
const peerACtx: any = {
  peer: null,
  doc: from({ foo: 42 }),
};
const peerBCtx: any = {
  peer: null,
  doc: from({ bar: 'hi' }),
};

const peerA = new Peer(
  msgCallbackGenerator(peerBCtx, doc => {
    peerBCtx.doc = doc;
    if (doc.x === n) {
      performance.mark(END_MARKER);
      performance.measure(
        `1 peer inserting ${n} times`,
        START_MARKER,
        END_MARKER
      );
      console.log('DOC', doc);
    }
  })
);
const peerB = new Peer(
  msgCallbackGenerator(peerACtx, doc => (peerACtx.doc = doc))
);

peerACtx.peer = peerA;
peerBCtx.peer = peerB;

// Initial notification of peers
peerA.notify(peerACtx.doc);
peerB.notify(peerBCtx.doc);

// Peer A adds a change later

performance.mark(START_MARKER);
for (var i = 0; i <= n; i++) {
  peerACtx.doc = change(peerACtx.doc, (doc: any) => {
    doc.x = i;
  });

  peerA.notify(peerACtx.doc);
}
