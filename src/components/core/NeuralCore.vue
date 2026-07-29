<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  EllipseCurve,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  NormalBlending,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three'

import {
  normalizeAudioBands,
  normalizeNeuralCoreValue,
  resolveNeuralCoreMode,
  resolveNeuralCoreMotionScale,
  selectNeuralCoreRenderMode,
  type NeuralCoreAudioBands,
  type NeuralCoreRenderMode,
  type NeuralCoreSessionState,
} from '@/services/neuralCore'
import { normalizeModeColor, type ModeSemanticKey } from '@/services/modeVisuals'

const props = withDefaults(
  defineProps<{
    progress: number
    sessionState: NeuralCoreSessionState
    modeKey: ModeSemanticKey
    accentColor: string
    panelExpanded: boolean
    resetSignal?: number
    waveSignal?: number
    completionSignal?: number
    audioBands?: NeuralCoreAudioBands | null
  }>(),
  {
    resetSignal: 0,
    waveSignal: 0,
    completionSignal: 0,
    audioBands: null,
  },
)

const container = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const renderMode = ref<NeuralCoreRenderMode>('static')
const reducedMotion = ref(false)

const normalizedProgress = computed(() => normalizeNeuralCoreValue(props.progress))
const fallbackStyle = computed<Record<string, string>>(() => ({
  '--neural-core-color': normalizeModeColor(props.accentColor),
  '--neural-core-progress': `${normalizedProgress.value * 360}deg`,
}))

const target = {
  progress: normalizedProgress.value,
  motion: 0.3,
  reset: 0,
  wave: 0,
  completion: 0,
  audio: normalizeAudioBands(props.audioBands),
}

let renderer: WebGLRenderer | undefined
let scene: Scene | undefined
let camera: PerspectiveCamera | undefined
let root: Group | undefined
let membrane: Mesh<IcosahedronGeometry, ShaderMaterial> | undefined
let veil: Mesh<IcosahedronGeometry, ShaderMaterial> | undefined
let progressRing: Mesh<RingGeometry, ShaderMaterial> | undefined
let waveRing: Mesh<RingGeometry, ShaderMaterial> | undefined
let completionRing: Mesh<RingGeometry, ShaderMaterial> | undefined
let orbitPoints: Points<BufferGeometry, PointsMaterial> | undefined
let resizeObserver: ResizeObserver | undefined
let motionMedia: MediaQueryList | undefined
let animationFrame: number | undefined
let documentVisible = true
let lastFrameTime = 0
let elapsedTime = 0
let currentProgress = normalizedProgress.value
let currentMotion = 0.3
let currentWave = 0
let currentCompletion = 0
let currentReset = 0
let isLowCapability = false
let disposed = false

const currentColor = new Color(normalizeModeColor(props.accentColor))
const targetColor = currentColor.clone()
const orbitLayers: Array<Line<BufferGeometry, LineBasicMaterial>> = []

