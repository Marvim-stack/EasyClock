import { spawn } from 'node:child_process';

// O kernel libera flock ao encerrar o helper. Se o processo principal morrer,
// o pipe de stdin fecha e o helper também encerra, inclusive após SIGKILL.
export async function acquireInstanceLock(path: string, onLost: () => void): Promise<() => Promise<void>> {
  const child = spawn('flock', ['--nonblock', '--no-fork', path, process.execPath, '-e',
    "process.stdin.resume(); process.stdout.write('locked\\n');"], { stdio: ['pipe', 'pipe', 'pipe'] });
  let releasing = false;
  let acquired = false;
  const ended = new Promise<void>(resolve => child.once('exit', () => {
    if (acquired && !releasing) onLost();
    resolve();
  }));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Tempo excedido ao obter a trava de instância.'));
    }, 5000);
    const fail = (message: string) => { clearTimeout(timer); reject(new Error(message)); };
    child.once('error', () => fail('Não foi possível executar flock. Instale util-linux.'));
    child.once('exit', () => { if (!acquired) fail('Outra instância está usando este diretório de dados ou a trava não pôde ser aberta.'); });
    child.stdout.once('data', () => { acquired = true; clearTimeout(timer); resolve(); });
    child.stdin.on('error', () => {});
    child.stderr.resume();
  });
  return async () => {
    releasing = true;
    child.stdin.end();
    await ended;
  };
}
