import { User } from './types';

/** Demo-only users until auth is wired to the API */
export const mockUsers: User[] = [
  { id: '1', username: 'admin', displayName: 'Admin User', role: 'admin' },
  { id: '2', username: 'donor', displayName: 'Mila Alvarez', role: 'donor' },
];
