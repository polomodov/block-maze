import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', timeout: 10_000 }).trim();
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
  console.log(`Bedrock ${info.version}, мир ${info.level}, игроков ${info.players} из ${info.maxPlayers}.`);

  // Use the container clock and only accept output from this invocation.
  const since = docker('exec', container, 'date', '-u', '+%Y-%m-%dT%H:%M:%S.%NZ');
  docker('exec', container, 'send-command', 'help maze:stop');
  docker('exec', container, 'send-command', 'maze:start small');
  for (let attempt = 0; attempt < 20; attempt++) {
    const logs = docker('logs', '--since', since, container);
    if (logs.includes('/maze:stop') && logs.includes('Команду должен ввести игрок')) {
      console.log('Команда /maze:stop зарегистрирована. Обработчик /maze:start ответил консоли.');
      return;
    }
    await delay(500);
  }
  throw new Error('Нет ответов обеих команд аддона. Проверьте журнал сервиса bedrock.');
}

check().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
