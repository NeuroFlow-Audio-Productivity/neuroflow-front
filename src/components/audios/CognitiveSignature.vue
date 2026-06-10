<script setup lang="ts">
import { computed } from 'vue'

import {
  modeInkColor,
  modeRgbString,
  normalizeModeColor,
  type ModeSemanticKey,
} from '@/services/modeVisuals'

type SignatureVariant = 'mini' | 'large'

type SignaturePoint = {
  id: string
  x: number
  y: number
  opacity: number
  size: number
}

type SignatureConnection = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  opacity: number
  width: number
}

const props = defineProps<{
  modeKey: ModeSemanticKey
  color: string
  seed: string | number
  variant: SignatureVariant
}>()

const hashText = (value: string) =>
  Array.from(value).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    2166136261,
  )

const normalizedColor = computed(() => normalizeModeColor(props.color))
const signatureHash = computed(() =>
  hashText(`${props.modeKey}:${normalizedColor.value}:${String(props.seed)}`),
)

const channel = (shift: number, range: number, offset = 0) =>
  ((signatureHash.value >>> shift) % range) + offset

const signatureStyle = computed<Record<string, string>>(() => ({
  '--signature-color': normalizedColor.value,
  '--signature-rgb': modeRgbString(normalizedColor.value),
  '--signature-ink': modeInkColor(normalizedColor.value),
  '--signature-intensity': (0.7 + channel(0, 26) / 100).toFixed(2),
  '--signature-softness': (0.44 + channel(5, 18) / 100).toFixed(2),
  '--signature-delay': `-${channel(10, 2400) / 1000}s`,
  '--signature-phase': `${channel(13, 360)}deg`,
  '--signature-shift-x': `${channel(18, 18, -9)}%`,
  '--signature-shift-y': `${channel(23, 18, -9)}%`,
}))

const gradientId = computed(() => `cognitive-signature-gradient-${signatureHash.value}`)
const relaxMaskId = computed(() => `cognitive-signature-relax-mask-${signatureHash.value}`)
const sleepMaskId = computed(() => `cognitive-signature-sleep-mask-${signatureHash.value}`)

const boundedCoordinate = (value: number) => Math.min(106, Math.max(14, value))

const focusNeuralAnchors = [
  { x: 24, y: 27 },
  { x: 47, y: 22 },
  { x: 72, y: 28 },
  { x: 94, y: 43 },
  { x: 80, y: 62 },
  { x: 58, y: 53 },
  { x: 36, y: 65 },
  { x: 22, y: 86 },
  { x: 55, y: 92 },
  { x: 90, y: 88 },
] as const

const focusNeuralNodes = computed<SignaturePoint[]>(() =>
  focusNeuralAnchors.map((anchor, index) => ({
    id: 'focus-neuron-' + index,
    x: boundedCoordinate(anchor.x + ((signatureHash.value >>> (index * 3)) % 9) - 4),
    y: boundedCoordinate(anchor.y + ((signatureHash.value >>> (index * 3 + 2)) % 9) - 4),
    opacity: 0.58 + ((signatureHash.value >>> (index + 9)) % 24) / 100,
    size: 1.55 + ((signatureHash.value >>> (index + 13)) % 9) / 10,
  })),
)

const focusConnectionPairs = [
  [0, 1],
  [1, 2],
  [2, 3],
  [1, 5],
  [2, 5],
  [5, 4],
  [4, 3],
  [5, 6],
  [6, 7],
  [6, 8],
  [8, 9],
  [4, 9],
] as const

const focusNodeAt = (nodes: SignaturePoint[], index: number): SignaturePoint =>
  nodes[index] ?? { id: 'focus-fallback', x: 60, y: 60, opacity: 0.7, size: 2 }

const focusNeuralConnections = computed<SignatureConnection[]>(() => {
  const nodes = focusNeuralNodes.value

  return focusConnectionPairs.map(([from, to], index) => {
    const start = focusNodeAt(nodes, from)
    const end = focusNodeAt(nodes, to)

    return {
      id: 'focus-synapse-' + from + '-' + to,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      opacity: 0.2 + ((signatureHash.value >>> (index + 4)) % 18) / 100,
      width: 0.74 + ((signatureHash.value >>> (index + 12)) % 8) / 100,
    }
  })
})

const focusSignalPaths = computed(() => {
  const nodes = focusNeuralNodes.value
  const path = (indexes: number[]) =>
    indexes
      .map((index, pointIndex) => {
        const node = focusNodeAt(nodes, index)

        return (pointIndex === 0 ? 'M' : 'L') + node.x + ' ' + node.y
      })
      .join(' ')

  return [
    { id: 'signal-primary', d: path([0, 1, 5, 4, 9]) },
    { id: 'signal-secondary', d: path([2, 5, 6, 8]) },
  ]
})

