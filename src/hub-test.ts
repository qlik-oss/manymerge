import Automerge from 'automerge';
import { Peer } from './peer';
import { Hub } from './hub';

// hack to keep process running until we manually exit
setInterval(() => {}, 1 << 30);

const aToHubA = (msg: any) => {
  setTimeout(() => {
    const maybeDoc = hubA.applyMessage('A', msg, hubADoc);
    if (maybeDoc) {
      console.log('NEW HubDoc A', maybeDoc);
      hubADoc = maybeDoc;
    }
  }, 0);
};

const bToHubA = (msg: any) => {
  setTimeout(() => {
    const maybeDoc = hubA.applyMessage('B', msg, hubADoc);
    if (maybeDoc) {
      console.log('NEW HubDoc A', maybeDoc);
      hubADoc = maybeDoc;
    }
  }, 0);
};

const cToHubB = (msg: any) => {
  setTimeout(() => {
    const maybeDoc = hubB.applyMessage('C', msg, hubBDoc);
    if (maybeDoc) {
      console.log('NEW HubDoc B', maybeDoc);
      hubBDoc = maybeDoc;
    }
  }, 0);
};

const peerA = new Peer(aToHubA, 'A');
const peerB = new Peer(bToHubA, 'B');
const peerC = new Peer(cToHubB, 'C');
const hubA = new Hub(
  'HubA',
  (peerId, msg) => {
    setTimeout(() => {
      if (peerId === 'A') {
        const maybeDoc = peerA.applyMessage(msg, docA);
        if (maybeDoc) {
          console.log('NEW DOC A', maybeDoc);
          docA = maybeDoc;
        }
      } else if (peerId === 'B') {
        const maybeDoc = peerB.applyMessage(msg, docB);
        if (maybeDoc) {
          console.log('NEW DOC B', maybeDoc);
          docB = maybeDoc;
        }
      } else if (peerId === 'HubB') {
        const maybeDoc = hubB.applyMessage('HubA', msg, hubBDoc);
        if (maybeDoc) {
          console.log('NEW HubDoc B', maybeDoc);
          hubBDoc = maybeDoc;
        }
      }
    }, 0);
  },
  msg => {
    setTimeout(() => {
      const maybeDoc = hubB.applyMessage('HubA', msg, hubBDoc);
      if (maybeDoc) {
        console.log('NEW HubDoc B', maybeDoc);
        hubBDoc = maybeDoc;
      }
    }, 0);
  }
);
const hubB = new Hub(
  'HubB',
  (peerId, msg) => {
    setTimeout(() => {
      if (peerId === 'C') {
        const maybeDoc = peerC.applyMessage(msg, docC);
        if (maybeDoc) {
          console.log('NEW DOC C', maybeDoc);
          docC = maybeDoc;
        }
      } else if (peerId === 'HubA') {
        const maybeDoc = hubA.applyMessage('HubB', msg, hubADoc);
        if (maybeDoc) {
          console.log('NEW HubDoc A', maybeDoc);
          hubADoc = maybeDoc;
        }
      }
    }, 0);
  },
  msg => {
    setTimeout(() => {
      const maybeDoc = hubA.applyMessage('HubB', msg, hubADoc);
      if (maybeDoc) {
        console.log('NEW HubDoc A', maybeDoc);
        hubADoc = maybeDoc;
      }
    }, 0);
  }
);

let docA = Automerge.from({ foo: 42 });
let docB = Automerge.from({ bar: 'hi' });
let docC = Automerge.init();
let hubADoc = Automerge.init();
let hubBDoc = Automerge.init();

// Goal: try to create 2 documents and sync them using new protocol
peerA.notify(docA);
peerB.notify(docB);
peerC.notify(docC);
hubA.broadcast(hubADoc);
hubB.broadcast(hubBDoc);

setTimeout(() => {
  docA = Automerge.change(docA, (doc: any) => {
    doc.baz = false;
  });
  peerA.notify(docA);
}, 1000);

setTimeout(() => {
  docB = Automerge.change(docB, (doc: any) => {
    doc.yo = 'abc';
  });
  peerB.notify(docB);
}, 2000);
