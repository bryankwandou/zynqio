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
        subscribe: (_channelName: string) => ({
          bind: (_eventName: string, _callback: Function) => {},
          unbind: (_eventName?: string, _callback?: Function) => {},
          unbind_all: () => {},
        }),
        unsubscribe: (_channelName: string) => {},
      };
    }
  }
  return pusherClientInstance;
};
