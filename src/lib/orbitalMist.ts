import * as THREE from "three";

const VOLUME_VERTEX = `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

// Thin, translucent aurora ribbons follow the orbit, with slow water-like ripples.
const VOLUME_FRAGMENT = `
  uniform vec3 uCameraLocal;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uIntro;
  uniform float uMorph;
  uniform float uSteps;
  varying vec3 vLocal;
  float hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p,p.yzx+33.33);
    return fract((p.x+p.y)*p.z);
  }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(
      mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float density(vec3 p) {
    float angle = atan(p.z,p.x);
    float radius = 0.98 + sin(angle*2.0-uTime*0.04)*0.085
      + sin(angle*5.0+uTime*0.055)*0.025 + uMorph*0.14;
    float height = p.y - sin(angle*3.0-uTime*0.045)*0.12;
    float radial = length(p.xz)-radius;
    float outerRadial = radial-0.16;
    float outerHeight = height+0.08;
    float ribbonA = exp(-radial*radial*145.0-height*height*32.0);
    float ribbonB = exp(-outerRadial*outerRadial*180.0-outerHeight*outerHeight*48.0)*0.45;
    float ripple = 0.65+0.35*pow(0.5+0.5*sin(angle*6.0+radial*12.0-uTime*0.11),2.0);
    float softGrain = 0.85+noise(p*2.1+vec3(uTime*0.025,0,0))*0.15;
    return (ribbonA+ribbonB)*ripple*softGrain;
  }
  void main() {
    vec3 ro = uCameraLocal;
    vec3 rd = normalize(vLocal-ro);
    vec3 safeDir = mix(vec3(0.0001),rd,step(vec3(0.0001),abs(rd)));
    vec3 lo = (vec3(-1.65,-0.85,-1.65)-ro)/safeDir;
    vec3 hi = (vec3(1.65,0.85,1.65)-ro)/safeDir;
    vec3 nearHit = min(lo,hi), farHit = max(lo,hi);
    float enter = max(0.0,max(nearHit.x,max(nearHit.y,nearHit.z)));
    float leave = min(farHit.x,min(farHit.y,farHit.z));
    if (leave <= enter) discard;
    float stepSize = (leave-enter)/uSteps;
    vec4 accumulated = vec4(0.0);
    for (int i=0;i<28;i++) {
      if (float(i)>=uSteps || accumulated.a>0.92) break;
      vec3 p = ro+rd*(enter+(float(i)+0.5)*stepSize);
      float fog = density(p);
      float alpha = (1.0-exp(-fog*stepSize*(0.9+(1.0-uIntro)*0.15))) * uOpacity;
      float light = 0.60 + 0.12*noise(p*1.5+vec3(0,uTime*0.015,0));
      vec3 colour = vec3(0.94,0.97,1.0)*light;
      accumulated.rgb += (1.0-accumulated.a)*alpha*colour;
      accumulated.a += (1.0-accumulated.a)*alpha;
    }
    if (accumulated.a<0.002) discard;
    gl_FragColor = vec4(accumulated.rgb/max(accumulated.a,0.001),min(accumulated.a,0.18));
  }
`;

const ORBIT_VERTEX = `
  attribute vec4 aOrbit;
  uniform float uTime;
  uniform float uMorph;
  uniform float uPixelRatio;
  varying float vLight;
  void main() {
    float angle = aOrbit.x + uTime*(0.14+aOrbit.w*0.12);
    float radius = 0.91+aOrbit.y*0.29+uMorph*0.25;
    vec3 pos = vec3(cos(angle)*radius,sin(angle*2.0-uTime*0.14)*0.07+(aOrbit.z-0.5)*0.22,sin(angle)*radius);
    vec4 mv = modelViewMatrix*vec4(pos,1.0);
    gl_Position = projectionMatrix*mv;
    gl_PointSize = clamp((1.8+aOrbit.w*2.4)*uPixelRatio/max(0.7,-mv.z),1.0,5.0*uPixelRatio);
    vLight = 0.4+aOrbit.w*0.55;
  }
`;

const ORBIT_FRAGMENT = `
  uniform float uOpacity;
  varying float vLight;
  void main() {
    float r = length(gl_PointCoord-0.5)*2.0;
    if(r>1.0) discard;
    gl_FragColor = vec4(vec3(1.0),exp(-r*r*4.0)*vLight*uOpacity);
  }
`;

export function createOrbitalMist(count: number, pixelRatio: number, mobile: boolean) {
  const group = new THREE.Group();
  group.name = "Logo_Orbital_Volume";
  const volumeMaterial = new THREE.ShaderMaterial({
    vertexShader: VOLUME_VERTEX, fragmentShader: VOLUME_FRAGMENT,
    uniforms: {
      uCameraLocal: { value: new THREE.Vector3() }, uTime: { value: 0 }, uOpacity: { value: 0 },
      uIntro: { value: 0 }, uMorph: { value: 0 }, uSteps: { value: mobile ? 18 : 28 },
    },
    transparent: true, depthWrite: false, side: THREE.BackSide,
  });
  const volume = new THREE.Mesh(new THREE.BoxGeometry(3.3,1.7,3.3),volumeMaterial);
  volume.frustumCulled = false;
  group.add(volume);
  const geometry = new THREE.BufferGeometry();
  const seeds = new Float32Array(count*4);
  for(let i=0;i<count;i++) seeds.set([
    i*2.39996323, (i*0.61803399)%1, (i*0.75487767)%1, (i*0.56984029)%1,
  ],i*4);
  geometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(count*3),3));
  geometry.setAttribute("aOrbit",new THREE.BufferAttribute(seeds,4));
  const orbitMaterial = new THREE.ShaderMaterial({
    vertexShader: ORBIT_VERTEX, fragmentShader: ORBIT_FRAGMENT,
    uniforms: { uTime: { value: 0 }, uMorph: { value: 0 }, uOpacity: { value: 0 }, uPixelRatio: { value: pixelRatio } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(geometry,orbitMaterial);
  particles.frustumCulled = false;
  group.add(particles);
  const cameraPosition = new THREE.Vector3();
  return {
    group,
    update(time: number, intro: number, opacity: number, morph: number, centerY: number, camera: THREE.Camera) {
      group.visible = opacity>0.001;
      group.position.y = centerY;
      group.rotation.set(0.30,time*0.035,-0.18);
      group.updateWorldMatrix(true,true);
      camera.getWorldPosition(cameraPosition);
      volumeMaterial.uniforms.uCameraLocal.value.copy(cameraPosition);
      volume.worldToLocal(volumeMaterial.uniforms.uCameraLocal.value);
      volumeMaterial.uniforms.uTime.value = time;
      volumeMaterial.uniforms.uIntro.value = intro;
      volumeMaterial.uniforms.uMorph.value = morph;
      volumeMaterial.uniforms.uOpacity.value = opacity*0.34;
      orbitMaterial.uniforms.uTime.value = time;
      orbitMaterial.uniforms.uMorph.value = morph;
      orbitMaterial.uniforms.uOpacity.value = opacity*intro*0.8;
    },
  };
}
