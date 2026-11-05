import { createInterface } from "node:readline/promises";

export interface Prompter {
  ask(question: string): Promise<string>;
  askHidden(question: string): Promise<string>;
}

async function readHiddenLine(question: string): Promise<string> {
  const { stdin, stderr } = process;
  stderr.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let text = "";
    const finish = (done: () => void) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stderr.write("\n");
      done();
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") return finish(() => reject(new Error("Cancelled.")));
        if (char === "\r" || char === "\n") return finish(() => resolve(text));
        if (char === "\u007f" || char === "\b") text = text.slice(0, -1);
        else text += char;
      }
    };
    stdin.on("data", onData);
  });
}

export const terminalPrompter: Prompter = {
  async ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
      return (await rl.question(question)).trim();
    } finally {
      rl.close();
    }
  },
  askHidden(question) {
    if (process.stdin.isTTY) return readHiddenLine(question);
    return this.ask(question);
  },
};
