import { Agent, request } from 'undici';

/**
 * `proxy-reloader` is the only container with the docker socket, and it is
 * mounted read-only (section 21.6). The Engine API is used directly rather
 * than a docker CLI, so the runtime image needs nothing extra.
 */
export type ExecResult = { exitCode: number; output: string };

export function dockerAgent(socketPath = '/var/run/docker.sock'): Agent {
  return new Agent({ connect: { socketPath } });
}

/** Demultiplexes the 8-byte-framed stream the Engine returns for an exec. */
export function demultiplex(payload: Buffer): string {
  let offset = 0;
  const parts: string[] = [];
  while (offset + 8 <= payload.length) {
    const size = payload.readUInt32BE(offset + 4);
    parts.push(payload.subarray(offset + 8, offset + 8 + size).toString('utf8'));
    offset += 8 + size;
  }
  return parts.length > 0 ? parts.join('') : payload.toString('utf8');
}

export async function dockerExec(
  container: string,
  command: string[],
  agent: Agent,
): Promise<ExecResult> {
  const created = await request(`http://localhost/v1.44/containers/${container}/exec`, {
    method: 'POST',
    dispatcher: agent,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ AttachStdout: true, AttachStderr: true, Cmd: command }),
  });
  if (created.statusCode >= 300)
    throw new Error(`docker exec create failed: ${String(created.statusCode)}`);
  const { Id } = (await created.body.json()) as { Id: string };

  const started = await request(`http://localhost/v1.44/exec/${Id}/start`, {
    method: 'POST',
    dispatcher: agent,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ Detach: false, Tty: false }),
  });
  const output = demultiplex(Buffer.from(await started.body.arrayBuffer()));

  const inspected = await request(`http://localhost/v1.44/exec/${Id}/json`, { dispatcher: agent });
  const { ExitCode } = (await inspected.body.json()) as { ExitCode: number | null };
  return { exitCode: ExitCode ?? 1, output: output.trim() };
}
