import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { setInterval } from 'node:timers/promises';

const dockerBin = process.env.BEDROCK_DOCKER_BIN ||
  ['/usr/bin/docker', '/usr/local/bin/docker', '/opt/homebrew/bin/docker'].find(existsSync);

function docker(...args) {
  if (!dockerBin || !isAbsolute(dockerBin)) {
    throw new Error('Укажите абсолютный путь к Docker CLI в BEDROCK_DOCKER_BIN.');
  }
  return execFileSync(dockerBin, args, { encoding: 'utf8', timeout: 10_000 }).trim();
}

async function check() {
  const container = docker('ps', '-q',
    '--filter', 'label=com.docker.compose.project=block-maze-lab',
    '--filter', 'label=com.docker.compose.service=bedrock');
  if (!container) throw new Error('Контейнер стенда не запущен в выбранном Docker-контексте.');

  const ip = process.env.BEDROCK_BIND_IP || '127.0.0.1';
  const response = await fetch(`http://${ip}:19132/v1/join`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Запрос к серверу вернул HTTP ' + response.status);
  const info = await response.json();
  if (info.level !== 'MazeLab') throw new Error('На порту 19132 ответил другой мир.');
  console.log('Сервер Bedrock подтвердил доступность мира MazeLab.');

  // Use the container clock and only accept output from this invocation.
  const since = docker('exec', container, 'date', '-u', '+%Y-%m-%dT%H:%M:%S.%NZ');
  docker('exec', container, 'send-command', 'help maze:stop');
  docker('exec', container, 'send-command', 'maze:start small');
  for await (const deadline of setInterval(500, Date.now() + 10_000)) {
    const logs = docker('logs', '--since', since, container);
    if (logs.includes('/maze:stop') && logs.includes('Команду должен ввести игрок')) {
      console.log('Команда /maze:stop зарегистрирована. Обработчик /maze:start ответил консоли.');
      return;
    }
    if (Date.now() >= deadline) break;
  }
  throw new Error('Нет ответов обеих команд аддона. Проверьте журнал сервиса bedrock.');
}

try {
  await check();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
