#!/usr/bin/env ts-node
import { Game } from './Game';
import { ConsoleTerminal } from '../../@hawryschuk-terminal-restapi/ConsoleTerminal';
const terminal = new ConsoleTerminal;
new Game({ terminals: [terminal] }).run();

// import { axiosHttpClient } from '../../@hawryschuk-terminal-restapi/axiosHttpClient';
// import { TerminalRestApiClient } from '../../@hawryschuk-terminal-restapi/TerminalRestApiClient';
// const baseuri = 'https://96fh0ga37c.execute-api.us-east-1.amazonaws.com/prod'; // 'http://localhost:8001'
// const wsuri = 'wss://85gcm8kafj.execute-api.us-east-1.amazonaws.com/production'; // 'ws://localhost:8001'
// TerminalRestApiClient.httpClient = axiosHttpClient(baseuri);
// Game.run({ terminal, wsuri, baseuri });