const relaxOffset = computed(() => channel(3, 12, -6))
const relaxPaths = computed(() => {
  const offset = relaxOffset.value

  return [
    `M20 ${58 + offset} C32 ${30 - offset} 54 ${34 + offset} 62 ${52 - offset} C73 ${78 + offset} 92 ${72 - offset} 100 ${49 + offset}`,
    `M14 ${75 - offset} C28 ${58 + offset} 43 ${83 - offset} 58 ${66 + offset} C73 ${49 - offset} 88 ${63 + offset} 106 ${43 - offset}`,
    `M23 ${40 + offset} C40 ${51 - offset} 48 ${18 + offset} 66 ${31 - offset} C82 ${43 + offset} 86 ${29 - offset} 101 ${33 + offset}`,
  ]
})

const sleepParticles = computed<SignaturePoint[]>(() =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((index) => ({
    id: `sleep-${index}`,
    x: 16 + ((signatureHash.value >>> (index * 3)) % 88),
    y: 15 + ((signatureHash.value >>> (index * 4 + 3)) % 90),
    opacity: 0.32 + ((signatureHash.value >>> (index + 10)) % 28) / 100,
    size: 0.65 + ((signatureHash.value >>> (index + 14)) % 8) / 10,
  })),
)
</script>

<template>
  <figure
    class="cognitive-signature"
    :class="[`cognitive-signature--${modeKey}`, `cognitive-signature--${variant}`]"
    :style="signatureStyle"
    aria-hidden="true"
  >
    <svg class="cognitive-signature__svg" viewBox="0 0 120 120" focusable="false">
      <defs>
        <radialGradient :id="gradientId" cx="50%" cy="48%" r="68%">
          <stop offset="0%" stop-color="white" stop-opacity="0.22" />
          <stop offset="42%" stop-color="currentColor" stop-opacity="0.18" />
          <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
        </radialGradient>

        <mask :id="relaxMaskId">
          <rect width="120" height="120" fill="black" />
          <path
            d="M16 72 C26 32 50 28 62 50 C78 80 101 73 108 39 L108 108 L16 108 Z"
            fill="white"
          />
        </mask>

        <mask :id="sleepMaskId">
          <rect width="120" height="120" fill="black" />
          <circle cx="60" cy="60" r="52" fill="white" />
        </mask>
      </defs>

      <g v-if="modeKey === 'focus'" class="cognitive-signature__focus">
        <circle class="cognitive-signature__focus-field" cx="60" cy="58" r="45" />
        <line
          v-for="connection in focusNeuralConnections"
          :key="connection.id"
          class="cognitive-signature__focus-synapse"
          :x1="connection.x1"
          :y1="connection.y1"
          :x2="connection.x2"
          :y2="connection.y2"
          :opacity="connection.opacity"
          :stroke-width="connection.width"
        />
        <path
          v-for="signal in focusSignalPaths"
          :key="signal.id"
          class="cognitive-signature__focus-signal"
          :d="signal.d"
        />
        <circle
          v-for="node in focusNeuralNodes"
          :key="node.id"
          class="cognitive-signature__focus-node"
          :cx="node.x"
          :cy="node.y"
          :r="node.size"
          :opacity="node.opacity"
        />
        <circle
          v-for="node in focusNeuralNodes.slice(1, 5)"
          :key="node.id + '-pulse'"
          class="cognitive-signature__focus-node-pulse"
          :cx="node.x"
          :cy="node.y"
          :r="node.size + 2.6"
        />
      </g>

      <g v-else-if="modeKey === 'relax'" class="cognitive-signature__relax">
        <rect
          class="cognitive-signature__relax-field"
          width="120"
          height="120"
          :fill="`url(#${gradientId})`"
        />
        <g :mask="`url(#${relaxMaskId})`">
          <circle class="cognitive-signature__relax-core" cx="60" cy="60" r="48" />
          <circle
            class="cognitive-signature__relax-core cognitive-signature__relax-core--secondary"
            cx="43"
            cy="76"
            r="34"
          />
        </g>
        <path
          v-for="(path, index) in relaxPaths"
          :key="path"
          class="cognitive-signature__relax-contour"
          :class="`cognitive-signature__relax-contour--${index + 1}`"
          :d="path"
        />
      </g>

      <g v-else class="cognitive-signature__sleep" :mask="`url(#${sleepMaskId})`">
        <circle class="cognitive-signature__sleep-depth" cx="60" cy="60" r="42" />
        <g class="cognitive-signature__sleep-orbits">
          <ellipse class="cognitive-signature__sleep-orbit" cx="60" cy="60" rx="43" ry="17" />
          <ellipse
            class="cognitive-signature__sleep-orbit cognitive-signature__sleep-orbit--tilted"
            cx="60"
            cy="60"
            rx="34"
            ry="52"
          />
          <ellipse
            class="cognitive-signature__sleep-orbit cognitive-signature__sleep-orbit--inner"
            cx="60"
            cy="60"
            rx="24"
            ry="9"
          />
        </g>
        <circle class="cognitive-signature__sleep-center" cx="60" cy="60" r="2.8" />
        <circle
          v-for="particle in sleepParticles"
          :key="particle.id"
          class="cognitive-signature__sleep-particle"
          :cx="particle.x"
          :cy="particle.y"
          :r="particle.size"
          :opacity="particle.opacity"
        />
      </g>
    </svg>
  </figure>
