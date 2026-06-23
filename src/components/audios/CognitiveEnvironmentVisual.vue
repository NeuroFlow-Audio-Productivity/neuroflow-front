<script setup lang="ts">
import { computed, useId } from 'vue'

import { modeRgbString, normalizeModeColor } from '@/services/modeVisuals'

type FlowNode = {
  id: string
  x: number
  y: number
  radius: number
  driftX: number
  driftY: number
  duration: number
  delay: number
}

type CognitiveEnvironmentVisualVariant = 'preview' | 'thumbnail'

const props = withDefaults(
  defineProps<{
    color: string
    seed: string | number
    selected: boolean
    className?: string
    variant?: CognitiveEnvironmentVisualVariant
  }>(),
  { variant: 'preview' },
)

const instanceId = useId().replace(/[^a-z0-9_-]/gi, '')

const hashText = (value: string) =>
  Array.from(value).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    2166136261,
  )

const normalizedColor = computed(() => normalizeModeColor(props.color))
const visualHash = computed(() => hashText(`${String(props.seed)}:${normalizedColor.value}`))

const channel = (shift: number, range: number, offset = 0) =>
  ((visualHash.value >>> shift) % range) + offset

const complementaryColor = computed(() => {
  const color = normalizedColor.value
  const complement = [1, 3, 5]
    .map((start) => (255 - Number.parseInt(color.slice(start, start + 2), 16)).toString(16).padStart(2, '0'))
    .join('')

  return `#${complement}`
})

const visualStyle = computed<Record<string, string>>(() => ({
  '--flow-color': normalizedColor.value,
  '--flow-rgb': modeRgbString(normalizedColor.value),
  '--flow-complement': complementaryColor.value,
  '--flow-tilt': `${channel(2, 22, -11)}deg`,
  '--flow-orbit-duration': `${channel(7, 9, 26)}s`,
  '--flow-inner-orbit-duration': `${(channel(7, 9, 26) * 1.22).toFixed(1)}s`,
  '--flow-breathe-duration': `${(channel(12, 20, 72) / 10).toFixed(1)}s`,
  '--flow-pulse-duration': `${((channel(12, 20, 72) / 10) * 0.68).toFixed(1)}s`,
  '--flow-phase': `-${(channel(17, 48) / 10).toFixed(1)}s`,
  '--flow-glow-x': `${channel(22, 18, 41)}%`,
  '--flow-glow-y': `${channel(26, 14, 42)}%`,
}))

const gradientId = computed(() => `neuroflow-core-gradient-${instanceId}-${visualHash.value}`)
const veilGradientId = computed(() => `neuroflow-core-veil-${instanceId}-${visualHash.value}`)

const curveShift = computed(() => channel(4, 19, -9))
const neuralPaths = computed(() => {
  const shift = curveShift.value

  return [
    {
      id: 'upper-flow',
      d: `M34 124 C52 ${72 + shift} 91 ${62 - shift} 119 101 C143 ${131 + shift} 173 ${92 - shift} 207 115`,
      duration: 6.4 + channel(9, 18) / 10,
      delay: -(channel(13, 30) / 10),
    },
    {
      id: 'lower-flow',
      d: `M39 157 C72 ${191 - shift} 95 ${174 + shift} 118 139 C145 ${105 - shift} 172 ${150 + shift} 202 139`,
      duration: 7.2 + channel(15, 22) / 10,
      delay: -(channel(19, 34) / 10),
    },
    {
      id: 'vertical-flow',
      d: `M83 43 C112 ${67 + shift} 86 ${100 - shift} 114 124 C146 ${151 + shift} 128 ${178 - shift} 159 202`,
      duration: 8 + channel(21, 20) / 10,
      delay: -(channel(25, 38) / 10),
    },
  ]
})

const nodeAnchors = [
  { x: 55, y: 101 },
  { x: 84, y: 73 },
  { x: 116, y: 102 },
  { x: 151, y: 111 },
  { x: 183, y: 102 },
  { x: 73, y: 164 },
  { x: 113, y: 141 },
  { x: 151, y: 159 },
  { x: 174, y: 143 },
] as const

