import * as THREE from "three";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { buildBrandMarkGeometry } from "@/lib/aresLogoGeometry";
import { sampleLogoMorph } from "@/lib/logoMorphMotion";
import { createOrbitalMist } from "@/lib/orbitalMist";

const SURFACE_VERTEX = `
  varying vec3 vNormalW;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vView = cameraPosition - world.xyz;
    vLocal = position;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const SURFACE_FRAGMENT = `
  uniform float uTime;
  uniform float uIntro;
  uniform float uOpacity;
  varying vec3 vNormalW;
  varying vec3 vView;
  varying vec3 vLocal;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vView))), 2.3);
    float grain = hash(floor(vLocal * 95.0));
    float reveal = smoothstep(grain * 0.65, grain * 0.65 + 0.3, uIntro);
    float glint = pow(0.5 + 0.5 * sin(vLocal.y * 4.0 + vLocal.x * 2.0 - uTime * 0.5), 12.0);
    vec3 white = vec3(0.82 + rim * 0.8 + glint * 0.22);
    float alpha = (0.012 + rim * 0.4 + glint * rim * 0.15) * uOpacity * reveal;
    gl_FragColor = vec4(white, alpha);
  }
`;

const PARTICLE_VERTEX = `
  attribute vec3 aBody;
  attribute float aSeed;
  uniform mat4 uLogoMatrix;
  uniform float uTime;
  uniform float uMorph;
  uniform float uIntro;
  uniform float uPixelRatio;
  uniform float uMotion;
  varying float vGlow;
  void main() {
    vec3 logo = (uLogoMatrix * vec4(position, 1.0)).xyz;
    float delay = aSeed * 0.12;
    float blend = smoothstep(delay, 0.86 + delay, uMorph);
    float release = sin(blend * 3.14159265);
    float angle = aSeed * 62.83 + uTime * 0.24 * uMotion + blend * 3.0;
    vec3 curl = vec3(cos(angle), sin(angle * 0.7), sin(angle));
    vec3 pos = mix(logo, aBody, blend);
    pos += curl * release * (0.15 + aSeed * 0.27);
    pos += curl * (1.0 - uIntro) * (0.4 + aSeed * 0.55);
    pos += vec3(sin(uTime * 0.55 + aSeed * 20.0), cos(uTime * 0.4 + aSeed * 31.0), 0.0)
      * 0.006 * (1.0 - blend) * uMotion;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp((1.2 + aSeed * 1.7 + release * 1.5) * uPixelRatio / max(0.65, -mv.z), 0.8, 5.0 * uPixelRatio);
    vGlow = (0.25 + aSeed * 0.65) * smoothstep(aSeed * 0.5, aSeed * 0.5 + 0.5, uIntro);
  }
`;

const PARTICLE_FRAGMENT = `
  uniform float uOpacity;
  varying float vGlow;
  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    if (radius > 1.0) discard;
    float halo = exp(-radius * radius * 5.0);
    gl_FragColor = vec4(vec3(1.0), halo * vGlow * uOpacity);
  }
`;

/** The emblem, mist and migrating points share BioTwin's camera and postprocessing. */
export function createCosmicLogoTransition(particleCount: number, pixelRatio: number) {
  const group = new THREE.Group();
  const emblem = new THREE.Group();
  group.add(emblem);
  const geometries = buildBrandMarkGeometry();
  const surfaceMaterial = new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERTEX, fragmentShader: SURFACE_FRAGMENT,
    uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uOpacity: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const edgeGeometries = geometries.map((geometry) => new THREE.EdgesGeometry(geometry, 35));
  geometries.forEach((geometry, index) => {
    emblem.add(new THREE.Mesh(geometry, surfaceMaterial));
    emblem.add(new THREE.LineSegments(edgeGeometries[index], edgeMaterial));
  });

  const samplers = geometries.map((geometry) => new MeshSurfaceSampler(new THREE.Mesh(geometry, surfaceMaterial)).build());
  const source = new Float32Array(particleCount * 3);
  const seeds = new Float32Array(particleCount);
  const point = new THREE.Vector3();
  for (let i = 0; i < particleCount; i++) {
    const part = i % geometries.length;
    if (i % 4 === 0) {
      samplers[part].sample(point);
    } else {
      const edges = edgeGeometries[part].getAttribute("position");
      const offset = (Math.floor(i / 3) % (edges.count / 2)) * 2;
      point.fromBufferAttribute(edges, offset);
      point.lerp(new THREE.Vector3().fromBufferAttribute(edges, offset + 1), Math.random());
    }
    point.toArray(source, i * 3);
    seeds[i] = Math.random();
  }
  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute("position", new THREE.BufferAttribute(source, 3));
  particlesGeometry.setAttribute("aBody", new THREE.BufferAttribute(source.slice(), 3));
  particlesGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const particleMaterial = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERTEX, fragmentShader: PARTICLE_FRAGMENT,
    uniforms: {
      uLogoMatrix: { value: new THREE.Matrix4() }, uTime: { value: 0 }, uMorph: { value: 0 },
      uIntro: { value: 0 }, uOpacity: { value: 0 }, uPixelRatio: { value: pixelRatio }, uMotion: { value: 1 },
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(particlesGeometry, particleMaterial);
  // Morphing happens in the shader, outside the source geometry's original bounds.
  particles.frustumCulled = false;
  particles.renderOrder = 12;
  group.add(particles);

  const orbitalMist = createOrbitalMist(particleCount < 4000 ? 240 : 480, pixelRatio, particleCount < 4000);
  group.add(orbitalMist.group);
  let bodyReady = false;

  return {
    group,
    setBodyGeometry(geometry: THREE.BufferGeometry) {
      const sampler = new MeshSurfaceSampler(new THREE.Mesh(geometry, surfaceMaterial)).build();
      const targets = particlesGeometry.getAttribute("aBody") as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        sampler.sample(point);
        targets.setXYZ(i, point.x, point.y, point.z);
      }
      targets.needsUpdate = true;
      bodyReady = true;
    },
    update(progress: number, elapsed: number, camera: THREE.Camera, rotation: THREE.Quaternion, reducedMotion: boolean) {
      const state = sampleLogoMorph(progress, elapsed, reducedMotion);
      group.visible = state.mist > 0.001 || state.particles > 0.001;
      if (!group.visible) return;
      group.quaternion.copy(rotation);
      const time = reducedMotion ? 0 : elapsed;
      emblem.position.set(0, 0.16 + state.drop, 0);
      emblem.scale.setScalar(0.64);
      emblem.rotation.set(-0.07 + Math.sin(time * 0.3) * 0.06, -0.2 + time * 0.38, Math.sin(time * 0.2) * 0.025);
      emblem.updateMatrix();
      surfaceMaterial.uniforms.uTime.value = time;
      surfaceMaterial.uniforms.uIntro.value = state.intro;
      surfaceMaterial.uniforms.uOpacity.value = state.shell;
      edgeMaterial.opacity = state.shell * 0.34;
      particleMaterial.uniforms.uLogoMatrix.value.copy(emblem.matrix);
      particleMaterial.uniforms.uTime.value = time;
      particleMaterial.uniforms.uIntro.value = state.intro;
      particleMaterial.uniforms.uOpacity.value = state.particles * 0.75;
      particleMaterial.uniforms.uMorph.value = bodyReady ? state.morph : 0;
      particleMaterial.uniforms.uMotion.value = reducedMotion ? 0 : 1;
      orbitalMist.update(time, state.intro, state.mist, state.morph, 0.16 + state.drop, camera);
    },
  };
}
