import Pusher from 'pusher';

const hasPusherKeys = process.env.PUSHER_APP_ID && process.env.PUSHER_APP_ID !== 'your_pusher_app_id';

/**
 * Server-side Pusher instance.
 * Used in API routes to trigger events.
 */
export const pusherServer = hasPusherKeys
  ? new Pusher({
      appId: process.env.PUSHER_APP_ID || '',
      key: process.env.PUSHER_KEY || '',
      secret: process.env.PUSHER_SECRET || '',
      cluster: process.env.PUSHER_CLUSTER || 'ap1',
      useTLS: true,
    })
  : {
      // Mock implementation for zero-config fallback
      trigger: async (channel: string, event: string, data: any) => {
        console.log(`[Pusher Mock] Event '${event}' triggered on channel '${channel}' with data:`, data);
        // Note: For a fully functioning zero-config realtime experience locally,
        // we would need a local SSE broker. For this MVP fallback, we rely on client polling 
        // if this mock is hit.
      }
    } as unknown as Pusher;
