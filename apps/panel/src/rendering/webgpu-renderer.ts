export class WebGPURenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  private instanceBuffer: GPUBuffer | null = null;
  private maxInstances = 1000000;
  
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (!navigator.gpu) throw new Error('WebGPU not supported');
    
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });
    
    if (!adapter) throw new Error('No GPU adapter found');
    
    this.device = await adapter.requestDevice({
      requiredLimits: {
        maxBufferSize: 2147483648,
        maxVertexAttributes: 16,
        maxVertexBufferArrayStride: 256
      }
    });
    
    this.context = canvas.getContext('webgpu')!;
    
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: presentationFormat,
      alphaMode: 'premultiplied',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    
    await this.createRenderPipeline(presentationFormat);
    this.createInstanceBuffer();
  }
  
  private async createRenderPipeline(format: GPUTextureFormat): Promise<void> {
    const shaderModule = this.device!.createShaderModule({
      code: `
        struct VertexOut {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
          @location(1) uv: vec2<f32>,
          @location(2) instanceId: f32,
        }
        
        struct Instance {
          transform: mat4x4<f32>,
          color: vec4<f32>,
          metrics: vec4<f32>,
        }
        
        @group(0) @binding(0) var<uniform> viewProj: mat4x4<f32>;
        @group(0) @binding(1) var<storage, read> instances: array<Instance>;
        
        @vertex
        fn vs_main(
          @location(0) position: vec3<f32>,
          @location(1) uv: vec2<f32>,
          @builtin(instance_index) instanceIdx: u32
        ) -> VertexOut {
          var out: VertexOut;
          let instance = instances[instanceIdx];
          
          out.position = viewProj * instance.transform * vec4<f32>(position, 1.0);
          out.color = instance.color;
          out.uv = uv;
          out.instanceId = f32(instanceIdx);
          
          return out;
        }
        
        @fragment
        fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
          // Procedural pattern based on instance ID
          let pattern = sin(in.instanceId * 0.001 + in.uv.x * 10.0) * 0.5 + 0.5;
          let glow = pow(1.0 - length(in.uv - vec2<f32>(0.5)), 2.0);
          
          var color = in.color;
          color.rgb = mix(color.rgb, vec3<f32>(0.0, 1.0, 1.0), pattern * 0.3);
          color.rgb += vec3<f32>(glow * 0.2);
          
          return color;
        }
      `
    });
    
    this.renderPipeline = this.device!.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 20,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 12, format: 'float32x2' }
          ]
        }]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back'
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less'
      }
    });
  }
  
  private createInstanceBuffer(): void {
    const instanceSize = 64 + 16 + 16; // transform + color + metrics
    this.instanceBuffer = this.device!.createBuffer({
      size: this.maxInstances * instanceSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
  }
  
  async render(instances: any[]): Promise<void> {
    if (!this.device || !this.context || !this.renderPipeline) return;
    
    // Update instance data
    const instanceData = new Float32Array(instances.length * 24);
    instances.forEach((instance, i) => {
      const offset = i * 24;
      // Transform matrix (simplified to position + scale)
      instanceData.set([
        instance.scale, 0, 0, instance.x,
        0, instance.scale, 0, instance.y,
        0, 0, 1, 0,
        0, 0, 0, 1
      ], offset);
      // Color
      instanceData.set(instance.color || [1, 1, 1, 1], offset + 16);
      // Metrics
      instanceData.set([
        instance.replicas / 1000000,
        instance.latency / 1000,
        instance.throughput / 10000,
        instance.errorRate
      ], offset + 20);
    });
    
    this.device.queue.writeBuffer(this.instanceBuffer!, 0, instanceData);
    
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    
    renderPass.setPipeline(this.renderPipeline);
    renderPass.draw(6, instances.length); // 6 vertices per quad
    renderPass.end();
    
    this.device.queue.submit([commandEncoder.finish()]);
  }
}