</template>

<style scoped>
.cognitive-signature {
  position: relative;
  display: block;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  color: var(--signature-color);
  background:
    radial-gradient(circle at 50% 48%, rgba(var(--signature-rgb), 0.18), transparent 45%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.018)), #080d10;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 1rem 2.4rem rgba(0, 0, 0, 0.26);
  transform: translateZ(0);
}

.cognitive-signature--mini {
  width: 3.45rem;
  height: 3.45rem;
  border-radius: 10px;
}

.cognitive-signature--large {
  width: min(100%, 22rem);
  aspect-ratio: 1;
  justify-self: center;
  border-radius: 18px;
}

.cognitive-signature::before,
.cognitive-signature::after {
  position: absolute;
  inset: 0;
  content: '';
  pointer-events: none;
}

.cognitive-signature::before {
  background: radial-gradient(
    circle at calc(50% + var(--signature-shift-x)) calc(48% + var(--signature-shift-y)),
    rgba(var(--signature-rgb), calc(var(--signature-intensity) * 0.42)),
    transparent 50%
  );
  opacity: 0.9;
}

.cognitive-signature::after {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.11), transparent 26%),
    radial-gradient(circle at 50% 112%, rgba(0, 0, 0, 0.72), transparent 55%);
}

.cognitive-signature__svg {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
}

.cognitive-signature__focus {
  color: var(--signature-color);
}

.cognitive-signature--focus {
  background:
    radial-gradient(circle at 50% 50%, rgba(var(--signature-rgb), 0.16), transparent 44%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.012)), #060b0d;
}

.cognitive-signature__focus-field {
  fill: rgba(var(--signature-rgb), 0.075);
  opacity: var(--signature-intensity);
}

