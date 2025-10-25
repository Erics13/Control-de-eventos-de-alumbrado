
import { useEffect, useRef } from 'react';
import type { BroadcastMessage } from '../types';

const CHANNEL_NAME = 'luminaire_app_channel';

export const useBroadcastChannel = (onMessage: (message: BroadcastMessage) => void) => {
    const channelRef = useRef<BroadcastChannel | null>(null);

    useEffect(() => {
        // Ensure this only runs in the browser
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            channelRef.current = new BroadcastChannel(CHANNEL_NAME);

            const handleMessage = (event: MessageEvent<BroadcastMessage>) => {
                onMessage(event.data);
            };

            channelRef.current.addEventListener('message', handleMessage);

            return () => {
                if (channelRef.current) {
                    channelRef.current.removeEventListener('message', handleMessage);
                    channelRef.current.close();
                    channelRef.current = null;
                }
            };
        }
    }, [onMessage]);

    const postMessage = (message: BroadcastMessage) => {
        if (channelRef.current) {
            channelRef.current.postMessage(message);
        }
    };

    return { postMessage };
};
