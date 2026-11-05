import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate } from "selfsigned";
import type { TestProject } from "vitest/node";

const IMAGE = "dovecot/dovecot:2.4.1";
const PASSWORD = "integration-test-password";

// Folder names are Portuguese on purpose: detection must rely on SPECIAL-USE, not English names.
const DOVECOT_CONF = `
namespace inbox {
  mailbox Enviados {
    special_use = \\Sent
    auto = create
  }
  mailbox Rascunhos {
    special_use = \\Drafts
    auto = create
  }
  mailbox Lixo {
    special_use = \\Trash
    auto = create
  }
}
`;

function docker(...args: string[]): string {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

async function waitForPort(port: number): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (open) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Dovecot did not start. Is Docker running?");
}

declare module "vitest" {
  export interface ProvidedContext {
    imapPort: number;
    tlsCert: string;
    tlsKey: string;
    password: string;
  }
}

export default async function setup(project: TestProject): Promise<() => void> {
  const pems = await generate([{ name: "commonName", value: "localhost" }], {
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }] },
      { name: "basicConstraints", cA: true },
    ],
  });
  const dir = mkdtempSync(join(tmpdir(), "tecnico-dovecot-"));
  const files = { "tls.crt": pems.cert, "tls.key": pems.private, "test.conf": DOVECOT_CONF };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
    chmodSync(join(dir, name), 0o644);
  }
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
    "-v",
    `${join(dir, "test.conf")}:/etc/dovecot/conf.d/test.conf:ro`,
    IMAGE,
  );
  const mapped = docker("port", container, "31993/tcp").split("\n")[0] ?? "";
  const imapPort = Number(mapped.slice(mapped.lastIndexOf(":") + 1));
  await waitForPort(imapPort);

  project.provide("imapPort", imapPort);
  project.provide("tlsCert", pems.cert);
  project.provide("tlsKey", pems.private);
  project.provide("password", PASSWORD);

  return () => {
    docker("rm", "-f", container);
    rmSync(dir, { recursive: true, force: true });
  };
}
