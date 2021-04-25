const { Peer, Hub } = require("../dist/index");
const { init, change } = require("automerge");
const { performance, PerformanceObserver } = require('perf_hooks');

let hub, peerA, peerB;
let hubDoc = init(), aDoc = init(), bDoc = init();

const n = 500;

const perfObserver = new PerformanceObserver(items => {
  items.getEntries().forEach(entry => {
    console.log(entry);
  });
});

perfObserver.observe({ entryTypes: ['measure'], buffered: true });

peerA = new Peer(msg => setTimeout(() => {
  hubDoc = hub.applyMessage("A", msg, hubDoc);
}, 0))

peerB = new Peer(msg => setTimeout(() => {
  hubDoc = hub.applyMessage("B", msg, hubDoc);
}, 0))

hub = new Hub((peerId, msg) => setTimeout(() => {
  if(peerId === "A") {
    aDoc = peerA.applyMessage(msg, aDoc);
  }
  if (peerId === "B") {
    bDoc = peerB.applyMessage(msg, bDoc);
    if(bDoc.i === n) {
      performance.mark("END");

      performance.measure(
        `1 peer inserting ${n} times`,
        "START",
        "END"
      );
      
    }
  }
}, () => {}, 0))

peerA.notify(aDoc);
peerB.notify(bDoc);
hub.notify(hubDoc);


performance.mark("START");
for (let i = 0; i<=n; i++) {
  aDoc = change(aDoc, doc => {
    doc.i = i
  });
  peerA.notify(aDoc);
}

