import Docker from 'dockerode';
import { WORKER_DEFAULTS } from '@saassy/shared';
import type { ResourceUsage } from '@saassy/shared';

export interface ContainerConfig {
  image: string;
  taskId: string;
  input: Record<string, unknown>;
  cpuLimit?: number;
  memoryLimit?: string;
  timeoutSeconds?: number;
  environment?: Record<string, string>;
}

export interface ContainerResult {
  containerId: string;
  exitCode: number;
  output: string;
  error?: string;
  resourceUsage: ResourceUsage;
}

export class DockerManager {
  private docker: Docker;
  private network: string;

  constructor() {
    this.docker = new Docker({
      socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock',
    });
    this.network = process.env.WORKER_NETWORK || WORKER_DEFAULTS.network;
  }

  async init() {
    // Verify Docker connection
    const info = await this.docker.info();
    console.log(`Connected to Docker: ${info.Name}`);

    // Ensure worker network exists
    await this.ensureNetwork();
  }

  private async ensureNetwork() {
    const networks = await this.docker.listNetworks({
      filters: { name: [this.network] },
    });

    if (networks.length === 0) {
      await this.docker.createNetwork({
        Name: this.network,
        Driver: 'bridge',
      });
      console.log(`Created network: ${this.network}`);
    }
  }

  async runContainer(config: ContainerConfig): Promise<ContainerResult> {
    const {
      image,
      taskId,
      input,
      cpuLimit = WORKER_DEFAULTS.cpuLimit,
      memoryLimit = WORKER_DEFAULTS.memoryLimit,
      timeoutSeconds = WORKER_DEFAULTS.timeoutSeconds,
      environment = {},
    } = config;

    const startTime = Date.now();

    // Pull image if not present
    await this.pullImageIfNeeded(image);

    // Create container
    const container = await this.docker.createContainer({
      Image: image,
      name: `saassy-task-${taskId}`,
      Env: [
        `TASK_ID=${taskId}`,
        `TASK_INPUT=${JSON.stringify(input)}`,
        ...Object.entries(environment).map(([k, v]) => `${k}=${v}`),
      ],
      HostConfig: {
        NetworkMode: this.network,
        Memory: this.parseMemoryLimit(memoryLimit),
        NanoCpus: cpuLimit * 1e9,
        AutoRemove: false, // We'll remove after getting logs
        ReadonlyRootfs: false, // Some workers need write access
      },
      Labels: {
        'saassy.task.id': taskId,
        'saassy.managed': 'true',
      },
    });

    const containerId = container.id;
    console.log(`Created container ${containerId} for task ${taskId}`);

    try {
      // Start container
      await container.start();

      // Wait for completion with timeout
      const result = await Promise.race([
        container.wait(),
        this.timeout(timeoutSeconds * 1000),
      ]);

      const endTime = Date.now();
      const durationSeconds = (endTime - startTime) / 1000;

      // Get logs
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        follow: false,
      });
      const output = logs.toString('utf8');

      // Get resource stats (simplified - in production use cAdvisor or similar)
      const resourceUsage: ResourceUsage = {
        cpuSeconds: durationSeconds * cpuLimit,
        memoryMbSeconds: durationSeconds * (this.parseMemoryLimit(memoryLimit) / 1024 / 1024),
        durationSeconds,
      };

      // Cleanup
      await container.remove({ force: true });

      if (result === 'timeout') {
        return {
          containerId,
          exitCode: -1,
          output,
          error: `Task timed out after ${timeoutSeconds} seconds`,
          resourceUsage,
        };
      }

      return {
        containerId,
        exitCode: result.StatusCode,
        output,
        error: result.StatusCode !== 0 ? `Exit code: ${result.StatusCode}` : undefined,
        resourceUsage,
      };
    } catch (error) {
      // Cleanup on error
      try {
        await container.remove({ force: true });
      } catch {
        // Ignore cleanup errors
      }

      const endTime = Date.now();
      const durationSeconds = (endTime - startTime) / 1000;

      return {
        containerId,
        exitCode: -1,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        resourceUsage: {
          cpuSeconds: durationSeconds * cpuLimit,
          memoryMbSeconds: 0,
          durationSeconds,
        },
      };
    }
  }

  async stopContainer(taskId: string): Promise<void> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { label: [`saassy.task.id=${taskId}`] },
    });

    for (const containerInfo of containers) {
      const container = this.docker.getContainer(containerInfo.Id);
      await container.stop({ t: 10 });
      await container.remove({ force: true });
      console.log(`Stopped and removed container for task ${taskId}`);
    }
  }

  async getRunningTasks(): Promise<string[]> {
    const containers = await this.docker.listContainers({
      filters: { label: ['saassy.managed=true'] },
    });

    return containers
      .map((c) => c.Labels['saassy.task.id'])
      .filter((id): id is string => Boolean(id));
  }

  private async pullImageIfNeeded(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect();
    } catch {
      console.log(`Pulling image: ${image}`);
      await new Promise((resolve, reject) => {
        this.docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) return reject(err);
          this.docker.modem.followProgress(stream, (err) => {
            if (err) reject(err);
            else resolve(undefined);
          });
        });
      });
    }
  }

  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)(m|g|k)?$/i);
    if (!match) return 512 * 1024 * 1024; // Default 512MB

    const value = parseInt(match[1]!, 10);
    const unit = (match[2] || 'm').toLowerCase();

    switch (unit) {
      case 'k':
        return value * 1024;
      case 'm':
        return value * 1024 * 1024;
      case 'g':
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  private timeout(ms: number): Promise<'timeout'> {
    return new Promise((resolve) => setTimeout(() => resolve('timeout'), ms));
  }
}
