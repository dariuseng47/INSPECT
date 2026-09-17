import { useRef, useEffect } from 'react';

import { getSocket } from 'src/utils/socket';

// ----------------------------------------------------------------------

// Subscribes to one Socket.io event for the lifetime of the component. Keeps the handler
// in a ref so callers can pass an inline arrow function without it re-subscribing the
// listener on every render (only `event` changing re-subscribes).
export function useSocketEvent(event, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const listener = (...args) => handlerRef.current(...args);

    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [event]);
}
