import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** The same handlers the browser uses, so tests exercise the real contract. */
export const server = setupServer(...handlers);
