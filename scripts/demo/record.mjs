// Records real MCP tool calls against a Dovecot server seeded with fictional mail, and saves them to
// docs/assets/demo-transcript.json. Nothing here touches a real mailbox. Needs Docker and a build:
// npm run build && node scripts/demo/record.mjs && node scripts/demo/render.mjs
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ImapFlow } from "imapflow";
import { generate } from "selfsigned";

const PASSWORD = "demo-password";
const ID = "ist1000001";
const QUESTION = "What did my professors send me this week?";
const today = new Date("2026-11-05T18:00:00Z");
const daysAgo = (n) => new Date(today.getTime() - n * 86_400_000);

const MAIL = [
  [
    20,
    "Prof.ª Marta Exemplo <marta.exemplo@tecnico.example>",
    "Sistemas Distribuídos: enunciado do projeto",
    "O enunciado do projeto já está disponível na página da cadeira.",
  ],
  [
    3,
    "Prof.ª Marta Exemplo <marta.exemplo@tecnico.example>",
    "Sistemas Distribuídos: entrega adiada",
    "A entrega do projeto passa para dia 20 de novembro, às 23h59. A discussão mantém-se na semana seguinte.",
  ],
  [
    2,
    "Prof. Rui Demonstração <rui.demonstracao@tecnico.example>",
    "Análise Matemática: sala do teste",
    "O teste de sexta-feira, dia 6, é na sala de exames do Pavilhão de Civil, às 18h. Tragam identificação.",
  ],
  [
    2,
    "Núcleo de Estudantes <geral@nucleo.example>",
    "Jantar de curso",
    "As inscrições para o jantar de curso estão abertas até domingo.",
  ],
  [
    1,
    "Prof.ª Inês Fictícia <ines.ficticia@tecnico.example>",
    "Bases de Dados: notas do primeiro mini-teste",
    "As notas estão no Fénix. Quem quiser ver a prova pode passar pelo gabinete na quarta-feira, das 14h às 16h.",
  ],
  [
    0,
    "Serviço de Exemplo <noreply@servico.example>",
    "Manutenção da rede",
    "A rede vai estar indisponível no sábado de manhã.",
  ],
];

const dir = mkdtempSync(join(tmpdir(), "tecnico-demo-"));
const { cert, private: key } = await generate([{ name: "commonName", value: "localhost" }], {
  keySize: 2048,
  extensions: [
    { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }] },
    { name: "basicConstraints", cA: true },
  ],
});
for (const [name, content] of [
  ["tls.crt", cert],
  ["tls.key", key],
]) {
  writeFileSync(join(dir, name), content);
  chmodSync(join(dir, name), 0o644);
}
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8" }).trim();
const container = docker(
  "run",
  "-d",
  "--rm",
  "-e",
  `USER_PASSWORD=${PASSWORD}`,
  "-p",
  "127.0.0.1::31993",
  "-v",
  `${join(dir, "tls.crt")}:/etc/dovecot/ssl/tls.crt:ro`,
  "-v",
  `${join(dir, "tls.key")}:/etc/dovecot/ssl/tls.key:ro`,
  "dovecot/dovecot:2.4.1",
);
try {
  const mapped = docker("port", container, "31993/tcp").split("\n")[0];
  const port = Number(mapped.slice(mapped.lastIndexOf(":") + 1));
  const imap = new ImapFlow({
    host: "localhost",
    port,
    secure: true,
    logger: false,
    auth: { user: ID, pass: PASSWORD },
    tls: { ca: cert },
  });
  for (let i = 0; ; i++) {
    try {
      await imap.connect();
      break;
    } catch (error) {
      if (i > 30) throw error;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  for (const [age, from, subject, body] of MAIL) {
    const date = daysAgo(age);
    const raw = `From: ${from}\r\nTo: Ana Silva <ana.silva@tecnico.example>\r\nSubject: ${subject}\r\nDate: ${date.toUTCString()}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n`;
    await imap.append("INBOX", raw, [], date);
  }
  await imap.logout();

  const client = new Client({ name: "demo", version: "1" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve("dist/index.js")],
      stderr: "ignore",
      env: {
        PATH: process.env.PATH,
        NODE_EXTRA_CA_CERTS: join(dir, "tls.crt"),
        XDG_CONFIG_HOME: dir,
        TECNICO_ID: ID,
        TECNICO_EMAIL: "ana.silva@tecnico.example",
        TECNICO_NAME: "Ana Silva",
        TECNICO_PASSWORD: PASSWORD,
        TECNICO_IMAP_HOST: "localhost",
        TECNICO_IMAP_PORT: String(port),
      },
    }),
  );
  const call = async (tool, input) => {
    const result = await client.callTool({ name: tool, arguments: input });
    return { tool, input, result: JSON.parse(result.content[0].text) };
  };
  const search = await call("search_messages", { from: "tecnico.example", since: "2026-10-30" });
  const first = search.result.messages.find((m) => m.subject.includes("entrega"));
  const steps = [
    search,
    await call("get_message", { uid: first.uid }),
    await call("create_draft", {
      body: "Obrigada pelo aviso, professora.",
      reply_to: { folder: "INBOX", uid: first.uid, reply_all: false, quote: false },
    }),
  ];
  await client.close();
  writeFileSync(
    "docs/assets/demo-transcript.json",
    `${JSON.stringify({ question: QUESTION, steps }, null, 2)}\n`,
  );
} finally {
  docker("rm", "-f", container);
}
