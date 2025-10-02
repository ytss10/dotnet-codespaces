export class GPUAccelerator {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private computePipeline: GPUComputePipeline | null = null;
  
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // Request WebGPU adapter
    const adapter = await navigator.gpu?.requestAdapter({
      powerPreference: 'high-performance',
      forceFallbackAdapter: false
    });
    
    if (!adapter) throw new Error('WebGPU not available');
    
    // Request device with maximum limits
    this.device = await adapter.requestDevice({
      requiredFeatures: [
        'timestamp-query',
        'shader-f16',
        'depth-clip-control',
        'indirect-first-instance'
      ],
      requiredLimits: {
        maxBufferSize: 2147483648, // 2GB
        maxStorageBufferBindingSize: 2147483648,
        maxComputeWorkgroupSizeX: 1024,
        maxComputeWorkgroupSizeY: 1024,
        maxComputeWorkgroupSizeZ: 64
      }
    });
    
    // Configure canvas context
    this.context = canvas.getContext('webgpu')!;
    const format = navigator.gpu.getPreferredCanvasFormat();
    
    this.context.configure({
      device: this.device,
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      alphaMode: 'premultiplied'
    });
    
    // Create compute pipeline for parallel processing
    await this.createComputePipeline();
    
    // Create render pipeline
    await this.createRenderPipeline(format);
  }
  
  private async createComputePipeline(): Promise<void> {
    const computeShader = `
      @group(0) @binding(0) var<storage, read> input: array<f32>;
      @group(0) @binding(1) var<storage, read_write> output: array<f32>;
      @group(0) @binding(2) var<uniform> params: ComputeParams;
      
      struct ComputeParams {
        count: u32,
        scale: f32,
        time: f32,
        _padding: f32,
      };
      
      @compute @workgroup_size(256, 1, 1)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let index = global_id.x;
        if (index >= params.count) {
          return;
        }
        
        // Parallel computation for million items
        let value = input[index];
        
        // Complex computation using GPU
        var result = value;
        for (var i = 0u; i < 100u; i++) {
          result = sin(result * params.scale + f32(i) + params.time);
          result = result * result + 0.1;
        }
        
        output[index] = result;
      }
    `;
    
    const module = this.device!.createShaderModule({
      label: 'Compute shader',
      code: computeShader
    });
    
    this.computePipeline = this.device!.createComputePipeline({
      label: 'Compute pipeline',
      layout: 'auto',
      compute: {
        module,
        entryPoint: 'main'
      }
    });
  }
  
  private async createRenderPipeline(format: GPUTextureFormat): Promise<void> {
    const vertexShader = `
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>,
        @location(1) uv: vec2<f32>,
        @location(2) instanceId: f32,
      };
      
      struct Uniforms {
        mvpMatrix: mat4x4<f32>,
        time: f32,
        scale: f32,
        _pad: vec2<f32>,
      };
      
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var<storage, read> instances: array<mat4x4<f32>>;
      
      @vertex
      fn vs_main(
        @location(0) position: vec3<f32>,
        @location(1) normal: vec3<f32>,
        @location(2) uv: vec2<f32>,
        @builtin(instance_index) instanceIdx: u32
      ) -> VertexOutput {
        var output: VertexOutput;
        
        let instanceMatrix = instances[instanceIdx];
        let worldPos = instanceMatrix * vec4<f32>(position, 1.0);
        
        // Animated transformation
        let animatedPos = worldPos + vec4<f32>(
          sin(uniforms.time + f32(instanceIdx) * 0.01) * 0.1,
          cos(uniforms.time + f32(instanceIdx) * 0.011) * 0.1,
          0.0,
          0.0
        );
        
        output.position = uniforms.mvpMatrix * animatedPos;
        output.color = vec4<f32>(
          sin(f32(instanceIdx) * 0.1) * 0.5 + 0.5,
          cos(f32(instanceIdx) * 0.13) * 0.5 + 0.5,
          sin(f32(instanceIdx) * 0.17) * 0.5 + 0.5,
          1.0
        );
        output.uv = uv;
        output.instanceId = f32(instanceIdx);
        
        return output;
      }
    `;
    
    const fragmentShader = `
      @group(0) @binding(2) var mySampler: sampler;
      @group(0) @binding(3) var myTexture: texture_2d<f32>;
      
      @fragment
      fn fs_main(
        @location(0) color: vec4<f32>,
        @location(1) uv: vec2<f32>,
        @location(2) instanceId: f32
      ) -> @location(0) vec4<f32> {
        let texColor = textureSample(myTexture, mySampler, uv);
        
        // Advanced shading
        let glow = sin(instanceId * 0.1) * 0.5 + 0.5;
        let finalColor = mix(texColor, color, 0.5) + vec4<f32>(0.0, glow * 0.2, glow * 0.3, 0.0);
        
        return vec4<f32>(finalColor.rgb, 1.0);
      }
    `;
    
    const vertexModule = this.device!.createShaderModule({
      label: 'Vertex shader',
      code: vertexShader
    });
    
    const fragmentModule = this.device!.createShaderModule({
      label: 'Fragment shader',  
      code: fragmentShader
    });
    
    this.pipeline = this.device!.createRenderPipeline({
      label: 'Render pipeline',
      layout: 'auto',
      vertex: {
        module: vertexModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 32,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x3' },
              { shaderLocation: 2, offset: 24, format: 'float32x2' }
            ]
          }
        ]
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'fs_main',
        targets: [{ format }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
        frontFace: 'ccw'
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus'
      }
    });
  }
  
  async renderMillionInstances(instanceData: Float32Array): Promise<void> {
    if (!this.device || !this.context || !this.pipeline) return;
    
    const INSTANCE_COUNT = 1000000;
    const BATCH_SIZE = 100000;
    
    // Create instance buffer
    const instanceBuffer = this.device.createBuffer({
      size: instanceData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    
    new Float32Array(instanceBuffer.getMappedRange()).set(instanceData);
    instanceBuffer.unmap();
    
    // Create command encoder
    const commandEncoder = this.device.createCommandEncoder();
    
    // Render in batches for optimal performance
    for (let i = 0; i < INSTANCE_COUNT; i += BATCH_SIZE) {
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1 },
          loadOp: i === 0 ? 'clear' : 'load',
          storeOp: 'store'
        }]
      });
      
      renderPass.setPipeline(this.pipeline);
      renderPass.drawIndexedIndirect(instanceBuffer, i * 16);
      renderPass.end();
    }
    
    // Submit commands
    this.device.queue.submit([commandEncoder.finish()]);
  }
  
  async computeParallel(input: Float32Array): Promise<Float32Array> {
    if (!this.device || !this.computePipeline) {
      throw new Error('GPU not initialized');
    }
    
    const size = input.length * Float32Array.BYTES_PER_ELEMENT;
    
    // Create buffers
    const inputBuffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(inputBuffer.getMappedRange()).set(input);
    inputBuffer.unmap();
    
    const outputBuffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
    
    const paramsBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    
    new Float32Array(paramsBuffer.getMappedRange()).set([
      input.length, // count
      1.0,          // scale
      performance.now() / 1000, // time
      0             // padding
    ]);
    paramsBuffer.unmap();
    
    // Create bind group
    const bindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } }
      ]
    });
    
    // Dispatch compute
    const commandEncoder = this.device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, bindGroup);
    
    const workgroupCount = Math.ceil(input.length / 256);
    computePass.dispatchWorkgroups(workgroupCount);
    
    computePass.end();
    
    // Read back results
    const readBuffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    
    commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, size);
    
    this.device.queue.submit([commandEncoder.finish()]);
    
    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(readBuffer.getMappedRange()).slice();
    readBuffer.unmap();
    
    return result;
  }
}
