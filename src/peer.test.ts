import { change, init, Backend, BinarySyncMessage, from } from 'automerge';
import waitForExpect from 'wait-for-expect';
import { Peer } from './peer';

test('peers send and receive changes', () => {
  const clientSendMsg = jest.fn();
  const client = new Peer(clientSendMsg);

  // send an update
  client.notify(
    change(init<any>(), doc => {
      doc.name = 'my-doc';
    })
  );

  // We just sent this message
  const [clientMsg] = clientSendMsg.mock.calls[0];
  const decodedMsg = Backend.decodeSyncMessage(clientMsg);
  expect(decodedMsg.heads.length).toBe(1);

  // We'll pretend to be a server
  // that received this message
  const serverSendMsg = jest.fn();
  const server = new Peer(serverSendMsg);
  server.applyMessage(clientMsg, init());

  // Server should send a message back
  const [serverMsg] = clientSendMsg.mock.calls[0];
  const decodedServerMsg = Backend.decodeSyncMessage(serverMsg);
  expect(decodedServerMsg.heads.length).toBe(1);
});

test('peers send and receive messages until they are in sync', async () => {
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
    msgCallbackGenerator(peerBCtx, doc => (peerBCtx.doc = doc))
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
  setTimeout(() => {
    peerACtx.doc = change(peerACtx.doc, (doc: any) => {
      doc.baz = true;
    });

    peerA.notify(peerACtx.doc);
  }, 250);

  // Verify that eventually, both peers are in sync
  await waitForExpect(() => {
    const docA = peerACtx.doc;
    const docB = peerBCtx.doc;
    expect(docA.foo).toEqual(42);
    expect(docA.bar).toEqual('hi');
    expect(docA.baz).toEqual(true);
    expect(docB.foo).toEqual(42);
    expect(docB.bar).toEqual('hi');
    expect(docB.baz).toEqual(true);
  });
});

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
