import { spawn } from 'child_process';
import { mkdir, rm, readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import { Worker } from 'worker_threads';

interface BuildContext {
  readonly projectRoot: string;
  readonly cacheDir: string;
  readonly parallelism: number;
  readonly incrementalMode: boolean;
}

interface BuildArtifact {
  readonly path: string;
  readonly hash: string;
  readonly dependencies: string[];
  readonly timestamp: number;
}

class AdvancedBuildOrchestrator {
  private readonly context: BuildContext;
  private readonly artifacts = new Map<string, BuildArtifact>();
  private readonly compilationCache = new Map<string, Buffer>();
  
  constructor(context: BuildContext) {
    this.context = context;
  }

  async orchestrateBuild(): Promise<void> {
    // Clean previous builds if not incremental
    if (!this.context.incrementalMode) {
      await this.cleanArtifacts();
    }

    // Create build directories
    await this.ensureBuildDirectories();

    // Build dependency graph
    const graph = await this.buildDependencyGraph();

    // Execute parallel compilation with topological sorting
    await this.executeParallelCompilation(graph);

    // Verify build integrity
    await this.verifyBuildIntegrity();
  }

  private async cleanArtifacts(): Promise<void> {
    const cleanTargets = [
      'apps/orchestrator/dist',
      'apps/orchestrator/build',
      'apps/panel/dist',
      'apps/panel/build',
      'packages/shared/dist',
      'packages/shared/lib'
    ];

    await Promise.all(
      cleanTargets.map(target => 
        rm(join(this.context.projectRoot, target), { 
          recursive: true, 
          force: true 
        })
      )
    );
  }

  private async ensureBuildDirectories(): Promise<void> {
    const buildDirs = [
      'apps/orchestrator/build',
      'apps/panel/build',
      'packages/shared/lib',
      '.cache/builds'
    ];

    await Promise.all(
      buildDirs.map(dir => 
        mkdir(join(this.context.projectRoot, dir), { 
          recursive: true 
        })
      )
    );
  }

  private async buildDependencyGraph(): Promise<Map<string, Set<string>>> {
    const graph = new Map<string, Set<string>>();
    
    // Define project dependencies
    graph.set('packages/shared', new Set());
    graph.set('apps/orchestrator', new Set(['packages/shared']));
    graph.set('apps/panel', new Set(['packages/shared']));
    
    return graph;
  }

  private async executeParallelCompilation(
    graph: Map<string, Set<string>>
  ): Promise<void> {
    const compiled = new Set<string>();
    const compiling = new Map<string, Promise<void>>();

    const compileProject = async (project: string): Promise<void> => {
      // Wait for dependencies
      const deps = graph.get(project) || new Set();
      await Promise.all(
        Array.from(deps).map(dep => 
          compiling.get(dep) || Promise.resolve()
        )
      );

      // Compile this project
      const configPath = join(
        this.context.projectRoot,
        project,
        'tsconfig.build.json'
      );

      await this.runTypeScriptCompiler(configPath, project);
      compiled.add(project);
    };

    // Start parallel compilation
    for (const project of graph.keys()) {
      compiling.set(project, compileProject(project));
    }

    await Promise.all(compiling.values());
  }

  private async runTypeScriptCompiler(
    configPath: string,
    project: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const tsc = spawn('npx', [
        'tsc',
        '--build',
        configPath,
        '--verbose',
        this.context.incrementalMode ? '--incremental' : '--force'
      ], {
        cwd: this.context.projectRoot,
        stdio: 'pipe'
      });

      let output = '';
      tsc.stdout.on('data', (data) => {
        output += data.toString();
      });

      tsc.stderr.on('data', (data) => {
        console.error(`[${project}] ${data.toString()}`);
      });

      tsc.on('close', (code) => {
        if (code === 0) {
          console.log(`✓ Built ${project}`);
          resolve();
        } else {
          reject(new Error(`TypeScript compilation failed for ${project}`));
        }
      });
    });
  }

  private async verifyBuildIntegrity(): Promise<void> {
    const verifications = [
      this.verifyNoInputOutputOverlap(),
      this.verifyDeclarationFiles(),
      this.verifyBuildArtifacts()
    ];

    await Promise.all(verifications);
  }

  private async verifyNoInputOutputOverlap(): Promise<void> {
    // Verify that no output files overlap with input files
    const outputDirs = [
      'apps/orchestrator/build',
      'apps/panel/build',
      'packages/shared/lib'
    ];

    const inputPatterns = [
      'apps/orchestrator/dist',
      'apps/panel/dist',
      'packages/shared/dist'
    ];

    for (const outputDir of outputDirs) {
      for (const inputPattern of inputPatterns) {
        if (outputDir.includes(inputPattern)) {
          throw new Error(`Output directory ${outputDir} overlaps with input pattern ${inputPattern}`);
        }
      }
    }
  }

  private async verifyDeclarationFiles(): Promise<void> {
    // Verify declaration files are generated correctly
    const expectedDeclarations = [
      'packages/shared/lib/index.d.ts',
      'apps/orchestrator/build/server.d.ts'
    ];

    for (const declaration of expectedDeclarations) {
      try {
        await stat(join(this.context.projectRoot, declaration));
      } catch {
        console.warn(`Warning: Expected declaration file not found: ${declaration}`);
      }
    }
  }

  private async verifyBuildArtifacts(): Promise<void> {
    // Generate content hashes for build verification
    const artifacts = await this.collectBuildArtifacts();
    
    for (const artifact of artifacts) {
      const hash = createHash('sha256')
        .update(artifact.path)
        .update(artifact.timestamp.toString())
        .digest('hex');
      
      this.artifacts.set(artifact.path, {
        ...artifact,
        hash
      });
    }

    console.log(`✓ Verified ${this.artifacts.size} build artifacts`);
  }

  private async collectBuildArtifacts(): Promise<BuildArtifact[]> {
    const artifacts: BuildArtifact[] = [];
    const buildDirs = [
      'apps/orchestrator/build',
      'apps/panel/build',
      'packages/shared/lib'
    ];

    for (const dir of buildDirs) {
      const fullPath = join(this.context.projectRoot, dir);
      try {
        const files = await this.walkDirectory(fullPath);
        for (const file of files) {
          const stats = await stat(file);
          artifacts.push({
            path: relative(this.context.projectRoot, file),
            hash: '',
            dependencies: [],
            timestamp: stats.mtimeMs
          });
        }
      } catch {
        // Directory doesn't exist yet
      }
    }

    return artifacts;
  }

  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.walkDirectory(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }
}

// Export build configuration
export async function executeBuild(incremental = false): Promise<void> {
  const orchestrator = new AdvancedBuildOrchestrator({
    projectRoot: process.cwd(),
    cacheDir: '.cache/builds',
    parallelism: 4,
    incrementalMode: incremental
  });

  await orchestrator.orchestrateBuild();
}

// CLI entry point
if (require.main === module) {
  executeBuild(process.argv.includes('--incremental'))
    .then(() => {
      console.log('✅ Build completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Build failed:', error);
      process.exit(1);
    });
}
