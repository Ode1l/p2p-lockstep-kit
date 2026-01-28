export type SignalType = 'REGISTER' | 'REGISTERED' | 'ERROR' | 'RELAY';

export type SignalMessage = {
  type: SignalType;
  from?: string;
  to?: string;
  payload?: SignalPayload;
};

export type SignalPayload = {
  id?: string;
  data?: unknown;
};