const flowNodes = computed<FlowNode[]>(() =>
  nodeAnchors.map((anchor, index) => ({
    id: `flow-node-${index}`,
    x: anchor.x + ((visualHash.value >>> (index * 2)) % 9) - 4,
    y: anchor.y + ((visualHash.value >>> (index * 2 + 3)) % 9) - 4,
    radius: 1.5 + ((visualHash.value >>> (index + 8)) % 8) / 10,
    driftX: ((visualHash.value >>> (index + 12)) % 9) - 4,
    driftY: ((visualHash.value >>> (index + 17)) % 9) - 4,
    duration: 6 + ((visualHash.value >>> (index + 20)) % 28) / 10,
    delay: -(((visualHash.value >>> (index + 24)) % 42) / 10),
  })),
)
</script>

<template>
  <figure
    class="cognitive-environment-visual"
    :class="[
      className,
      {
        'cognitive-environment-visual--preview': variant === 'preview',
        'cognitive-environment-visual--thumbnail': variant === 'thumbnail',
        'cognitive-environment-visual--selected': selected,
      },
    ]"
    :style="visualStyle"
    :data-visual-seed="visualHash"
    :data-environment-color="normalizedColor"
    aria-hidden="true"
  >
    <div class="cognitive-environment-visual__aura" />

    <svg
      class="cognitive-environment-visual__svg"
      viewBox="0 0 240 240"
      focusable="false"
    >
      <defs>
        <radialGradient :id="gradientId" cx="50%" cy="48%" r="58%">
          <stop class="cognitive-environment-visual__core-stop--light" offset="0%" />
          <stop class="cognitive-environment-visual__core-stop--color" offset="42%" />
          <stop class="cognitive-environment-visual__core-stop--fade" offset="100%" />
        </radialGradient>
        <linearGradient :id="veilGradientId" x1="12%" y1="10%" x2="88%" y2="92%">
          <stop class="cognitive-environment-visual__veil-stop--start" offset="0%" />
          <stop class="cognitive-environment-visual__veil-stop--end" offset="100%" />
        </linearGradient>
      </defs>

      <circle
        class="cognitive-environment-visual__veil"
        cx="120"
        cy="120"
        r="99"
        :fill="`url(#${veilGradientId})`"
      />

      <g class="cognitive-environment-visual__outer-orbit">
        <ellipse cx="120" cy="120" rx="91" ry="49" />
        <ellipse cx="120" cy="120" rx="78" ry="101" />
        <circle class="cognitive-environment-visual__orbital-dot" cx="29" cy="120" r="2.4" />
        <circle class="cognitive-environment-visual__orbital-dot" cx="172" cy="37" r="1.7" />
      </g>

      <g class="cognitive-environment-visual__inner-orbit">
        <ellipse cx="120" cy="120" rx="67" ry="31" />
        <circle class="cognitive-environment-visual__orbital-dot" cx="187" cy="120" r="2" />
      </g>

      <g class="cognitive-environment-visual__neural-field">
        <path
          v-for="path in neuralPaths"
          :key="`${path.id}-connection`"
          class="cognitive-environment-visual__connection"
          :d="path.d"
          :style="{
            '--connection-delay': `${path.delay}s`,
            '--connection-duration': `${path.duration + 2.8}s`,
          }"
        />
        <path
          v-for="path in neuralPaths"
          :key="`${path.id}-impulse`"
          class="cognitive-environment-visual__impulse"
          :d="path.d"
          pathLength="100"
          :style="{
            '--impulse-delay': `${path.delay}s`,
            '--impulse-duration': `${path.duration}s`,
          }"
        />
      </g>

      <g class="cognitive-environment-visual__nodes">
        <circle
          v-for="node in flowNodes"
          :key="node.id"
          class="cognitive-environment-visual__node"
          :cx="node.x"
          :cy="node.y"
          :r="node.radius"
          :style="{
            '--node-drift-x': `${node.driftX}px`,
            '--node-drift-y': `${node.driftY}px`,
            '--node-duration': `${node.duration}s`,
            '--node-delay': `${node.delay}s`,
          }"
        />
      </g>

      <g class="cognitive-environment-visual__core">
        <circle
          class="cognitive-environment-visual__core-halo"
          cx="120"
          cy="120"
          r="57"
          :fill="`url(#${gradientId})`"
        />
        <circle class="cognitive-environment-visual__core-ring cognitive-environment-visual__core-ring--outer" cx="120" cy="120" r="42" />
        <circle class="cognitive-environment-visual__core-ring cognitive-environment-visual__core-ring--inner" cx="120" cy="120" r="29" />

        <g class="cognitive-environment-visual__waveform">
          <path d="M82 120 C91 120 94 110 101 110 C108 110 109 132 118 132 C127 132 128 100 137 100 C146 100 148 121 158 121" />
          <path d="M88 128 C98 128 102 118 110 118 C119 118 121 139 130 139 C139 139 142 119 153 119" />
        </g>

        <circle class="cognitive-environment-visual__core-point" cx="120" cy="120" r="5" />
        <circle class="cognitive-environment-visual__core-point-pulse" cx="120" cy="120" r="9" />
      </g>
    </svg>
  </figure>
