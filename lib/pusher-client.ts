import PusherClient from 'pusher-js';

let pusherClientInstance: PusherClient | any = null;

const hasPusherKeys = process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_KEY !== 'your_pusher_key';

export const getPusherClient = () => {
  if (!pusherClientInstance) {
    if (hasPusherKeys) {
      pusherClientInstance = new PusherClient(
        process.env.NEXT_PUBLIC_PUSHER_KEY || '',
        {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap1',
        }
      );
    } else {
      // Mock client for zero-config fallback
      pusherClientInstance = {
        subscribe: (channelName: string) => ({
          bind: (eventName: string, callback: Function) => {
            console.log(`[PusherClient Mock] Bound to event '${eventName}' on channel '${channelName}'`);
            // In a real local mock, we might use setInterval here to poll the server
          },
          unbind: () => {},
        }),
        unsubscribe: () => {},
      };
    }
  }
  return pusherClientInstance;
};
