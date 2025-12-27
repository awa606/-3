
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface ThreeSceneProps {
  onLoad: () => void;
}

export interface ThreeSceneRef {
  updateHandInteraction: (x: number, y: number, isPinching: boolean) => void;
  addMemory: (url: string) => void;
}

const ThreeScene = forwardRef<ThreeSceneRef, ThreeSceneProps>(({ onLoad }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const mainGroupRef = useRef<THREE.Group>(new THREE.Group());
  const memoriesGroupRef = useRef<THREE.Group>(new THREE.Group());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const clock = useRef(new THREE.Clock());
  
  // 交互状态
  const targetHandPos = useRef(new THREE.Vector3(0, 0, 0));
  const currentHandPos = useRef(new THREE.Vector3(0, 0, 0));
  const isPinchingRef = useRef(false);
  const pinchFactor = useRef(0); // 用于平滑手势过渡

  useImperativeHandle(ref, () => ({
    updateHandInteraction: (x, y, isPinching) => {
      // 映射到场景坐标
      targetHandPos.current.set((x - 0.5) * 60, (0.5 - y) * 45, 15);
      isPinchingRef.current = isPinching;
      
      const targetRX = (y - 0.5) * 0.25;
      const targetRY = (x - 0.5) * 0.5;
      mainGroupRef.current.rotation.x += (targetRX - mainGroupRef.current.rotation.x) * 0.04;
      mainGroupRef.current.rotation.y += (targetRY - mainGroupRef.current.rotation.y) * 0.04;
    },
    addMemory: (url) => {
      const loader = new THREE.TextureLoader();
      loader.load(url, (texture) => {
        const group = new THREE.Group();
        
        // 相片平面
        const geo = new THREE.PlaneGeometry(5, 5);
        const mat = new THREE.MeshBasicMaterial({ 
          map: texture, 
          transparent: true, 
          opacity: 0,
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geo, mat);
        
        // 金色边框
        const borderGeo = new THREE.PlaneGeometry(5.2, 5.2);
        const borderMat = new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0 });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.z = -0.05;

        group.add(border);
        group.add(mesh);

        const angle = Math.random() * Math.PI * 2;
        const radius = 15 + Math.random() * 8;
        const height = Math.random() * 30 - 5;
        group.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
        group.lookAt(0, height, 0);
        
        (group as any).userData.birth = clock.current.getElapsedTime();
        (group as any).userData.matRefs = [mat, borderMat];
        
        memoriesGroupRef.current.add(group);
      });
    }
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = sceneRef.current;
    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 65);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 2.4;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.5, 0.8);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    // --- 环境光 ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const spotLight = new THREE.SpotLight(0xd4af37, 1500);
    spotLight.position.set(40, 60, 40);
    scene.add(spotLight);

    // --- 圣诞树主体 ---
    const mainGroup = mainGroupRef.current;
    scene.add(mainGroup);

    const goldMat = new THREE.MeshStandardMaterial({ 
      color: 0xd4af37, 
      metalness: 1.0, 
      roughness: 0.15,
      emissive: 0x331100
    });

    const tree = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const radius = (8 - i) * 2.5;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, 6, 40, 1, true), goldMat);
      cone.position.y = i * 3.5;
      tree.add(cone);
    }
    mainGroup.add(tree);
    mainGroup.add(memoriesGroupRef.current);

    // --- 星顶 (Glow Star) ---
    const star = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff9e0 })
    );
    star.position.y = 7 * 3.5 + 4;
    tree.add(star);

    // --- 粒子系统: Vortex ---
    const vCount = 4000;
    const vGeo = new THREE.BufferGeometry();
    const vPos = new Float32Array(vCount * 3);
    const vMeta = new Float32Array(vCount * 2); // 0: r, 1: speed
    for (let i = 0; i < vCount; i++) {
      const r = 8 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      vPos[i * 3] = Math.cos(theta) * r;
      vPos[i * 3 + 1] = (Math.random() - 0.2) * 45;
      vPos[i * 3 + 2] = Math.sin(theta) * r;
      vMeta[i * 2] = r;
      vMeta[i * 2 + 1] = 0.5 + Math.random() * 1.5;
    }
    vGeo.setAttribute('position', new THREE.BufferAttribute(vPos, 3));
    const vMat = new THREE.PointsMaterial({ color: 0xfceea7, size: 0.1, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
    const vortex = new THREE.Points(vGeo, vMat);
    scene.add(vortex);

    // --- 手部轨迹 ---
    const tCount = 60;
    const tGeo = new THREE.BufferGeometry();
    const tPos = new Float32Array(tCount * 3);
    tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    const tMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
    const trail = new THREE.Points(tGeo, tMat);
    scene.add(trail);

    const animate = () => {
      requestAnimationFrame(animate);
      const time = clock.current.getElapsedTime();
      
      // 1. Pinch 平滑过渡
      const targetPinch = isPinchingRef.current ? 1 : 0;
      pinchFactor.current += (targetPinch - pinchFactor.current) * 0.1;

      // 2. 涡流动画
      const pos = vGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < vCount; i++) {
        const idx = i * 3;
        const r = vMeta[i * 2];
        const speed = vMeta[i * 2 + 1];
        const angle = time * 0.2 * speed;
        
        // 基础旋转
        const baseAngle = (i / vCount) * Math.PI * 2 + angle;
        // Pinch 时的径向扩张
        const currentR = r * (1 + pinchFactor.current * 0.3);
        
        pos[idx] = Math.cos(baseAngle) * currentR;
        pos[idx + 2] = Math.sin(baseAngle) * currentR;
        pos[idx + 1] += Math.cos(time + i) * 0.01;
      }
      vGeo.attributes.position.needsUpdate = true;
      vMat.opacity = 0.4 + pinchFactor.current * 0.5;

      // 3. 手部平滑跟随
      currentHandPos.current.lerp(targetHandPos.current, 0.12);
      const tArray = tGeo.attributes.position.array as Float32Array;
      for (let i = tCount - 1; i > 0; i--) {
        tArray[i * 3] = tArray[(i - 1) * 3];
        tArray[i * 3 + 1] = tArray[(i - 1) * 3 + 1];
        tArray[i * 3 + 2] = tArray[(i - 1) * 3 + 2];
      }
      tArray[0] = currentHandPos.current.x;
      tArray[1] = currentHandPos.current.y;
      tArray[2] = currentHandPos.current.z;
      tGeo.attributes.position.needsUpdate = true;

      // 4. 记忆相片
      memoriesGroupRef.current.children.forEach((group) => {
        const age = time - (group as any).userData.birth;
        const mats = (group as any).userData.matRefs;
        if (age < 1.5) {
          mats.forEach((m: any) => m.opacity = age / 1.5);
        }
        group.position.y += Math.sin(time + group.position.x) * 0.015;
      });

      // 星顶旋转
      star.rotation.y += 0.02;
      star.scale.setScalar(1 + Math.sin(time * 3) * 0.1);

      composer.render();
    };

    animate();
    onLoad();

    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return <div ref={containerRef} className="fixed inset-0 z-0 touch-none" />;
});

export default ThreeScene;
