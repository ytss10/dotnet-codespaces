export class WebGLRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private programs: Map<string, WebGLProgram> = new Map();
  private vaos: Map<string, WebGLVertexArrayObject> = new Map();
  private buffers: Map<string, WebGLBuffer> = new Map();
  private textures: Map<string, WebGLTexture> = new Map();
  private framebuffers: Map<string, WebGLFramebuffer> = new Map();
  
  constructor(private config: {
    canvas: HTMLCanvasElement;
    maxTextures: number;
    useMSAA: boolean;
    samples: number;
  }) {}
  
  setCanvas(canvas: HTMLCanvasElement): void {
    this.config.canvas = canvas;
  }
  
  initialize(): void {
    const gl = this.config.canvas.getContext('webgl2', {
      antialias: this.config.useMSAA,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      desynchronized: true
    }) as WebGL2RenderingContext;
    
    if (!gl) throw new Error('WebGL 2.0 not supported');
    
    this.gl = gl;
    
    // Enable extensions
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    gl.getExtension('EXT_float_blend');
    
    // Setup initial state
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    
    // Create shader programs
    this.createTileProgram();
    this.createInstancedProgram();
    this.createComputeProgram();
    
    // Initialize geometry buffers
    this.initializeGeometry();
    
    // Setup texture atlas for icons
    this.createTextureAtlas();
  }
  
  private createTileProgram(): void {
    const vertexShader = `#version 300 es
      precision highp float;
      
      in vec2 a_position;
      in vec2 a_texCoord;
      in vec4 a_color;
      in float a_instanceId;
      
      uniform mat4 u_projection;
      uniform mat4 u_view;
      uniform vec2 u_resolution;
      uniform float u_time;
      
      out vec2 v_texCoord;
      out vec4 v_color;
      out float v_glow;
      
      void main() {
        vec2 position = a_position;
        
        // Add subtle animation
        position.x += sin(u_time * 0.001 + a_instanceId) * 2.0;
        position.y += cos(u_time * 0.001 + a_instanceId * 1.1) * 2.0;
        
        gl_Position = u_projection * u_view * vec4(position, 0.0, 1.0);
        
        v_texCoord = a_texCoord;
        v_color = a_color;
        v_glow = sin(u_time * 0.002 + a_instanceId * 0.5) * 0.5 + 0.5;
      }
    `;
    
    const fragmentShader = `#version 300 es
      precision highp float;
      
      in vec2 v_texCoord;
      in vec4 v_color;
      in float v_glow;
      
      uniform sampler2D u_texture;
      uniform float u_opacity;
      
      out vec4 fragColor;
      
      void main() {
        vec4 texColor = texture(u_texture, v_texCoord);
        
        // Apply glow effect
        vec3 glowColor = vec3(0.0, 1.0, 1.0) * v_glow * 0.3;
        
        fragColor = vec4(
          mix(texColor.rgb, v_color.rgb + glowColor, 0.5),
          texColor.a * v_color.a * u_opacity
        );
        
        // Add border highlight
        float border = 0.02;
        if (v_texCoord.x < border || v_texCoord.x > 1.0 - border ||
            v_texCoord.y < border || v_texCoord.y > 1.0 - border) {
          fragColor.rgb = mix(fragColor.rgb, vec3(0.0, 1.0, 1.0), 0.5);
        }
      }
    `;
    
    const program = this.createProgram(vertexShader, fragmentShader);
    if (program) {
      this.programs.set('tile', program);
    }
  }
  
  private createInstancedProgram(): void {
    const vertexShader = `#version 300 es
      precision highp float;
      
      // Per-vertex attributes
      in vec3 a_position;
      in vec3 a_normal;
      in vec2 a_texCoord;
      
      // Per-instance attributes
      in mat4 a_instanceMatrix;
      in vec4 a_instanceColor;
      in float a_instanceMetric1;
      in float a_instanceMetric2;
      in float a_instanceMetric3;
      
      uniform mat4 u_projection;
      uniform mat4 u_view;
      uniform vec3 u_lightDirection;
      uniform float u_time;
      
      out vec3 v_normal;
      out vec2 v_texCoord;
      out vec4 v_color;
      out vec3 v_metrics;
      out float v_depth;
      
      void main() {
        mat4 mvp = u_projection * u_view * a_instanceMatrix;
        gl_Position = mvp * vec4(a_position, 1.0);
        
        v_normal = normalize(mat3(a_instanceMatrix) * a_normal);
        v_texCoord = a_texCoord;
        v_color = a_instanceColor;
        v_metrics = vec3(a_instanceMetric1, a_instanceMetric2, a_instanceMetric3);
        v_depth = gl_Position.z / gl_Position.w;
      }
    `;
    
    const fragmentShader = `#version 300 es
      precision highp float;
      
      in vec3 v_normal;
      in vec2 v_texCoord;
      in vec4 v_color;
      in vec3 v_metrics;
      in float v_depth;
      
      uniform vec3 u_lightDirection;
      uniform sampler2D u_dataTexture;
      uniform float u_time;
      
      out vec4 fragColor;
      
      void main() {
        // Lighting calculation
        float NdotL = max(dot(v_normal, u_lightDirection), 0.0);
        vec3 ambient = vec3(0.1, 0.1, 0.15);
        vec3 diffuse = v_color.rgb * NdotL;
        
        // Data visualization overlay
        vec3 dataColor = vec3(0.0);
        if (v_metrics.x > 0.8) dataColor.r = 1.0; // High latency = red
        if (v_metrics.y > 0.9) dataColor.g = 1.0; // High throughput = green  
        if (v_metrics.z > 0.5) dataColor.b = 1.0; // High errors = blue
        
        vec3 finalColor = ambient + diffuse + dataColor * 0.3;
        
        // Fog effect for depth
        float fogAmount = smoothstep(0.0, 1.0, v_depth);
        finalColor = mix(finalColor, vec3(0.05, 0.05, 0.1), fogAmount * 0.5);
        
        fragColor = vec4(finalColor, v_color.a);
      }
    `;
    
    const program = this.createProgram(vertexShader, fragmentShader);
    if (program) {
      this.programs.set('instanced', program);
    }
  }
  
  private createComputeProgram(): void {
    // WebGL 2 doesn't have compute shaders, but we can simulate with transform feedback
    const vertexShader = `#version 300 es
      precision highp float;
      
      in vec4 a_data;
      
      uniform float u_deltaTime;
      uniform sampler2D u_forceTexture;
      
      out vec4 v_data;
      
      void main() {
        vec4 data = a_data;
        
        // Simulate particle physics
        vec2 force = texture(u_forceTexture, data.xy).xy;
        data.xy += force * u_deltaTime;
        
        // Wrap around boundaries
        data.xy = fract(data.xy);
        
        v_data = data;
        gl_Position = vec4(0.0);
        gl_PointSize = 1.0;
      }
    `;
    
    const program = this.createTransformFeedbackProgram(vertexShader, ['v_data']);
    if (program) {
      this.programs.set('compute', program);
    }
  }
  
  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram | null {
    const gl = this.gl!;
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compilation failed:', gl.getShaderInfoLog(vertexShader));
      return null;
    }
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);
    
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader compilation failed:', gl.getShaderInfoLog(fragmentShader));
      return null;
    }
    
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking failed:', gl.getProgramInfoLog(program));
      return null;
    }
    
    return program;
  }
  
  private createTransformFeedbackProgram(vertexSource: string, varyings: string[]): WebGLProgram | null {
    const gl = this.gl!;
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compilation failed:', gl.getShaderInfoLog(vertexShader));
      return null;
    }
    
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    
    // Setup transform feedback
    gl.transformFeedbackVaryings(program, varyings, gl.INTERLEAVED_ATTRIBS);
    
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking failed:', gl.getProgramInfoLog(program));
      return null;
    }
    
    return program;
  }
  
  private initializeGeometry(): void {
    const gl = this.gl!;
    
    // Create quad geometry for tiles
    const quadVertices = new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
       1,  1, 1, 1,
      -1,  1, 0, 1
    ]);
    
    const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    
    const quadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(quadVAO);
    
    const quadVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    
    const quadEBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadEBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices, gl.STATIC_DRAW);
    
    // Setup vertex attributes
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    
    gl.bindVertexArray(null);
    
    this.vaos.set('quad', quadVAO);
    this.buffers.set('quadVBO', quadVBO);
    this.buffers.set('quadEBO', quadEBO);
    
    // Create instance buffer for million items
    const instanceCount = 1000000;
    const instanceData = new Float32Array(instanceCount * 16); // 4x4 matrix per instance
    
    const instanceVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceVBO);
    gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.DYNAMIC_DRAW);
    
    this.buffers.set('instances', instanceVBO);
  }
  
  private createTextureAtlas(): void {
    const gl = this.gl!;
    
    // Create texture atlas for UI elements
    const atlasSize = 4096;
    const atlas = gl.createTexture()!;
    
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA8,
      atlasSize, atlasSize, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null
    );
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    gl.generateMipmap(gl.TEXTURE_2D);
    
    this.textures.set('atlas', atlas);
    
    // Create data texture for metrics visualization
    const dataTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, dataTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA32F,
      1024, 1024, 0,
      gl.RGBA, gl.FLOAT, null
    );
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    
    this.textures.set('data', dataTexture);
  }
  
  clear(): void {
    const gl = this.gl!;
    gl.clearColor(0.05, 0.05, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
  
  drawTile(params: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: number[];
    borderColor: number[];
    metrics: any;
  }): void {
    const gl = this.gl!;
    const program = this.programs.get('tile');
    if (!program) return;
    
    gl.useProgram(program);
    
    // Set uniforms
    const projectionLoc = gl.getUniformLocation(program, 'u_projection');
    const viewLoc = gl.getUniformLocation(program, 'u_view');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    
    // Create orthographic projection
    const projection = this.createOrthographicMatrix(
      0, this.config.canvas.width,
      this.config.canvas.height, 0,
      -1, 1
    );
    
    const view = this.createIdentityMatrix();
    
    gl.uniformMatrix4fv(projectionLoc, false, projection);
    gl.uniformMatrix4fv(viewLoc, false, view);
    gl.uniform1f(timeLoc, performance.now());
    
    // Draw tile
    gl.bindVertexArray(this.vaos.get('quad')!);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
  
  render(): void {
    const gl = this.gl!;
    
    // Render all passes
    this.renderShadowPass();
    this.renderMainPass();
    this.renderPostProcessPass();
    
    // Present
    gl.flush();
  }
  
  private renderShadowPass(): void {
    // Shadow mapping pass
  }
  
  private renderMainPass(): void {
    // Main geometry pass
  }
  
  private renderPostProcessPass(): void {
    // Post-processing effects (bloom, FXAA, etc.)
  }
  
  private createOrthographicMatrix(
    left: number, right: number,
    bottom: number, top: number,
    near: number, far: number
  ): Float32Array {
    const matrix = new Float32Array(16);
    
    matrix[0] = 2 / (right - left);
    matrix[5] = 2 / (top - bottom);
    matrix[10] = -2 / (far - near);
    matrix[12] = -(right + left) / (right - left);
    matrix[13] = -(top + bottom) / (top - bottom);
    matrix[14] = -(far + near) / (far - near);
    matrix[15] = 1;
    
    return matrix;
  }
  
  private createIdentityMatrix(): Float32Array {
    const matrix = new Float32Array(16);
    matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1;
    return matrix;
  }
}
