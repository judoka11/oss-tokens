// What the donor's machine can run. Repos tag tasks that only reproduce on
// some platforms (`ai-needs:windows`, `ai-needs:gpu`, ...) and those tasks
// only go to donors whose machine matches. Results say where they ran.
import { platform, arch, release } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const OS_NAMES = { win32: 'windows', darwin: 'macos', linux: 'linux' };
const OS_TAGS = ['windows', 'macos', 'linux'];
export const NEED_TAGS = [...OS_TAGS, 'gpu', 'cuda'];

export function basicMachine() {
  return { os: OS_NAMES[platform()] || platform(), arch: arch(), os_version: release(), gpu: null };
}

// Adds the GPU name when an NVIDIA driver is present. Other GPUs can be
// entered by hand in ~/.oss-tokens/config.json.
export async function detectMachine() {
  const machine = basicMachine();
  try {
    const { stdout } = await run('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], { timeout: 5000 });
    machine.gpu = stdout.split('\n')[0].trim() || null;
  } catch {
    // No NVIDIA driver; leave gpu empty.
  }
  return machine;
}

export function describeMachine(m) {
  return `${m.os} ${m.os_version} ${m.arch} · GPU: ${m.gpu || 'none detected'}`;
}

// OS tags are alternatives (windows or macos); gpu and cuda must all hold.
// Returns human-readable reasons the machine doesn't fit, empty if it does.
export function unmetNeeds(needs, machine) {
  const reasons = [];
  const osNeeds = needs.filter(n => OS_TAGS.includes(n));
  if (osNeeds.length && !osNeeds.includes(machine.os)) reasons.push(`needs ${osNeeds.join(' or ')}`);
  if (needs.includes('gpu') && !machine.gpu) reasons.push('needs a GPU');
  if (needs.includes('cuda') && !/nvidia/i.test(machine.gpu || '')) reasons.push('needs an NVIDIA GPU (CUDA)');
  return reasons;
}
