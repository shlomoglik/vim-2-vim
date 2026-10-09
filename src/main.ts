import { TerminalGame } from './TerminalGame.js';

let application: TerminalGame;
try { application = new TerminalGame(); }
catch (error) { console.error(`Could not read progress: ${String(error)}`); process.exit(1); }
application.start();
