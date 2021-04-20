import { performance, PerformanceObserver } from 'perf_hooks';
import { Hub, Peer } from '../src';
import { BinarySyncMessage, change, Doc, init, from } from 'automerge';

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

const onDocChange = (docId: string, doc: any) => {
  if (docId === 'peerB') {
    if (doc.x === n) {
      performance.mark(END_MARKER);
      performance.measure(
        `1 peer inserting ${n} times`,
        START_MARKER,
        END_MARKER
      );
      console.log('DOC', doc);
    }
  }
};

const peerMsgCallBackGenerator = (
  nodeById: any,
  nodeDocById: any,
  target: string,
  myId: string
) => (msg: BinarySyncMessage) => {
  setTimeout(() => {
    const targetNode = nodeById[target];
    let maybeDoc;
    if (targetNode.type === 'hub') {
      maybeDoc = targetNode.node.applyMessage(myId, msg, nodeDocById[target]);
    } else {
      maybeDoc = targetNode.node.applyMessage(msg, nodeDocById[target]);
    }

    if (maybeDoc) {
      nodeDocById[target] = maybeDoc;
      onDocChange(target, maybeDoc);
    }
  }, 0);
};

const hubSendToGenerator = (nodeById: any, nodeDocById: any, myId: string) => (
  peerId: string,
  msg: BinarySyncMessage
) => {
  setTimeout(() => {
    const targetNode = nodeById[peerId];
    let maybeDoc;
    if (targetNode.type === 'hub') {
      maybeDoc = targetNode.node.applyMessage(myId, msg, nodeDocById[peerId]);
    } else {
      maybeDoc = targetNode.node.applyMessage(msg, nodeDocById[peerId]);
    }

    if (maybeDoc) {
      nodeDocById[peerId] = maybeDoc;
      onDocChange(peerId, maybeDoc);
    }
  }, 0);
};

const hubBroadcastGenerator = (
  nodeById: any,
  nodeDocById: any,
  myId: string
) => (msg: BinarySyncMessage) => {
  setTimeout(() => {
    const broadcastTargets = Object.entries(nodeById).filter(
      ([key, value]: [string, any]) => value.type === 'hub' && myId !== key
    );
    broadcastTargets.forEach(([target]) => {
      const maybeDoc = nodeById[target].node.applyMessage(
        myId,
        msg,
        nodeDocById[target]
      );
      if (maybeDoc) {
        nodeDocById[target] = maybeDoc;
        onDocChange(target, maybeDoc);
      }
    });
  }, 0);
};

const nodeById: {
  [id: string]: {
    type: 'peer' | 'hub';
    node: any;
  };
} = {};
const nodeDocById: { [id: string]: Doc<any> } = {
  peerA: from({ foo: 42 }),
  peerB: from({ bar: 'hi' }),
  hubA: init(),
};

// Start with 1 hub and 2 peers
nodeById.peerA = {
  node: new Peer(
    peerMsgCallBackGenerator(nodeById, nodeDocById, 'hubA', 'peerA')
  ),
  type: 'peer',
};
nodeById.peerB = {
  node: new Peer(
    peerMsgCallBackGenerator(nodeById, nodeDocById, 'hubA', 'peerB')
  ),
  type: 'peer',
};
nodeById.hubA = {
  node: new Hub(
    hubSendToGenerator(nodeById, nodeDocById, 'hubA'),
    hubBroadcastGenerator(nodeById, nodeDocById, 'hubA')
  ),
  type: 'hub',
};

nodeById.peerA.node.notify(nodeDocById.peerA);
nodeById.peerB.node.notify(nodeDocById.peerB);
nodeById.hubA.node.broadcast(nodeDocById.hubA);

performance.mark(START_MARKER);
for (var i = 0; i <= n; i++) {
  nodeDocById.peerA = change(nodeDocById.peerA, doc => {
    doc.x = i;
  });
  nodeById.peerA.node.notify(nodeDocById.peerA);
}
