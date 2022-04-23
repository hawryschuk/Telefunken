#!/usr/bin/env ts-node
import { Game as TelefunkenGame } from './Game';
import { ConsoleTerminal } from '@hawryschuk/terminals/ConsoleTerminal';
const terminal = new ConsoleTerminal;
new TelefunkenGame({ terminals: [terminal] }).run();

// import { axiosHttpClient } from '@hawryschuk/terminals/axiosHttpClient';
// import { TerminalRestApiClient } from '@hawryschuk/terminals';
// const baseuri = 'https://96fh0ga37c.execute-api.us-east-1.amazonaws.com/prod'; // 'http://localhost:8001'
// const wsuri = 'wss://85gcm8kafj.execute-api.us-east-1.amazonaws.com/production'; // 'ws://localhost:8001'
// TerminalRestApiClient.httpClient = axiosHttpClient(baseuri);
// Game.run({ terminal, wsuri, baseuri });

