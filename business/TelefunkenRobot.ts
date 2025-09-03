import { Util } from '@hawryschuk-common/util';
import { ServiceRobot, Terminal, Prompt } from '@hawryschuk-terminal-restapi';


export class TelefunkenRobot extends ServiceRobot {
    constructor(terminal: Terminal) { super(terminal); }
    async handlePrompts(prompts: Record<string, Prompt[]>): Promise<void> {
        const random = (name: string) => this.terminal.answer({ [name]: Util.randomElement(prompts[name][0]!.choices!.map(c => c.value)) });
        if (prompts.discard) await random('discard');
        if (prompts.meld) await this.terminal.answer({ meld: [[]] });
        if (prompts.buy) await this.terminal.answer({ buy: false });
    }
}
