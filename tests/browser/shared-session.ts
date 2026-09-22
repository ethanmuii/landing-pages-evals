import { withRenderSession, type RenderSession } from '../../src/browser/session.js';

export interface SharedSession {
  session: RenderSession;
  close: () => Promise<void>;
}

// withRenderSession only exposes its browser for the life of one callback, so a
// file that wants a single browser for all of its tests parks the callback on a
// promise and resolves it from afterAll.
export async function openSharedSession(): Promise<SharedSession> {
  let ready: (session: RenderSession) => void = () => {};
  let release: () => void = () => {};

  const opened = new Promise<RenderSession>((resolve) => {
    ready = resolve;
  });
  const closed = withRenderSession(async (session) => {
    ready(session);
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });

  const session = await Promise.race([
    opened,
    closed.then((): RenderSession => {
      throw new Error('The shared session ended before it opened.');
    }),
  ]);

  return {
    session,
    close: async () => {
      release();
      await closed;
    },
  };
}