.cognitive-signature__focus-synapse,
.cognitive-signature__focus-signal {
  fill: none;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.cognitive-signature__focus-synapse {
  stroke: rgba(255, 255, 255, 0.5);
  filter: drop-shadow(0 0 0.24rem rgba(var(--signature-rgb), 0.36));
}

.cognitive-signature__focus-signal {
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-dasharray: 10 82;
  stroke-dashoffset: 0;
  opacity: 0.92;
  filter: drop-shadow(0 0 0.42rem rgba(var(--signature-rgb), 0.82));
  animation: cognitive-focus-signal 3.2s ease-in-out infinite;
  animation-delay: var(--signature-delay);
}

.cognitive-signature__focus-signal:nth-of-type(2n) {
  stroke-width: 1.25;
  stroke-dasharray: 7 68;
  opacity: 0.66;
  animation-duration: 4.6s;
}

.cognitive-signature__focus-node {
  fill: rgba(255, 255, 255, 0.9);
  stroke: rgba(var(--signature-rgb), 0.84);
  stroke-width: 0.75;
  filter: drop-shadow(0 0 0.34rem rgba(var(--signature-rgb), 0.78));
}

.cognitive-signature__focus-node-pulse {
  fill: none;
  stroke: rgba(var(--signature-rgb), 0.42);
  stroke-width: 0.75;
  transform-box: fill-box;
  transform-origin: center;
  animation: cognitive-focus-node-pulse 3.8s ease-out infinite;
  animation-delay: var(--signature-delay);
}

.cognitive-signature--mini .cognitive-signature__focus-signal {
  stroke-width: 2.35;
}

.cognitive-signature--mini .cognitive-signature__focus-node {
  stroke-width: 1.05;
}

.cognitive-signature--relax {
  background:
    radial-gradient(
      circle at calc(44% + var(--signature-shift-x)) 40%,
      rgba(var(--signature-rgb), 0.25),
      transparent 48%
    ),
    linear-gradient(155deg, rgba(var(--signature-rgb), 0.2), rgba(255, 255, 255, 0.025) 56%),
    #08100e;
}

.cognitive-signature__relax {
  transform-origin: center;
  animation: cognitive-relax-breathe 7.6s ease-in-out infinite;
  animation-delay: var(--signature-delay);
}

.cognitive-signature__relax-field {
  color: var(--signature-color);
  opacity: 0.84;
}

.cognitive-signature__relax-core {
  fill: rgba(var(--signature-rgb), 0.5);
  filter: blur(0.18rem);
  transform-origin: center;
}

.cognitive-signature__relax-core--secondary {
  fill: rgba(255, 255, 255, 0.11);
}

.cognitive-signature__relax-contour {
  fill: none;
  stroke: rgba(255, 255, 255, 0.54);
  stroke-linecap: round;
  stroke-width: 2;
  filter: drop-shadow(0 0 0.38rem rgba(var(--signature-rgb), 0.54));
  opacity: var(--signature-softness);
}

.cognitive-signature__relax-contour--2 {
  stroke: rgba(var(--signature-rgb), 0.82);
  stroke-width: 1.55;
}

.cognitive-signature__relax-contour--3 {
  stroke-width: 1.1;
  opacity: 0.32;
}

.cognitive-signature--sleep {
  background:
    radial-gradient(circle at 50% 52%, rgba(var(--signature-rgb), 0.24), transparent 38%),
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.045), transparent 64%), #05070d;
}

.cognitive-signature__sleep-depth {
  fill: rgba(var(--signature-rgb), 0.1);
  stroke: rgba(var(--signature-rgb), 0.26);
  stroke-width: 0.8;
}

.cognitive-signature__sleep-orbits {
  transform-box: fill-box;
  transform-origin: center;
  animation: cognitive-sleep-drift 15s linear infinite;
  animation-delay: var(--signature-delay);
}

.cognitive-signature__sleep-orbit {
  fill: none;
  stroke: rgba(255, 255, 255, 0.5);
  stroke-width: 1.15;
  vector-effect: non-scaling-stroke;
}

.cognitive-signature__sleep-orbit--tilted {
  stroke: rgba(var(--signature-rgb), 0.55);
  transform: rotate(var(--signature-phase));
  transform-origin: center;
}

.cognitive-signature__sleep-orbit--inner {
  stroke: rgba(255, 255, 255, 0.28);
  stroke-width: 0.8;
}

.cognitive-signature__sleep-center,
.cognitive-signature__sleep-particle {
  fill: rgba(255, 255, 255, 0.86);
  filter: drop-shadow(0 0 0.45rem rgba(var(--signature-rgb), 0.78));
}

.cognitive-signature__sleep-particle {
  animation: cognitive-sleep-particle 6.4s ease-in-out infinite;
  animation-delay: var(--signature-delay);
}

.cognitive-signature--mini .cognitive-signature__relax-contour,
.cognitive-signature--mini .cognitive-signature__sleep-orbit {
  stroke-width: 2.7;
}

@keyframes cognitive-focus-signal {
  0%,
  100% {
    stroke-dashoffset: 82;
    opacity: 0.36;
  }

  45%,
  62% {
    opacity: 1;
  }

  100% {
    stroke-dashoffset: -20;
  }
}

@keyframes cognitive-focus-node-pulse {
  0%,
  100% {
    transform: scale(0.72);
    opacity: 0;
  }

  48% {
    transform: scale(1);
    opacity: 0.72;
  }
}

@keyframes cognitive-relax-breathe {
  0%,
  100% {
    transform: scale(0.985) translateX(var(--signature-shift-x));
    opacity: 0.78;
  }

  50% {
    transform: scale(1.025) translateY(var(--signature-shift-y));
    opacity: 1;
  }
}

@keyframes cognitive-sleep-drift {
  to {
    transform: rotate(360deg);
  }
}

@keyframes cognitive-sleep-particle {
  0%,
  100% {
    opacity: 0.36;
  }

  50% {
    opacity: 0.78;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cognitive-signature__focus-signal,
  .cognitive-signature__focus-node-pulse,
  .cognitive-signature__relax,
  .cognitive-signature__sleep-orbits,
  .cognitive-signature__sleep-particle {
    animation: none;
  }
}
</style>