</template>

<style scoped>
.cognitive-environment-visual {
  position: relative;
  display: grid;
  width: min(100%, 22rem);
  aspect-ratio: 1;
  flex: 0 0 auto;
  place-items: center;
  justify-self: center;
  overflow: hidden;
  isolation: isolate;
  border: 1px solid color-mix(in srgb, var(--flow-color) 24%, rgba(255, 255, 255, 0.16));
  border-radius: 20px;
  background:
    radial-gradient(
      circle at var(--flow-glow-x) var(--flow-glow-y),
      color-mix(in srgb, var(--flow-color) 25%, transparent),
      transparent 48%
    ),
    linear-gradient(145deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.018)),
    #050a0d;
  box-shadow:
    0 1.8rem 4rem rgba(0, 0, 0, 0.34),
    0 0 3.4rem rgba(var(--flow-rgb), 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 0 3rem rgba(var(--flow-rgb), 0.055);
  transform: translateZ(0);
  transition:
    border-color 480ms ease,
    background 480ms ease,
    box-shadow 480ms ease;
}

.cognitive-environment-visual::before,
.cognitive-environment-visual::after {
  position: absolute;
  inset: 0;
  content: '';
  pointer-events: none;
}

.cognitive-environment-visual::before {
  z-index: -1;
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in srgb, var(--flow-color) 34%, white 6%),
    transparent 57%
  );
  opacity: 0.24;
  animation: neuroflow-surface-breathe var(--flow-breathe-duration) ease-in-out infinite;
  animation-delay: var(--flow-phase);
}

.cognitive-environment-visual::after {
  z-index: 3;
  border-radius: inherit;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.09), transparent 20%),
    radial-gradient(circle at 50% 112%, rgba(0, 0, 0, 0.72), transparent 54%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.025);
}

.cognitive-environment-visual--selected {
  border-color: color-mix(in srgb, var(--flow-color) 42%, rgba(255, 255, 255, 0.2));
  box-shadow:
    0 1.8rem 4rem rgba(0, 0, 0, 0.34),
    0 0 4rem rgba(var(--flow-rgb), 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.17),
    inset 0 0 3.5rem rgba(var(--flow-rgb), 0.08);
}

