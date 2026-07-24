import { decodeSafe } from '../serialization';

export type SessionMessageType =
  | 'READY'
  | 'START'
  | 'MOVE'
  | 'UNDO'
  | 'RESTART'
  | 'REQUEST'
  | 'RESIGN'
  | 'APPROVE'
  | 'REJECT'
  | 'SYNC_REQUEST'
  | 'SYNC_STATE'
  | 'OFFLINE'
  | 'ONLINE'
  | 'GAME_OVER';

export type SessionMessage = {
  type: SessionMessageType;
  from?: string;
  seq?: number;
  sid?: string;
  turn?: number;
  stateHash?: string;
  payload?: any;
};

export const parseSessionMessage = (
  data: unknown,
): (Partial<SessionMessage> & { type?: string }) | null => {
  if (typeof data !== 'string') {
    if (!data || typeof data !== 'object') {
      return null;
    }
    return data as Partial<SessionMessage> & { type?: string };
  }

  const decoded = decodeSafe<Partial<SessionMessage> & { type?: string }>(
    data,
  );
  if (!decoded.ok || !decoded.value || typeof decoded.value !== 'object') {
    return null;
  }

  return decoded.value;
};
