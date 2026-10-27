'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import Core from '@/lib/core';
const C: any = Core;

const D2R = Math.PI / 180;

/** Kesim elementlari zanjiri (XY tekisligida), Z boʻylab Wz uzunlikda */
function chainMesh(els: any[], T: number, Wz: number, start: number[], Rb: number, add: (g: THREE.BufferGeometry) => void) {
  let p = start.slice(), d = 0;
  els.forEach(e => {
    if (e.t === 'line') {
      d = e.dir; if (e.L < 1e-3) return;
      const u = [Math.cos(d * D2R), Math.sin(d * D2R)], n = [-u[1], u[0]], sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(e.L, 0); sh.lineTo(e.L, Wz); sh.lineTo(0, Wz); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false });
      const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(u[0], u[1], 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-n[0], -n[1], 0));
      M.setPosition(p[0] + n[0] * T / 2, p[1] + n[1] * T / 2, -Wz / 2); geo.applyMatrix4(M); add(geo);
      p = [p[0] + u[0] * e.L, p[1] + u[1] * e.L];
    } else {
      const turn = (e.t === 'arc' ? e.ang : e.turn) * D2R, Ri = e.t === 'arc' ? Math.max(e.r - T / 2, 0.1) : Rb, Rm = Ri + T / 2, sg = Math.sign(turn);
      const u = [Math.cos(d * D2R), Math.sin(d * D2R)], n = [-u[1], u[0]], c = [p[0] + n[0] * Rm * sg, p[1] + n[1] * Rm * sg];
      const th0 = Math.atan2(p[1] - c[1], p[0] - c[0]), th1 = th0 + turn, sh = new THREE.Shape();
      sh.moveTo(c[0] + (Ri + T) * Math.cos(th0), c[1] + (Ri + T) * Math.sin(th0)); sh.absarc(c[0], c[1], Ri + T, th0, th1, turn < 0);
      sh.lineTo(c[0] + Ri * Math.cos(th1), c[1] + Ri * Math.sin(th1)); sh.absarc(c[0], c[1], Ri, th1, th0, turn > 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: Wz, bevelEnabled: false, curveSegments: 12 }); geo.translate(0, 0, -Wz / 2); add(geo);
      p = [c[0] + Rm * Math.cos(th1), c[1] + Rm * Math.sin(th1)]; d += turn / D2R;
    }
  });
}

/** Detalning 3D koʻrinishi (aylantirish, surish, masshtab) */
export default function Viewer3D({ pt, it, P }: { pt: any; it: any; P: any }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current!; let disposed = false;
    const R = new THREE.WebGLRenderer({ antialias: true }); R.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); el.appendChild(R.domElement);
    const S = new THREE.Scene(); S.background = new THREE.Color(0xf4f4f5);
    S.add(new THREE.HemisphereLight(0xffffff, 0x8a94a6, 0.9)); const dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(1, 2, 1.5); S.add(dl);
    const cam = new THREE.PerspectiveCamera(40, 1, 1, 100000), g = new THREE.Group();
    const T = Math.max(+P.T, 0.3), Rb = Math.max(P.calc === 'k' ? +P.R : T, 0.2);
    const mt = new THREE.MeshStandardMaterial({ color: 0xb7c1c9, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide });
    const em = new THREE.LineBasicMaterial({ color: 0x27272a, transparent: true, opacity: .4 });
    const mk = (grp: THREE.Group) => (geo: THREE.BufferGeometry) => { const m = new THREE.Mesh(geo, mt); m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), em)); grp.add(m); };
    if (pt.kind !== 'tray4') chainMesh(pt.prW.els, T, Math.min(pt.X, Math.max(pt.Y * 1.2, 100)), [0, 0], Rb, mk(g));
    else {
      const f = P.unit === 'sm' ? 10 : 1, B = +it.base * f, Lb = +it.baseL * f, Ps = { ...P, calc: 'sum' };
      mk(g)(new THREE.BoxGeometry(Lb, T, B));
      const put = (segs: any[], phi: number, off: number, len: number) => {
        if (!segs.length) return;
        const pr = C.computeProfile({ segs: [{ dir: 'R', L: 1e-6 }, ...segs], noWarn: true }, Ps), sub = new THREE.Group();
        chainMesh(pr.els, T, len, [off, 0], Rb, mk(sub)); sub.rotation.y = phi * D2R; g.add(sub);
      };
      const s = pt.sides; put(s.R, -90, B / 2, Lb); put(s.L, 90, B / 2, Lb); put(s.T, 0, Lb / 2, B); put(s.B, 180, Lb / 2, B);
    }
    S.add(g);
    const bb = new THREE.Box3().setFromObject(g), st = { t: bb.getCenter(new THREE.Vector3()), r: Math.max(...bb.getSize(new THREE.Vector3()).toArray()) * 2, th: 0.8, ph: 1.1 };
    const draw = () => { if (disposed) return; cam.position.set(st.t.x + st.r * Math.sin(st.ph) * Math.sin(st.th), st.t.y + st.r * Math.cos(st.ph), st.t.z + st.r * Math.sin(st.ph) * Math.cos(st.th)); cam.lookAt(st.t); cam.near = st.r / 1000; cam.far = st.r * 50; cam.updateProjectionMatrix(); R.render(S, cam); };
    const resize = () => { const w = el.clientWidth, h = el.clientHeight; if (w && h) { R.setSize(w, h); cam.aspect = w / h; draw(); } };
    let ptr: { x: number; y: number; pan: boolean } | null = null;
    const cv = R.domElement;
    cv.oncontextmenu = e => e.preventDefault();
    cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); ptr = { x: e.clientX, y: e.clientY, pan: e.button !== 0 || e.shiftKey }; };
    cv.onpointermove = e => {
      if (!ptr) return; const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; ptr.x = e.clientX; ptr.y = e.clientY;
      if (ptr.pan) { const s = st.r * 0.0012; st.t.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), -dx * s).addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1), dy * s); }
      else { st.th -= dx * 0.006; st.ph = Math.max(0.05, Math.min(3.09, st.ph - dy * 0.006)); }
      draw();
    };
    cv.onpointerup = () => { ptr = null; };
    cv.onwheel = e => { e.preventDefault(); st.r *= Math.exp(e.deltaY * 0.0012); draw(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    return () => { disposed = true; ro.disconnect(); g.traverse(o => (o as THREE.Mesh).geometry?.dispose()); mt.dispose(); em.dispose(); R.dispose(); cv.remove(); };
  }, [pt, it, P.T, P.R, P.calc, P.unit]);
  return <div className="v3" ref={host} />;
}