.cognitive-environment-visual--thumbnail {
  width: 3.45rem;
  border-radius: 10px;
  contain: layout paint;
  box-shadow:
    0 0.65rem 1.3rem rgba(0, 0, 0, 0.32),
    0 0 1.2rem rgba(var(--flow-rgb), 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.cognitive-environment-visual--thumbnail.cognitive-environment-visual--selected {
  box-shadow:
    0 0.65rem 1.3rem rgba(0, 0, 0, 0.32),
    0 0 1.45rem rgba(var(--flow-rgb), 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.17);
}

.cognitive-environment-visual--thumbnail::before {
  opacity: 0.34;
}

.cognitive-environment-visual--thumbnail .cognitive-environment-visual__aura {
  width: 74%;
  filter: blur(13px);
  opacity: 0.28;
}

.cognitive-environment-visual--thumbnail .cognitive-environment-visual__veil {
  opacity: 0.82;
}

.cognitive-environment-visual--thumbnail .cognitive-environment-visual__outer-orbit {
  opacity: 0.22;
}

.cognitive-environment-visual--thumbnail .cognitive-environment-visual__inner-orbit {
  opacity: 0.44;
}

.cognitive-environment-visual--thumbnail .cognitive-environment-visual__connection {
  stroke-width: 1.15;
}

.cognitive-environment-visual--thumbnail .cognitive-environment-visual__impulse {
  stroke-width: 2.8;
  filter: none;
}

.cognitive-environment-visual--thumbnail .cognitive-environment-visual__nodes {
  opacity: 0.78;
}

.cognitive-environment-visual--thumbnail .cognitive-environment-visual__core-ring--inner {
  display: none;
}

.cognitive-environment-visual--thumbnail .cognitive-environment-visual__waveform {
  stroke-width: 2;
  filter: none;
}

.cognitive-environment-visual--thumbnail .cognitive-environment-visual__core-point {
  filter: none;
}

.cognitive-environment-visual__aura {
  position: absolute;
  z-index: -1;
  width: 68%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: color-mix(in srgb, var(--flow-color) 72%, var(--flow-complement) 28%);
  filter: blur(52px);
  opacity: 0.2;
  animation: neuroflow-aura-breathe var(--flow-breathe-duration) ease-in-out infinite;
  animation-delay: var(--flow-phase);
  transition: background 480ms ease;
}

.cognitive-environment-visual__svg {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  color: var(--flow-color);
}

.cognitive-environment-visual__core-stop--light {
  stop-color: color-mix(in srgb, var(--flow-color) 25%, white);
  stop-opacity: 0.8;
}

.cognitive-environment-visual__core-stop--color {
  stop-color: var(--flow-color);
  stop-opacity: 0.32;
}

.cognitive-environment-visual__core-stop--fade {
  stop-color: var(--flow-color);
  stop-opacity: 0;
}

.cognitive-environment-visual__veil-stop--start {
  stop-color: color-mix(in srgb, var(--flow-color) 84%, white 16%);
  stop-opacity: 0.1;
}

.cognitive-environment-visual__veil-stop--end {
  stop-color: color-mix(in srgb, var(--flow-color) 70%, black 30%);
  stop-opacity: 0.015;
}

.cognitive-environment-visual__veil {
  stroke: rgba(var(--flow-rgb), 0.09);
  stroke-width: 0.7;
  transition:
    fill 480ms ease,
    stroke 480ms ease;
}

.cognitive-environment-visual__core-stop--light,
.cognitive-environment-visual__core-stop--color,
.cognitive-environment-visual__core-stop--fade,
.cognitive-environment-visual__veil-stop--start,
.cognitive-environment-visual__veil-stop--end,
.cognitive-environment-visual__outer-orbit,
.cognitive-environment-visual__inner-orbit,
.cognitive-environment-visual__orbital-dot,
.cognitive-environment-visual__node,
.cognitive-environment-visual__core-ring,
.cognitive-environment-visual__waveform,
.cognitive-environment-visual__core-point,
.cognitive-environment-visual__core-point-pulse {
  transition:
    fill 480ms ease,
    stroke 480ms ease,
    stop-color 480ms ease,
    filter 480ms ease;
}

.cognitive-environment-visual__outer-orbit,
.cognitive-environment-visual__inner-orbit {
  fill: none;
  stroke-linecap: round;
  transform-box: fill-box;
  transform-origin: center;
}

.cognitive-environment-visual__outer-orbit {
  stroke: color-mix(in srgb, var(--flow-color) 58%, white 14%);
  stroke-width: 0.72;
  stroke-dasharray: 3 8 22 11;
  opacity: 0.3;
  transform: rotate(var(--flow-tilt));
  animation: neuroflow-orbit var(--flow-orbit-duration) linear infinite;
  animation-delay: var(--flow-phase);
}

.cognitive-environment-visual__inner-orbit {
  stroke: color-mix(in srgb, var(--flow-color) 72%, var(--flow-complement) 28%);
  stroke-width: 0.62;
  stroke-dasharray: 2 10 16 8;
  opacity: 0.36;
  animation: neuroflow-orbit-reverse var(--flow-inner-orbit-duration) linear infinite;
  animation-delay: var(--flow-phase);
}

.cognitive-environment-visual__orbital-dot {
  fill: color-mix(in srgb, var(--flow-color) 38%, white);
  stroke: rgba(var(--flow-rgb), 0.5);
  stroke-width: 4;
  paint-order: stroke;
}

.cognitive-environment-visual__connection,
.cognitive-environment-visual__impulse {
  fill: none;
  stroke-linecap: round;
  transition:
    d 520ms cubic-bezier(0.22, 0.8, 0.24, 1),
    stroke 480ms ease;
  vector-effect: non-scaling-stroke;
}

.cognitive-environment-visual__connection {
  stroke: color-mix(in srgb, var(--flow-color) 54%, white 18%);
  stroke-width: 0.72;
  stroke-dasharray: 1 3;
  opacity: 0.28;
  animation: neuroflow-connection var(--connection-duration) ease-in-out infinite;
  animation-delay: var(--connection-delay);
}

.cognitive-environment-visual__impulse {
  stroke: color-mix(in srgb, var(--flow-color) 32%, white);
  stroke-width: 2.2;
  stroke-dasharray: 0.3 99.7;
  stroke-dashoffset: 100;
  opacity: 0.9;
  filter: drop-shadow(0 0 4px rgba(var(--flow-rgb), 0.88));
  animation: neuroflow-impulse var(--impulse-duration) linear infinite;
  animation-delay: var(--impulse-delay);
}

.cognitive-environment-visual__node {
  fill: color-mix(in srgb, var(--flow-color) 42%, white);
  stroke: rgba(var(--flow-rgb), 0.52);
  stroke-width: 4;
  opacity: 0.72;
  paint-order: stroke;
  transform-box: fill-box;
  transform-origin: center;
  animation: neuroflow-node-drift var(--node-duration) ease-in-out infinite;
  animation-delay: var(--node-delay);
}

.cognitive-environment-visual__core {
  transform-box: fill-box;
  transform-origin: center;
  animation: neuroflow-core-breathe var(--flow-breathe-duration) ease-in-out infinite;
  animation-delay: var(--flow-phase);
}

.cognitive-environment-visual__core-halo {
  opacity: 0.95;
}

.cognitive-environment-visual__core-ring {
  fill: none;
  vector-effect: non-scaling-stroke;
}

.cognitive-environment-visual__core-ring--outer {
  stroke: color-mix(in srgb, var(--flow-color) 74%, white 12%);
  stroke-width: 0.9;
  stroke-dasharray: 4 6 18 9;
  opacity: 0.52;
  transform-box: fill-box;
  transform-origin: center;
  animation: neuroflow-ring-drift 18s linear infinite;
}

.cognitive-environment-visual__core-ring--inner {
  stroke: color-mix(in srgb, var(--flow-color) 64%, var(--flow-complement) 20%);
  stroke-width: 0.7;
  stroke-dasharray: 2 5;
  opacity: 0.46;
}

.cognitive-environment-visual__waveform {
  fill: none;
  stroke: color-mix(in srgb, var(--flow-color) 28%, white);
  stroke-linecap: round;
  stroke-width: 1.25;
  opacity: 0.8;
  filter: drop-shadow(0 0 3px rgba(var(--flow-rgb), 0.72));
}

.cognitive-environment-visual__waveform path {
  stroke-dasharray: 12 8;
  animation: neuroflow-wave 8s ease-in-out infinite;
  animation-delay: var(--flow-phase);
}

.cognitive-environment-visual__waveform path:last-child {
  stroke-width: 0.7;
  opacity: 0.4;
  animation-direction: reverse;
  animation-duration: 10s;
}

.cognitive-environment-visual__core-point {
  fill: color-mix(in srgb, var(--flow-color) 18%, white);
  filter: drop-shadow(0 0 7px rgba(var(--flow-rgb), 0.95));
}

.cognitive-environment-visual__core-point-pulse {
  fill: none;
  stroke: rgba(var(--flow-rgb), 0.58);
  stroke-width: 1;
  transform-box: fill-box;
  transform-origin: center;
  animation: neuroflow-point-pulse var(--flow-pulse-duration) ease-out infinite;
  animation-delay: var(--flow-phase);
}

@keyframes neuroflow-surface-breathe {
  0%,
  100% {
    transform: scale(0.94);
    opacity: 0.17;
  }

  50% {
    transform: scale(1.06);
    opacity: 0.32;
  }
}

@keyframes neuroflow-aura-breathe {
  0%,
  100% {
    transform: scale(0.86);
    opacity: 0.14;
  }

  50% {
    transform: scale(1.1);
    opacity: 0.27;
  }
}

@keyframes neuroflow-orbit {
  to {
    transform: rotate(calc(360deg + var(--flow-tilt)));
  }
}

@keyframes neuroflow-orbit-reverse {
  to {
    transform: rotate(-360deg);
  }
}

@keyframes neuroflow-connection {
  0%,
  100% {
    stroke-dashoffset: 0;
    opacity: 0.12;
  }

  38%,
  68% {
    stroke-dashoffset: -10;
    opacity: 0.42;
  }
}

@keyframes neuroflow-impulse {
  0% {
    stroke-dashoffset: 100;
    opacity: 0;
  }

  12%,
  78% {
    opacity: 0.92;
  }

  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}

@keyframes neuroflow-node-drift {
  0%,
  100% {
    transform: translate(0, 0) scale(0.92);
    opacity: 0.52;
  }

  50% {
    transform: translate(var(--node-drift-x), var(--node-drift-y)) scale(1.08);
    opacity: 0.9;
  }
}

@keyframes neuroflow-core-breathe {
  0%,
  100% {
    transform: scale(0.965);
    opacity: 0.86;
  }

  50% {
    transform: scale(1.035);
    opacity: 1;
  }
}

@keyframes neuroflow-ring-drift {
  to {
    transform: rotate(360deg);
  }
}

@keyframes neuroflow-wave {
  0%,
  100% {
    stroke-dashoffset: 20;
    opacity: 0.54;
  }

  50% {
    stroke-dashoffset: -20;
    opacity: 1;
  }
}

@keyframes neuroflow-point-pulse {
  0% {
    transform: scale(0.62);
    opacity: 0.78;
  }

  78%,
  100% {
    transform: scale(1.75);
    opacity: 0;
  }
}

@media (max-width: 760px) {
  .cognitive-environment-visual--preview {
    width: min(76vw, 16.5rem);
    border-radius: 17px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cognitive-environment-visual * {
    transition: none !important;
  }
  .cognitive-environment-visual,
  .cognitive-environment-visual__aura,
  .cognitive-environment-visual__veil {
    transition: none;
  }

  .cognitive-environment-visual::before,
  .cognitive-environment-visual__aura,
  .cognitive-environment-visual__outer-orbit,
  .cognitive-environment-visual__inner-orbit,
  .cognitive-environment-visual__connection,
  .cognitive-environment-visual__impulse,
  .cognitive-environment-visual__node,
  .cognitive-environment-visual__core,
  .cognitive-environment-visual__core-ring--outer,
  .cognitive-environment-visual__waveform path,
  .cognitive-environment-visual__core-point-pulse {
    animation: none;
  }

  .cognitive-environment-visual__impulse {
    stroke-dashoffset: 56;
    opacity: 0.62;
  }

  .cognitive-environment-visual__core-point-pulse {
    opacity: 0.3;
  }
}
</style>
