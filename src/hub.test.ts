import { change, from, init, Doc, BinarySyncMessage } from 'automerge';
import waitForExpect from 'wait-for-expect';
import { Hub } from './hub';
import { Peer } from './peer';

test('Hubs and peers can sync', async () => {
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

  // Make a change on one of the peers
  setTimeout(() => {
    nodeDocById.peerA = change(nodeDocById.peerA, doc => {
      doc.baz = true;
    });
    nodeById.peerA.node.notify(nodeDocById.peerA);
  }, 250);

  // Add another hub and peer for that hub
  setTimeout(() => {
    nodeDocById.peerC = init();
    nodeDocById.hubB = init();
    nodeById.peerC = {
      node: new Peer(
        peerMsgCallBackGenerator(nodeById, nodeDocById, 'hubB', 'peerC')
      ),
      type: 'peer',
    };
    nodeById.hubB = {
      node: new Hub(
        hubSendToGenerator(nodeById, nodeDocById, 'hubB'),
        hubBroadcastGenerator(nodeById, nodeDocById, 'hubB')
      ),
      type: 'hub',
    };

    nodeById.peerC.node.notify(nodeDocById.peerC);
    nodeById.hubB.node.broadcast(nodeDocById.hubB);
  }, 500);

  // Make a change on the 3rd peer
  setTimeout(() => {
    nodeDocById.peerC = change(nodeDocById.peerC, doc => {
      doc.yo = 123;
    });
    nodeById.peerC.node.notify(nodeDocById.peerC);
  }, 750);

  // Confirm that all peers and hubs have the same state
  await waitForExpect(() => {
    const peerADoc = nodeDocById.peerA;
    const peerBDoc = nodeDocById.peerB;
    const peerCDoc = nodeDocById.peerC;
    const hubADoc = nodeDocById.hubA;
    const hubBDoc = nodeDocById.hubB;

    expect(peerADoc.foo).toEqual(42);
    expect(peerADoc.bar).toEqual('hi');
    expect(peerADoc.baz).toEqual(true);
    expect(peerADoc.yo).toEqual(123);

    expect(peerBDoc.foo).toEqual(42);
    expect(peerBDoc.bar).toEqual('hi');
    expect(peerBDoc.baz).toEqual(true);
    expect(peerBDoc.yo).toEqual(123);

    expect(peerCDoc.foo).toEqual(42);
    expect(peerCDoc.bar).toEqual('hi');
    expect(peerCDoc.baz).toEqual(true);
    expect(peerCDoc.yo).toEqual(123);

    expect(hubADoc.foo).toEqual(42);
    expect(hubADoc.bar).toEqual('hi');
    expect(hubADoc.baz).toEqual(true);
    expect(hubADoc.yo).toEqual(123);

    expect(hubBDoc.foo).toEqual(42);
    expect(hubBDoc.bar).toEqual('hi');
    expect(hubBDoc.baz).toEqual(true);
    expect(hubBDoc.yo).toEqual(123);
  });
});

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
      }
    });
  }, 0);
};
