import * as THREE from "three";

type Star = [number, number];
type Pattern = { center: Star; stars: Star[]; links: Array<[number, number]> };

// Loose celestial figures: a hunter, a harp, a swan, a crown and a winding dragon.
// These are decorative asterisms, rather than a geographical sky chart.
const PATTERNS: Pattern[] = [
  { center: [0.84, 0.55], stars: [[-.7,.9],[.55,.8],[-.3,.1],[0,0],[.3,-.1],[-.55,-.9],[.65,-.75]], links: [[0,2],[1,4],[2,3],[3,4],[2,5],[4,6],[0,1]] },
  { center: [-0.84, 0.62], stars: [[-.5,.6],[.3,.35],[.65,-.5],[-.25,-.65]], links: [[0,1],[1,2],[2,3],[3,0],[1,3]] },
  { center: [-0.84, -0.5], stars: [[0,.85],[0,.2],[-.8,-.05],[.75,-.15],[.1,-.9]], links: [[0,1],[1,2],[1,3],[1,4]] },
  { center: [0.84, -0.52], stars: [[-.9,-.1],[-.65,.45],[-.2,.7],[.3,.65],[.7,.3],[.85,-.15]], links: [[0,1],[1,2],[2,3],[3,4],[4,5]] },
  { center: [-0.83, 0.06], stars: [[-.6,-.9],[-.2,-.4],[-.45,.15],[.15,.5],[.65,.25],[.8,.8],[.35,1.1],[.05,.85]], links: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,3]] },
];

const STAR_VERTEX = `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uAspect;
  attribute float aSize;
  attribute float aPhase;
  attribute vec2 aCenter;
  attribute float aPatterned;
  varying float vLight;
  varying float vPatterned;
  varying vec2 vScreen;
  void main() {
    vLight = 0.72 + 0.20*sin(uTime*0.4+aPhase);
    vPatterned = aPatterned;
    vec2 pos = mix(position.xy,aCenter+position.xy*vec2(0.13,0.13*uAspect),aPatterned);
    gl_Position = vec4(pos,0.999,1.0);
    vScreen = pos*0.5+0.5;
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const STAR_FRAGMENT = `
  uniform vec4 uBodyBounds;
  varying float vLight;
  varying float vPatterned;
  varying vec2 vScreen;
  void main() {
    float r = length(gl_PointCoord-0.5);
    float core = 1.0-smoothstep(0.20,0.5,r);
    float outside = max(max(uBodyBounds.x-vScreen.x,vScreen.x-uBodyBounds.z),max(uBodyBounds.y-vScreen.y,vScreen.y-uBodyBounds.w));
    float clearance = mix(1.0,smoothstep(0.012,0.035,outside),vPatterned);
    gl_FragColor = vec4(vec3(0.92,0.96,1.0),core*vLight*clearance);
  }
`;

const LINE_VERTEX = `
  uniform float uAspect;
  attribute float aPattern;
  attribute float aOrder;
  attribute vec2 aCenter;
  varying float vPattern;
  varying float vOrder;
  varying vec2 vScreen;
  void main() {
    vPattern = aPattern;
    vOrder = aOrder;
    gl_Position = vec4(aCenter+position.xy*vec2(0.13,0.13*uAspect),0.999,1.0);
    vScreen = gl_Position.xy/gl_Position.w*0.5+0.5;
  }
`;

const LINE_FRAGMENT = `
  uniform float uTime;
  uniform float uStill;
  uniform vec4 uBodyBounds;
  varying float vPattern;
  varying float vOrder;
  varying vec2 vScreen;
  void main() {
    // Each figure slowly draws, rests, then disappears; neighbouring figures overlap briefly.
    float cycle = mod(uTime + 6.0 - vPattern*6.4 + 32.0,32.0);
    float draw = smoothstep(vOrder*2.6,vOrder*2.6+1.8,cycle);
    float fade = 1.0-smoothstep(8.0,12.0,cycle);
    float alpha = mix(draw*fade*0.28,0.07,uStill);
    // Screen-edge figures never draw across the projected anatomical envelope.
    float outside = max(max(uBodyBounds.x-vScreen.x,vScreen.x-uBodyBounds.z),max(uBodyBounds.y-vScreen.y,vScreen.y-uBodyBounds.w));
    alpha *= smoothstep(0.012,0.035,outside);
    gl_FragColor = vec4(vec3(0.72,0.81,0.9),alpha);
  }
`;

export function createConstellationField(pixelRatio: number, bodyBounds: THREE.Vector4) {
  const group = new THREE.Group();
  const positions: number[] = [];
  const sizes: number[] = [];
  const phases: number[] = [];
  const starCenters: number[] = [];
  const patterned: number[] = [];
  const linePositions: number[] = [];
  const patternIds: number[] = [];
  const lineOrders: number[] = [];
  const lineCenters: number[] = [];
  const random = (seed: number) => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const addStar = (x: number, y: number, size: number, center?: Star) => {
    positions.push(x, y, 0);
    sizes.push(size);
    phases.push(random(positions.length) * Math.PI * 2);
    starCenters.push(...(center ?? [0,0]));
    patterned.push(center ? 1 : 0);
  };
  PATTERNS.forEach((pattern, index) => {
    pattern.stars.forEach(([x,y]) => addStar(x,y,3.6,pattern.center));
    pattern.links.forEach(([from,to], order) => {
      [from,to].forEach((star, endpoint) => {
        const [x,y] = pattern.stars[star];
        linePositions.push(x,y,0);
        lineCenters.push(...pattern.center);
        patternIds.push(index);
        lineOrders.push((order+endpoint)/pattern.links.length);
      });
    });
  });

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  starGeometry.setAttribute("aSize",new THREE.Float32BufferAttribute(sizes,1));
  starGeometry.setAttribute("aPhase",new THREE.Float32BufferAttribute(phases,1));
  starGeometry.setAttribute("aCenter",new THREE.Float32BufferAttribute(starCenters,2));
  starGeometry.setAttribute("aPatterned",new THREE.Float32BufferAttribute(patterned,1));
  const time = { value: 0 };
  const still = { value: 0 };
  const aspect = { value: 1 };
  const envelope = { value: bodyBounds };
  const starMaterial = new THREE.ShaderMaterial({
    vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT,
    uniforms: { uTime: time, uPixelRatio: { value: pixelRatio }, uAspect: aspect, uBodyBounds: envelope },
    transparent: true, depthWrite: false, fog: false,
  });
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position",new THREE.Float32BufferAttribute(linePositions,3));
  lineGeometry.setAttribute("aPattern",new THREE.Float32BufferAttribute(patternIds,1));
  lineGeometry.setAttribute("aOrder",new THREE.Float32BufferAttribute(lineOrders,1));
  lineGeometry.setAttribute("aCenter",new THREE.Float32BufferAttribute(lineCenters,2));
  const lineMaterial = new THREE.ShaderMaterial({
    vertexShader: LINE_VERTEX, fragmentShader: LINE_FRAGMENT,
    uniforms: { uTime: time, uStill: still, uAspect: aspect, uBodyBounds: envelope },
    transparent: true, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(starGeometry,starMaterial);
  const lines = new THREE.LineSegments(lineGeometry,lineMaterial);
  stars.frustumCulled = lines.frustumCulled = false;
  group.add(stars,lines);

  return {
    group,
    update(elapsed: number, reducedMotion: boolean, viewportAspect: number) {
      time.value = elapsed;
      still.value = reducedMotion ? 1 : 0;
      aspect.value = viewportAspect;
    },
  };
}