const membraneVertexShader = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uDeformation;
  uniform float uPulse;
  uniform float uAudioLow;
  uniform float uAudioMid;
  uniform float uVerticalDrift;

  varying float vField;
  varying vec3 vNormalView;

  float field(vec3 point) {
    float first = sin(point.x * 3.1 + uTime * 0.72);
    float second = sin(point.y * 4.2 - uTime * 0.51);
    float third = sin(point.z * 3.7 + uTime * 0.38);
    float contour = sin((point.x + point.y - point.z) * 5.4 + uTime * 0.28);
    return (first + second + third + contour * 0.65) / 3.65;
  }

  void main() {
    float organization = mix(1.0, 0.28, smoothstep(0.0, 1.0, uProgress));
    float neuralField = field(position);
    float breath = sin(uTime * 1.45) * (0.018 + uAudioLow * 0.026);
    float deformation = neuralField * uDeformation * organization;
    deformation += breath + uAudioMid * neuralField * 0.035;
    deformation += uPulse * 0.055;

    vec3 transformed = position + normal * deformation;
    transformed.y += uVerticalDrift * sin(uTime * 0.34 + position.x * 2.0);

    vec4 modelViewPosition = modelViewMatrix * vec4(transformed, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vField = neuralField;
    gl_Position = projectionMatrix * modelViewPosition;
  }
`

const membraneFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform float uFineEnergy;

  varying float vField;
  varying vec3 vNormalView;

  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vNormalView), vec3(0.0, 0.0, 1.0))), 1.65);
    float contours = smoothstep(0.64, 0.94, abs(sin(vField * 9.0 + uFineEnergy * 0.8)));
    float light = (0.24 + fresnel * 0.72 + contours * 0.16) * uBrightness;
    float alpha = uOpacity * (0.34 + fresnel * 0.58 + contours * 0.12);
    gl_FragColor = vec4(uColor * light, alpha);
  }
`

const progressVertexShader = `
  varying vec2 vRingPosition;

  void main() {
    vRingPosition = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const progressFragmentShader = `
  uniform vec3 uColor;
  uniform float uProgress;
  uniform float uOpacity;

  varying vec2 vRingPosition;

  const float PI = 3.141592653589793;
  const float TWO_PI = 6.283185307179586;

  void main() {
    float angle = atan(vRingPosition.y, vRingPosition.x);
    float clockwise = mod((PI * 0.5) - angle + TWO_PI, TWO_PI) / TWO_PI;
    float feather = 0.006;
    float activeArc = 1.0 - smoothstep(uProgress - feather, uProgress + feather, clockwise);
    activeArc *= step(0.0001, uProgress);

    vec3 inactiveColor = mix(vec3(0.32, 0.36, 0.38), uColor, 0.12);
    vec3 ringColor = mix(inactiveColor, uColor, activeArc);
    float alpha = mix(0.12, 0.86, activeArc) * uOpacity;
    gl_FragColor = vec4(ringColor, alpha);
  }
`

const createOrbit = (
  radiusX: number,
  radiusY: number,
  rotation: [number, number, number],
  opacity: number,
  phase: number,
) => {
  const curve = new EllipseCurve(0, 0, radiusX, radiusY, 0, Math.PI * 2, false, 0)
  const points = curve.getPoints(isLowCapability ? 72 : 128)
  const geometry = new BufferGeometry().setFromPoints(
    points.map((point) => new Vector3(point.x, point.y, 0)),
  )
  const material = new LineBasicMaterial({
    color: currentColor,
    transparent: true,
    opacity,
    depthWrite: false,
  })
  const orbit = new Line(geometry, material)

  orbit.rotation.set(...rotation)
  orbit.userData.phase = phase
  orbit.userData.baseOpacity = opacity
  root?.add(orbit)
  orbitLayers.push(orbit)
}

const createScene = () => {
  const targetCanvas = canvas.value

  if (!targetCanvas) return false

  const context =
    targetCanvas.getContext('webgl2', {
      alpha: true,
      antialias: !isLowCapability,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    }) ??
    targetCanvas.getContext('webgl', {
      alpha: true,
      antialias: !isLowCapability,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    })

  if (!context) return false

  renderer = new WebGLRenderer({
    canvas: targetCanvas,
    context,
    alpha: true,
    antialias: !isLowCapability,
    powerPreference: 'high-performance',
    premultipliedAlpha: true,
  })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isLowCapability ? 1 : 1.5))

  scene = new Scene()
  camera = new PerspectiveCamera(38, 1, 0.1, 20)
  camera.position.set(0, 0, 5.75)

  root = new Group()
  root.rotation.set(-0.08, 0.12, 0)
  scene.add(root)

  const detail = isLowCapability ? 2 : 3
  const membraneGeometry = new IcosahedronGeometry(1.08, detail)
  const sharedUniforms = {
    uTime: { value: 0 },
    uProgress: { value: currentProgress },
    uDeformation: { value: resolveNeuralCoreMode(props.modeKey).deformation },
    uPulse: { value: 0 },
    uAudioLow: { value: 0 },
    uAudioMid: { value: 0 },
    uVerticalDrift: { value: 0 },
    uColor: { value: currentColor.clone() },
    uOpacity: { value: 0.34 },
    uBrightness: { value: resolveNeuralCoreMode(props.modeKey).brightness },
    uFineEnergy: { value: 0 },
  }

  membrane = new Mesh(
    membraneGeometry,
    new ShaderMaterial({
      uniforms: sharedUniforms,
      vertexShader: membraneVertexShader,
      fragmentShader: membraneFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      wireframe: true,
      blending: NormalBlending,
    }),
  )
  membrane.rotation.set(0.25, -0.18, 0.08)
  root.add(membrane)

  veil = new Mesh(
    membraneGeometry.clone(),
    new ShaderMaterial({
      uniforms: {
        ...sharedUniforms,
        uColor: { value: currentColor.clone() },
        uOpacity: { value: 0.075 },
      },
      vertexShader: membraneVertexShader,
      fragmentShader: membraneFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: NormalBlending,
    }),
  )
  veil.scale.setScalar(0.965)
  veil.rotation.set(-0.15, 0.24, -0.12)
  root.add(veil)

  const progressGeometry = new RingGeometry(1.72, 1.75, isLowCapability ? 112 : 192)
  progressRing = new Mesh(
    progressGeometry,
    new ShaderMaterial({
      uniforms: {
        uColor: { value: currentColor.clone() },
        uProgress: { value: currentProgress },
        uOpacity: { value: 1 },
      },
      vertexShader: progressVertexShader,
      fragmentShader: progressFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    }),
  )
  progressRing.position.z = 0.08
  root.add(progressRing)

  const pulseGeometry = new RingGeometry(1.52, 1.535, isLowCapability ? 80 : 128)
  waveRing = new Mesh(
    pulseGeometry,
    new ShaderMaterial({
      uniforms: {
        uColor: { value: currentColor.clone() },
        uProgress: { value: 1 },
        uOpacity: { value: 0 },
      },
      vertexShader: progressVertexShader,
      fragmentShader: progressFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    }),
  )
  root.add(waveRing)

  completionRing = new Mesh(
    pulseGeometry.clone(),
    new ShaderMaterial({
      uniforms: {
        uColor: { value: currentColor.clone() },
        uProgress: { value: 1 },
        uOpacity: { value: 0 },
      },
      vertexShader: progressVertexShader,
      fragmentShader: progressFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    }),
  )
  root.add(completionRing)

  createOrbit(1.52, 0.72, [0.82, 0.12, 0.18], 0.19, 0.2)
  createOrbit(1.36, 0.92, [-0.54, 0.48, -0.38], 0.15, 1.7)
  createOrbit(1.2, 0.54, [1.08, -0.62, 0.62], 0.12, 3.1)
  createOrbit(1.62, 1.04, [0.26, 0.76, -0.8], 0.09, 4.3)

  const pointPositions = new Float32Array(36)

  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2
    const radius = 1.14 + (index % 3) * 0.17
    pointPositions[index * 3] = Math.cos(angle) * radius
    pointPositions[index * 3 + 1] = Math.sin(angle) * radius * 0.58
    pointPositions[index * 3 + 2] = ((index % 4) - 1.5) * 0.12
  }

  const pointGeometry = new BufferGeometry()
  pointGeometry.setAttribute('position', new Float32BufferAttribute(pointPositions, 3))
  orbitPoints = new Points(
    pointGeometry,
    new PointsMaterial({
      color: currentColor,
      size: isLowCapability ? 0.018 : 0.024,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  )
  orbitPoints.rotation.set(0.62, -0.24, 0)
  root.add(orbitPoints)

  return true
}

const updateSize = () => {
  if (!container.value || !renderer || !camera) return

  const { width, height } = container.value.getBoundingClientRect()

  if (width <= 0 || height <= 0) return

  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()

  const simplified = renderMode.value !== 'full' || width < 470 || height < 470
  orbitLayers.forEach((orbit, index) => {
    orbit.visible = !simplified || index < 2
  })
}

const damp = (current: number, next: number, speed: number, delta: number) =>
  current + (next - current) * (1 - Math.exp(-speed * delta))

const updateFrame = (timestamp: number) => {
  animationFrame = undefined

  if (disposed || !documentVisible || !renderer || !scene || !camera || !root) return

  const frameInterval = renderMode.value === 'full' ? 1000 / 60 : 1000 / 24

  if (lastFrameTime && timestamp - lastFrameTime < frameInterval) {
    animationFrame = window.requestAnimationFrame(updateFrame)
    return
  }

  const delta = Math.min(0.05, lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 1 / 60)
  lastFrameTime = timestamp
  const mode = resolveNeuralCoreMode(props.modeKey)
  const targetMotion = resolveNeuralCoreMotionScale(props.sessionState, reducedMotion.value)

  target.motion = targetMotion
  currentProgress = damp(currentProgress, target.progress, 3.4, delta)
  currentMotion = damp(currentMotion, target.motion, 2.8, delta)
  currentWave = damp(currentWave, target.wave, target.wave > currentWave ? 12 : 2.6, delta)
  currentCompletion = damp(
    currentCompletion,
    target.completion,
    target.completion > currentCompletion ? 10 : 1.85,
    delta,
  )
  currentReset = damp(currentReset, target.reset, target.reset > currentReset ? 9 : 2.4, delta)
  currentColor.lerp(targetColor, 1 - Math.exp(-delta * 3.2))

  target.wave = Math.max(0, target.wave - delta * 0.82)
  target.completion = Math.max(0, target.completion - delta * 0.52)
  target.reset = Math.max(0, target.reset - delta * 0.9)
  elapsedTime += delta * mode.speed * currentMotion

  const audio = reducedMotion.value ? { low: 0, mid: 0, high: 0 } : target.audio
  const organization = currentProgress
  const pulseStrength =
    (props.sessionState === 'playing' ? 0.7 : 0.2) * (1 - organization * 0.34) + audio.low * 0.35
  const breath = Math.sin(elapsedTime * mode.breathRate * Math.PI * 2) * 0.012 * pulseStrength
  const resetSoftness = currentReset * 0.05

  root.scale.setScalar(1 + breath + currentWave * 0.012 - resetSoftness)
  root.position.y = mode.verticalDrift * Math.sin(elapsedTime * 0.65)
  root.rotation.z = Math.sin(elapsedTime * 0.23) * (0.018 + (1 - organization) * 0.025)

  if (membrane && veil) {
    const deformation = mode.deformation * (1 - currentReset * 0.24)

    for (const layer of [membrane, veil]) {
      layer.material.uniforms.uTime!.value = elapsedTime
      layer.material.uniforms.uProgress!.value = organization
      layer.material.uniforms.uDeformation!.value = deformation
      layer.material.uniforms.uPulse!.value = currentWave * 0.7 + currentCompletion * 0.42
      layer.material.uniforms.uAudioLow!.value = audio.low
      layer.material.uniforms.uAudioMid!.value = audio.mid
      layer.material.uniforms.uFineEnergy!.value = audio.high
      layer.material.uniforms.uBrightness!.value = mode.brightness
      layer.material.uniforms.uVerticalDrift!.value = mode.verticalDrift
      layer.material.uniforms.uColor!.value.copy(currentColor)
    }

    membrane.rotation.y += delta * mode.speed * currentMotion * 0.42
    membrane.rotation.x += delta * mode.speed * currentMotion * 0.11
    veil.rotation.y -= delta * mode.speed * currentMotion * 0.19
  }

  if (progressRing) {
    progressRing.material.uniforms.uProgress!.value = currentProgress
    progressRing.material.uniforms.uColor!.value.copy(currentColor)
  }

  orbitLayers.forEach((orbit, index) => {
    const phase = Number(orbit.userData.phase)
    const individuality = (1 - organization) * (index + 1) * 0.006
    const synchronizedSpeed = mode.speed * currentMotion * (0.13 + index * 0.014)

    orbit.rotation.z += delta * (synchronizedSpeed + individuality)
    orbit.rotation.x += Math.sin(elapsedTime * 0.21 + phase) * delta * individuality
    orbit.scale.setScalar(1 + (mode.orbitSpread - 1) * 0.16)
    orbit.material.color.copy(currentColor)
    orbit.material.opacity =
      Number(orbit.userData.baseOpacity) * mode.brightness * (0.88 + audio.high * 0.12)
  })

  if (orbitPoints) {
    orbitPoints.rotation.z -= delta * mode.speed * currentMotion * 0.09
    orbitPoints.material.color.copy(currentColor)
    orbitPoints.material.opacity =
      (0.16 + currentCompletion * 0.42 + audio.high * 0.08) * mode.brightness
  }

  if (waveRing) {
    const wavePhase = 1 - currentWave

    waveRing.scale.setScalar(0.92 + wavePhase * 0.3)
    waveRing.material.uniforms.uColor!.value.copy(currentColor)
    waveRing.material.uniforms.uOpacity!.value = currentWave * 0.34
  }

  if (completionRing) {
    const completionPhase = 1 - currentCompletion

    completionRing.scale.setScalar(0.88 + completionPhase * 0.46)
    completionRing.material.uniforms.uColor!.value.copy(currentColor)
    completionRing.material.uniforms.uOpacity!.value = currentCompletion * 0.48 * mode.brightness
  }

  renderer.render(scene, camera)
  animationFrame = window.requestAnimationFrame(updateFrame)
}

const startRenderer = () => {
  if (animationFrame !== undefined || disposed || !documentVisible || !renderer) return

  lastFrameTime = 0
  animationFrame = window.requestAnimationFrame(updateFrame)
}

const stopRenderer = () => {
  if (animationFrame === undefined) return

  window.cancelAnimationFrame(animationFrame)
  animationFrame = undefined
}

const handleVisibilityChange = () => {
  documentVisible = document.visibilityState !== 'hidden'

  if (documentVisible) {
    startRenderer()
    return
  }

  stopRenderer()
}

const updateReducedMotion = () => {
  reducedMotion.value = motionMedia?.matches ?? false

  if (renderMode.value !== 'static') {
    renderMode.value = selectNeuralCoreRenderMode({
      webglAvailable: true,
      reducedMotion: reducedMotion.value,
      lowCapability: isLowCapability,
    })
    updateSize()
  }
}

const handleContextLost = (event: Event) => {
  event.preventDefault()
  stopRenderer()
  renderMode.value = 'static'

  if (import.meta.env.DEV) {
    console.info('[Neural Core] WebGL context lost; using the CSS fallback.')
  }
}

const disposeScene = () => {
  stopRenderer()
  resizeObserver?.disconnect()
  resizeObserver = undefined
  motionMedia?.removeEventListener('change', updateReducedMotion)
  motionMedia = undefined
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  canvas.value?.removeEventListener('webglcontextlost', handleContextLost)

  scene?.traverse((object) => {
    if (object instanceof Mesh || object instanceof Line || object instanceof Points) {
      object.geometry.dispose()

      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => material.dispose())
    }
  })

  renderer?.dispose()
  renderer?.forceContextLoss()
  orbitLayers.length = 0
  renderer = undefined
  scene = undefined
  camera = undefined
  root = undefined
  membrane = undefined
  veil = undefined
  progressRing = undefined
  waveRing = undefined
  completionRing = undefined
  orbitPoints = undefined
}

watch(
  () => props.progress,
  (progress) => {
    target.progress = normalizeNeuralCoreValue(progress)
  },
)

watch(
  () => props.sessionState,
  (state) => {
    target.motion = resolveNeuralCoreMotionScale(state, reducedMotion.value)
  },
)

watch(
  () => props.accentColor,
  (color) => {
    targetColor.set(normalizeModeColor(color))
  },
)

watch(
  () => props.audioBands,
  (bands) => {
    target.audio = normalizeAudioBands(bands)
  },
  { deep: true },
)

watch(
  () => props.resetSignal,
  () => {
    target.reset = 1
  },
)

watch(
  () => props.waveSignal,
  () => {
    target.wave = 1
  },
)

watch(
  () => props.completionSignal,
  () => {
    target.completion = 1
  },
)

onMounted(() => {
  const hardwareConcurrency = navigator.hardwareConcurrency || 4
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches

  documentVisible = document.visibilityState !== 'hidden'
  isLowCapability = hardwareConcurrency <= 4 || coarsePointer || window.innerWidth < 768
  motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionMedia.matches
  motionMedia.addEventListener('change', updateReducedMotion)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  canvas.value?.addEventListener('webglcontextlost', handleContextLost)

  try {
    const webglAvailable = createScene()

    renderMode.value = selectNeuralCoreRenderMode({
      webglAvailable,
      reducedMotion: reducedMotion.value,
      lowCapability: isLowCapability,
    })

    if (!webglAvailable) {
      if (import.meta.env.DEV) {
        console.info('[Neural Core] WebGL is unavailable; using the CSS fallback.')
      }
      return
    }

    resizeObserver = new ResizeObserver(updateSize)

    if (container.value) resizeObserver.observe(container.value)
    updateSize()
    startRenderer()
  } catch (error) {
    renderMode.value = 'static'
    disposeScene()

    if (import.meta.env.DEV) {
      console.info('[Neural Core] Renderer initialization failed; using the CSS fallback.', error)
    }
  }
})

onBeforeUnmount(() => {
  disposed = true
  disposeScene()
})
</script>

<template>
  <figure
    ref="container"
    class="neural-core"
    :class="[
      `neural-core--${renderMode}`,
      `neural-core--${modeKey}`,
      {
        'neural-core--panel-expanded': panelExpanded,
        'neural-core--reduced-motion': reducedMotion,
      },
    ]"
    :style="fallbackStyle"
    :data-render-mode="renderMode"
    :data-session-state="sessionState"
    aria-hidden="true"
  >
    <canvas ref="canvas" class="neural-core__canvas" tabindex="-1" />
    <div class="neural-core__fallback">
      <span class="neural-core__fallback-progress" />
      <span class="neural-core__fallback-field" />
      <span class="neural-core__fallback-orbit neural-core__fallback-orbit--outer" />
      <span class="neural-core__fallback-orbit neural-core__fallback-orbit--inner" />
    </div>
  </figure>
</template>

<style scoped>
.neural-core {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: visible;
  margin: 0;
  pointer-events: none;
}

.neural-core__canvas,
.neural-core__fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.neural-core__canvas {
  opacity: 1;
  transition: opacity 320ms ease;
}

.neural-core__fallback {
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 320ms ease;
}

.neural-core--static .neural-core__canvas {
  opacity: 0;
}

.neural-core--static .neural-core__fallback {
  opacity: 1;
}

.neural-core__fallback-progress,
.neural-core__fallback-field,
.neural-core__fallback-orbit {
  position: absolute;
  border-radius: 999px;
}

.neural-core__fallback-progress {
  inset: 3.5%;
  background: conic-gradient(
    from -90deg,
    var(--neural-core-color) 0 var(--neural-core-progress),
    rgba(255, 255, 255, 0.08) var(--neural-core-progress) 360deg
  );
  mask: radial-gradient(circle, transparent 0 49%, black 49.4% 50%, transparent 50.4%);
  opacity: 0.72;
  transition: background 420ms ease;
}

.neural-core__fallback-field {
  width: 48%;
  aspect-ratio: 1;
  border: 1px solid color-mix(in srgb, var(--neural-core-color), transparent 66%);
  background:
    repeating-radial-gradient(
      ellipse at 48% 52%,
      transparent 0 8%,
      color-mix(in srgb, var(--neural-core-color), transparent 88%) 8.5% 9%,
      transparent 9.5% 15%
    ),
    radial-gradient(
      circle,
      color-mix(in srgb, var(--neural-core-color), transparent 88%),
      transparent 68%
    );
  filter: drop-shadow(0 0 1.2rem color-mix(in srgb, var(--neural-core-color), transparent 82%));
  transform: rotate(-8deg) scale(0.96);
}

.neural-core__fallback-orbit {
  border: 1px solid color-mix(in srgb, var(--neural-core-color), transparent 78%);
}

.neural-core__fallback-orbit--outer {
  width: 72%;
  height: 38%;
  transform: rotate(28deg);
}

.neural-core__fallback-orbit--inner {
  width: 58%;
  height: 32%;
  transform: rotate(-42deg);
}

.neural-core--minimal .neural-core__canvas {
  opacity: 0.82;
}

@media (max-width: 767px) {
  .neural-core__fallback-orbit--inner {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .neural-core__canvas,
  .neural-core__fallback,
  .neural-core__fallback-progress {
    transition: none;
  }

  .neural-core__fallback-field {
    filter: none;
  }
}
</style>
