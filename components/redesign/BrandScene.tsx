"use client";
import { useEffect, useRef } from "react";
import { StaticSculpture } from "./BrandMark";
import type { HiveTheme } from "./theme";
import styles from "./landing.module.css";
/** Original interactive agent scene, informed by ThreeUI's Logic Core and material studies. */
export default function BrandScene({ theme, paused, selected, onSelect }: {
    theme: HiveTheme;
    paused: boolean;
    selected: number;
    onSelect: (index: number) => void;
}) {
    const host = useRef<HTMLDivElement>(null);
    const sync = useRef<(() => void) | null>(null);
    const state = useRef({ theme, paused, selected, onSelect });
    useEffect(() => { state.current = { theme, paused, selected, onSelect }; sync.current?.(); }, [theme, paused, selected, onSelect]);
    useEffect(() => {
        const element = host.current;
        if (!element)
            return;
        let cancelled = false;
        let cleanup: (() => void) | undefined;
        async function mount() {
            const [T, { RoomEnvironment }, { RoundedBoxGeometry }, { gsap }] = await Promise.all([
                import("three"), import("three/addons/environments/RoomEnvironment.js"),
                import("three/addons/geometries/RoundedBoxGeometry.js"), import("gsap"),
            ]);
            if (cancelled || !element)
                return;
            let renderer: InstanceType<typeof T.WebGLRenderer>;
            try {
                renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
            }
            catch {
                return;
            }
            renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
            renderer.setClearColor(0, 0);
            renderer.toneMapping = T.ACESFilmicToneMapping;
            element.appendChild(renderer.domElement);
            const scene = new T.Scene();
            const camera = new T.PerspectiveCamera(39, 1, .1, 100);
            camera.position.set(0, .45, 9.5);
            const world = new T.Group();
            scene.add(world);
            const pmrem = new T.PMREMGenerator(renderer);
            const room = new RoomEnvironment();
            const environment = pmrem.fromScene(room, .04);
            scene.environment = environment.texture;
            room.dispose();
            pmrem.dispose();
            scene.add(new T.HemisphereLight(0xffffff, 0x28351c, 2));
            const light = new T.DirectionalLight(0xffffff, 3);
            light.position.set(-3, 6, 5);
            scene.add(light);
            const lime = new T.MeshPhysicalMaterial({ color: 0xccff00, metalness: .45, roughness: .26, clearcoat: 1, envMapIntensity: 1 });
            const silver = new T.MeshPhysicalMaterial({ color: 0xb9c6a5, metalness: .75, roughness: .3, envMapIntensity: 1.2 });
            const glass = new T.MeshPhysicalMaterial({ color: 0x111c16, metalness: .22, roughness: .23, clearcoat: 1 });
            const white = new T.MeshBasicMaterial({ color: 0xeeffc2 });
            const trace = new T.LineBasicMaterial({ color: 0x8caa62, transparent: true, opacity: .3 });
            const activeTrace = new T.LineBasicMaterial({ color: 0xb3df00, transparent: true, opacity: .85 });
            const dotsMaterial = new T.PointsMaterial({ color: 0x9cb47c, size: .018, transparent: true, opacity: .55, sizeAttenuation: true });
            const geometries: InstanceType<typeof T.BufferGeometry>[] = [];
            const meshes: InstanceType<typeof T.Mesh>[] = [];
            function geometry<G extends InstanceType<typeof T.BufferGeometry>>(g: G): G { geometries.push(g); return g; }
            const headGeometry = geometry(new RoundedBoxGeometry(1.9, 1.45, 1.05, 4, .3));
            const screenGeometry = geometry(new RoundedBoxGeometry(1.52, .96, .12, 4, .21));
            const eyeGeometry = geometry(new T.SphereGeometry(.1, 16, 12));
            const antennaGeometry = geometry(new T.CylinderGeometry(.027, .027, .35, 12));
            const antennaTip = geometry(new T.SphereGeometry(.085, 16, 12));
            function makeAgent(scale: number, index: number) {
                const group = new T.Group();
                const shell = new T.Mesh(headGeometry, index < 0 ? lime : silver);
                group.add(shell);
                meshes.push(shell);
                shell.userData.agentIndex = index;
                const screen = new T.Mesh(screenGeometry, glass);
                screen.position.z = .52;
                group.add(screen);
                screen.userData.agentIndex = index;
                meshes.push(screen);
                for (const x of [-.34, .34]) {
                    const eye = new T.Mesh(eyeGeometry, white);
                    eye.position.set(x, .05, .61);
                    eye.scale.y = 1.75;
                    group.add(eye);
                }
                const antenna = new T.Mesh(antennaGeometry, silver);
                antenna.position.y = .86;
                group.add(antenna);
                const tip = new T.Mesh(antennaTip, index < 0 ? lime : white);
                tip.position.y = 1.065;
                group.add(tip);
                group.scale.setScalar(scale);
                world.add(group);
                return { group, shell };
            }
            const main = makeAgent(1, -1);
            main.group.rotation.set(-.1, -.22, .06);
            main.group.position.set(0, .1, .65);
            const positions = [[-2.2, 1.65, -.3], [2.22, 1.3, -.3], [2, -1.55, .05], [-2, -1.5, -.15]];
            const agents = positions.map((p, i) => { const a = makeAgent(.41, i); a.group.position.set(...p as [
                number,
                number,
                number
            ]); a.group.rotation.set(.04, i % 2 ? -.3 : .3, i % 2 ? .12 : -.1); return a; });
            const curves = positions.map(p => new T.CatmullRomCurve3([new T.Vector3(...p as [
                    number,
                    number,
                    number
                ]), new T.Vector3(p[0] * .7, p[1] * .3, -.5), new T.Vector3(0, 0, 0)]));
            const lines = curves.map(curve => { const line = new T.Line(geometry(new T.BufferGeometry().setFromPoints(curve.getPoints(45))), trace); world.add(line); return line; });
            const beadGeometry = geometry(new T.SphereGeometry(.04, 8, 8));
            const beads = curves.map(() => { const bead = new T.Mesh(beadGeometry, lime); world.add(bead); return bead; });
            // Fine concentric trajectories give the scene depth without enclosing it in a card.
            for (let r = 0; r < 3; r++) {
                const pts = Array.from({ length: 160 }, (_, i) => { const a = i / 159 * Math.PI * 2; return new T.Vector3(Math.cos(a) * (2.5 + r * .28), Math.sin(a) * (1.35 + r * .21), -.7 + Math.sin(a) * .35); });
                world.add(new T.Line(geometry(new T.BufferGeometry().setFromPoints(pts)), trace));
            }
            const points = [];
            for (let x = -16; x <= 16; x++)
                for (let y = -12; y <= 12; y++)
                    points.push(x * .22, y * .22, -1.25 + Math.sin(x * .25) * Math.cos(y * .2) * .14);
            const pointGeometry = geometry(new T.BufferGeometry());
            pointGeometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
            const field = new T.Points(pointGeometry, dotsMaterial);
            world.add(field);
            const motion = matchMedia('(prefers-reduced-motion: reduce)');
            const pointer = new T.Vector2();
            const raycaster = new T.Raycaster();
            let phase = 0, frame = 0, previous = 0, visible = true, lost = false;
            let assembly: ReturnType<typeof gsap.timeline> | undefined;
            const canAnimate = () => visible && !document.hidden && !state.current.paused && !motion.matches && !lost;
            const draw = () => { if (!lost)
                renderer.render(scene, camera); };
            function render(time: number) {
                frame = 0;
                if (!canAnimate())
                    return;
                if (previous && time - previous < 32) {
                    frame = requestAnimationFrame(render);
                    return;
                }
                phase += previous ? Math.min((time - previous) / 1000, .05) : 0;
                previous = time;
                world.rotation.y += (pointer.x * .12 - world.rotation.y) * .045;
                world.rotation.x += (-pointer.y * .08 - world.rotation.x) * .045;
                main.group.position.y = .1 + Math.sin(phase * .8) * .09;
                main.group.rotation.y = -.22 + pointer.x * .22 + Math.sin(phase * .3) * .07;
                agents.forEach((a, i) => { a.group.position.y = positions[i][1] + Math.sin(phase * .7 + i) * .1; });
                beads.forEach((bead, i) => bead.position.copy(curves[i].getPoint((phase * .15 + i * .25) % 1)));
                field.rotation.z = Math.sin(phase * .1) * .025;
                draw();
                frame = requestAnimationFrame(render);
            }
            function refresh() {
                cancelAnimationFrame(frame);
                frame = 0;
                previous = 0;
                const dark = state.current.theme === 'dark';
                renderer.toneMappingExposure = dark ? 1.05 : .9;
                trace.color.set(dark ? 0x9aaa7d : 0x677b49);
                trace.opacity = dark ? .3 : .24;
                dotsMaterial.color.set(dark ? 0xadc987 : 0x687d4a);
                dotsMaterial.opacity = dark ? .45 : .38;
                agents.forEach((a, i) => { a.shell.material = i === state.current.selected ? lime : silver; });
                lines.forEach((line, i) => { line.material = i === state.current.selected ? activeTrace : trace; });
                if (motion.matches || state.current.paused)
                    assembly?.progress(1).pause();
                else if (canAnimate())
                    assembly?.resume();
                else
                    assembly?.pause();
                draw();
                if (canAnimate())
                    frame = requestAnimationFrame(render);
            }
            sync.current = refresh;
            const resize = new ResizeObserver(() => {
                const { width, height } = element!.getBoundingClientRect();
                if (!width || !height || lost)
                    return;
                renderer.setSize(width, height);
                camera.aspect = width / height;
                camera.position.z = width < 440 ? 10.2 : 9.5;
                camera.updateProjectionMatrix();
                draw();
            });
            resize.observe(element);
            const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refresh(); }, { threshold: .05 });
            observer.observe(element);
            const move = (e: PointerEvent) => {
                const b = element!.getBoundingClientRect();
                pointer.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height * 2 - 1));
                raycaster.setFromCamera(pointer, camera);
                const hit = raycaster.intersectObjects(meshes).find(hit => hit.object.userData.agentIndex >= 0);
                element!.style.cursor = hit ? 'pointer' : 'grab';
            };
            const choose = () => { raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(meshes).find(hit => hit.object.userData.agentIndex >= 0); if (hit)
                state.current.onSelect(hit.object.userData.agentIndex); };
            const leave = () => { pointer.set(0, 0); element!.style.cursor = 'grab'; };
            const contextLost = (e: Event) => { e.preventDefault(); lost = true; element!.dataset.ready = 'false'; cancelAnimationFrame(frame); assembly?.pause(); };
            element.addEventListener('pointermove', move);
            element.addEventListener('click', choose);
            element.addEventListener('pointerleave', leave);
            renderer.domElement.addEventListener('webglcontextlost', contextLost);
            document.addEventListener('visibilitychange', refresh);
            motion.addEventListener('change', refresh);
            const b = element.getBoundingClientRect();
            renderer.setSize(b.width, b.height);
            camera.aspect = b.width / Math.max(b.height, 1);
            camera.updateProjectionMatrix();
            if (!motion.matches && !state.current.paused) {
                assembly = gsap.timeline();
                assembly.from(main.group.scale, { x: .2, y: .2, z: .2, duration: 1.3, ease: 'expo.out' });
                agents.forEach((a, i) => assembly!.from(a.group.position, { x: 0, y: 0, z: -.5, duration: 1.3, ease: 'expo.out' }, .15 + i * .12));
            }
            refresh();
            element.dataset.ready = 'true';
            cleanup = () => { cancelAnimationFrame(frame); assembly?.kill(); resize.disconnect(); observer.disconnect(); element!.removeEventListener('pointermove', move); element!.removeEventListener('click', choose); element!.removeEventListener('pointerleave', leave); document.removeEventListener('visibilitychange', refresh); motion.removeEventListener('change', refresh); renderer.domElement.removeEventListener('webglcontextlost', contextLost); geometries.forEach(g => g.dispose()); [lime, silver, glass, white, trace, activeTrace, dotsMaterial].forEach(m => m.dispose()); environment.dispose(); renderer.dispose(); renderer.domElement.remove(); sync.current = null; delete element!.dataset.ready; };
        }
        mount().catch(() => { });
        return () => { cancelled = true; cleanup?.(); };
    }, []);
    return <div className={styles.scene} ref={host} aria-hidden="true"><div className={styles.sceneFallback}><StaticSculpture /></div></div>;
}
