const SERVICE = "tecnico-mail-mcp";

interface KeychainEntry {
  getPassword(): Promise<string | null>;
  setPassword(password: string): Promise<void>;
  deletePassword(): Promise<boolean>;
}

/** The keychain module is native and optional: the Desktop Extension bundle leaves it out. */
async function openEntry(id: string): Promise<KeychainEntry | null> {
  try {
    const { AsyncEntry } = await import("@napi-rs/keyring");
    return new AsyncEntry(SERVICE, id);
  } catch {
    return null;
  }
}

export async function readPassword(id: string): Promise<string | undefined> {
  try {
    return (await (await openEntry(id))?.getPassword()) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Returns false when this machine has no usable keychain. */
export async function storePassword(id: string, password: string): Promise<boolean> {
  try {
    const entry = await openEntry(id);
    if (!entry) return false;
    await entry.setPassword(password);
    return (await entry.getPassword()) === password;
  } catch {
    return false;
  }
}

export async function deletePassword(id: string): Promise<boolean> {
  try {
    return (await (await openEntry(id))?.deletePassword()) ?? false;
  } catch {
    return false;
  }
}
