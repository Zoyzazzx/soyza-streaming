import React, { useEffect, useRef } from 'react';

interface InteractiveNeuralVortexProps {
  children?: React.ReactNode;
  colorTheme?: "red" | "blue";
}

const InteractiveNeuralVortex = ({ children, colorTheme = "blue" }: InteractiveNeuralVortexProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointer = useRef({ x: 0, y: 0, tX: 0, tY: 0 }); // Real-time pointer updates
  const animationRef = useRef<number | null>(null);
  const themeTargetRef = useRef(colorTheme === "red" ? 1.0 : 0.0);
  const currentThemeRef = useRef(colorTheme === "red" ? 1.0 : 0.0);

  useEffect(() => {
    themeTargetRef.current = colorTheme === "red" ? 1.0 : 0.0;
  }, [colorTheme]);

  // WebGL setup
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    // Initialize WebGL context
    const gl = canvasEl.getContext('webgl') || canvasEl.getContext('experimental-webgl') as WebGLRenderingContext;
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    // Shader sources
    const vsSource = `
      precision mediump float;
      attribute vec2 a_position;
      varying vec2 vUv;
      void main() {
        vUv = .5 * (a_position + 1.);
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_ratio;
      uniform vec2 u_pointer_position;
      uniform float u_scroll_progress;
      uniform float u_theme; // 0.0 = blue/violet, 1.0 = red/rose
      
      vec2 rotate(vec2 uv, float th) {
        return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
      }
      
      float neuro_shape(vec2 uv, float t, float p) {
        vec2 sine_acc = vec2(0.);
        vec2 res = vec2(0.);
        float scale = 8.;
        for (int j = 0; j < 15; j++) {
          uv = rotate(uv, 1.);
          sine_acc = rotate(sine_acc, 1.);
          vec2 layer = uv * scale + float(j) + sine_acc - t;
          sine_acc += sin(layer) + 2.4 * p;
          res += (.5 + .5 * cos(layer)) / scale;
          scale *= (1.2);
        }
        return res.x + res.y;
      }
      
      void main() {
        vec2 uv = .5 * vUv;
        uv.x *= u_ratio;
        vec2 pointer = vUv - u_pointer_position;
        pointer.x *= u_ratio;
        float p = clamp(length(pointer), 0., 1.);
        p = .5 * pow(1. - p, 2.);
        float t = .001 * u_time;
        vec3 color = vec3(0.);
        float noise = neuro_shape(uv, t, p);
        noise = 1.2 * pow(noise, 3.);
        noise += pow(noise, 10.);
        noise = max(.0, noise - .5);
        noise *= (1. - length(vUv - .5));
        
        // Blue / Cyan theme for Viewer
        vec3 blueVortex = vec3(0.1, 0.45, 0.85);
        blueVortex = mix(blueVortex, vec3(0.02, 0.7, 0.9), 0.32 + 0.16 * sin(2.0 * u_scroll_progress + 1.2));
        blueVortex += vec3(0.05, 0.2, 0.7) * sin(2.0 * u_scroll_progress + 1.5);
        
        // Royal Purple / Violet theme for Streamer
        vec3 purpleVortex = vec3(0.55, 0.15, 0.85);
        purpleVortex = mix(purpleVortex, vec3(0.75, 0.25, 0.95), 0.32 + 0.16 * sin(2.0 * u_scroll_progress + 1.2));
        purpleVortex += vec3(0.35, 0.05, 0.6) * sin(2.0 * u_scroll_progress + 1.5);
        
        vec3 vortexColor = mix(blueVortex, purpleVortex, u_theme);
        
        // mix base color and vortex color based on noise
        color = mix(baseColor, vortexColor, noise * (0.13 + 0.03 * u_theme));
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Shader compilation
    const compileShader = (gl: WebGLRenderingContext, source: string, type: number) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    // Program setup
    const program = gl.createProgram();
    if (!program) return;
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // Geometry
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uRatio = gl.getUniformLocation(program, 'u_ratio');
    const uPointerPosition = gl.getUniformLocation(program, 'u_pointer_position');
    const uScrollProgress = gl.getUniformLocation(program, 'u_scroll_progress');
    const uTheme = gl.getUniformLocation(program, 'u_theme');

    // Resize handler
    const resizeCanvas = () => {
      const devicePixelRatio = Math.min(window.devicePixelRatio, 2);
      canvasEl.width = window.innerWidth * devicePixelRatio;
      canvasEl.height = window.innerHeight * devicePixelRatio;
      gl.viewport(0, 0, canvasEl.width, canvasEl.height);
      gl.uniform1f(uRatio, canvasEl.width / canvasEl.height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Animation loop
    const render = () => {
      const currentTime = performance.now();
      
      // Smooth pointer movement
      pointer.current.x += (pointer.current.tX - pointer.current.x) * 0.2;
      pointer.current.y += (pointer.current.tY - pointer.current.y) * 0.2;
      
      // Smooth color theme interpolation
      currentThemeRef.current += (themeTargetRef.current - currentThemeRef.current) * 0.08;

      gl.uniform1f(uTime, currentTime);
      gl.uniform2f(uPointerPosition, 
        pointer.current.x / window.innerWidth, 
        1 - pointer.current.y / window.innerHeight
      );
      gl.uniform1f(uScrollProgress, window.scrollY / (2 * window.innerHeight));
      gl.uniform1f(uTheme, currentThemeRef.current);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    // Event listeners
    const handleMouseMove = (e: MouseEvent) => {
      pointer.current.tX = e.clientX;
      pointer.current.tY = e.clientY;
    };

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('touchmove', (e: TouchEvent) => {
      if (e.touches[0]) {
        pointer.current.tX = e.touches[0].clientX;
        pointer.current.tY = e.touches[0].clientY;
      }
    });

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointermove', handleMouseMove as EventListener);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-x-hidden font-sans w-full">
      {/* Canvas Background */}
      <canvas 
        ref={canvasRef} 
        id="neuro" 
        className="fixed inset-0 w-full h-full pointer-events-none z-0"
      ></canvas>
      
      {/* Content wrapper */}
      <div className="relative z-10 w-full flex flex-col flex-1 items-center justify-center">
        {children}
      </div>
    </div>
  );
};

export default InteractiveNeuralVortex;
