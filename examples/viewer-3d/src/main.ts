// Visor 3D - plugin de ejemplo de Docodez (ver doc/04-plugins.md). TypeScript + three.js, compilado con Vite.
// Los modelos son archivos anexos al nodo; los datos del plugin (JSON) guardan cuál se ve, el color, el modo alambre,
// el giro automático y la vista de la cámara. Al guardar, la página de respaldo del nodo lleva una foto del modelo.
import {
  Box3, Color, DirectionalLight, HemisphereLight, MathUtils, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera,
  Scene, Vector3, WebGLRenderer, type BufferGeometry, type Material,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { DocodezContext } from '../../../sdk/docodez';
import { installDevDocodez } from '../../../sdk/docodez-dev';
import { createColorPicker, createPicker } from '../../../sdk/picker';
import './style.css';

// Fuera de Docodez (npm run dev) un window.docodez de prueba. En el plugin compilado esto no está.
if (import.meta.env.DEV) installDevDocodez('lynza.visor3d');

const MODEL_TYPES = ['.stl', '.obj', '.glb', '.gltf'];
const TEXT = {
  es: { open: 'Abrir modelo...', wire: 'Alambre', spin: 'Girar', reset: 'Encuadrar', saveView: 'Guardar vista',
        empty: 'No hay ningún modelo 3D anexo a este nodo.', emptyEdit: 'Abrí un modelo (STL, OBJ, GLB) o soltalo acá.',
        loading: 'Cargando...', saved: 'Guardado', error: 'No se pudo abrir: ', model: 'Modelo 3D' },
  en: { open: 'Open model...', wire: 'Wireframe', spin: 'Spin', reset: 'Fit', saveView: 'Save view',
        empty: 'There is no 3D model attached to this node.', emptyEdit: 'Open a model (STL, OBJ, GLB) or drop it here.',
        loading: 'Loading...', saved: 'Saved', error: 'Could not open: ', model: '3D model' },
  fr: { open: 'Ouvrir un modèle...', wire: 'Fil de fer', spin: 'Rotation', reset: 'Cadrer', saveView: 'Enregistrer la vue',
        empty: "Aucun modèle 3D n'est joint à ce nœud.", emptyEdit: 'Ouvrez un modèle (STL, OBJ, GLB) ou déposez-le ici.',
        loading: 'Chargement...', saved: 'Enregistré', error: "Impossible d'ouvrir : ", model: 'Modèle 3D' },
};

/** Lo que el plugin guarda en el nodo. */
interface ViewerState {
  model: string | null;
  color: string;
  wireframe: boolean;
  spin: boolean;
  camera: { position: number[]; target: number[] } | null;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const ext = (name: string) => (name.match(/\.[^.]+$/) ?? [''])[0].toLowerCase();
const isModel = (name: string) => MODEL_TYPES.includes(ext(name));

const ctx: DocodezContext = await docodez.ready;
const t = TEXT[ctx.language] ?? TEXT.en;
const state: ViewerState = {
  model: null, color: '#b0bec5', wireframe: false, spin: false, camera: null,
  ...((await docodez.getJSON<Partial<ViewerState>>()) ?? {}),
};

// --- escena ---------------------------------------------------------------------------------------
const view = $('view');
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
view.appendChild(renderer.domElement);
const scene = new Scene();
const camera = new PerspectiveCamera(45, 1, 0.01, 10000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new HemisphereLight(0xffffff, 0x444444, 1.6));
const sun = new DirectionalLight(0xffffff, 2.2);
sun.position.set(3, 5, 4);
scene.add(sun);
let object: Object3D | null = null;

function applyTheme(theme: string): void {
  document.body.classList.toggle('dark', theme !== 'light');
  scene.background = new Color(theme === 'light' ? 0xf4f5f7 : 0x1b1c1f);
}

function resize(): void {
  const w = view.clientWidth || 1;
  const h = view.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);

renderer.setAnimationLoop(() => {
  controls.autoRotate = state.spin;
  controls.update();
  renderer.render(scene, camera);
});

function applyMaterial(): void {
  object?.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const materials: Material[] = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of materials) {
      (m as MeshStandardMaterial).wireframe = state.wireframe;
      // a los glTF no se les pisa el color propio
      if (o.userData.plain) (m as MeshStandardMaterial).color.set(state.color);
    }
  });
}

function fit(): void {
  if (!object) return;
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3()).length() || 1;
  const center = box.getCenter(new Vector3());
  // A la distancia en que la esfera que lo envuelve entra en la vista (con un margen), en diagonal desde arriba.
  const fov = MathUtils.degToRad(camera.fov) * Math.min(1, camera.aspect);
  const distance = (size / 2) / Math.sin(fov / 2) * 1.15;
  controls.target.copy(center);
  camera.position.copy(center).add(new Vector3(0.6, 0.45, 0.8).normalize().multiplyScalar(distance));
  camera.near = size / 1000;
  camera.far = size * 100;
  camera.updateProjectionMatrix();
  controls.update();
}

async function parse(name: string, buffer: ArrayBuffer): Promise<Object3D> {
  const plain = (geometry: BufferGeometry) => {
    geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: state.color, metalness: 0.1, roughness: 0.6 }));
    mesh.userData.plain = true;
    return mesh;
  };
  switch (ext(name)) {
    case '.stl':
      return plain(new STLLoader().parse(buffer));
    case '.obj': {
      const group = new OBJLoader().parse(new TextDecoder().decode(buffer));
      group.traverse((o) => {
        if (o instanceof Mesh) {
          o.material = new MeshStandardMaterial({ color: state.color });
          o.userData.plain = true;
        }
      });
      return group;
    }
    default:
      return (await new GLTFLoader().parseAsync(buffer, '')).scene;
  }
}

async function show(name: string | null, keepCamera: boolean): Promise<void> {
  if (object) {
    scene.remove(object);
    object = null;
  }

  $('empty').style.display = name ? 'none' : 'flex';
  if (!name) return;
  $('status').textContent = t.loading;
  try {
    object = await parse(name, await docodez.getAttachment(name));
    scene.add(object);
    applyMaterial();
    if (keepCamera && state.camera) {
      camera.position.fromArray(state.camera.position);
      controls.target.fromArray(state.camera.target);
      controls.update();
    } else {
      fit();
    }
    $('status').textContent = '';
  } catch (e) {
    $('status').textContent = t.error + ((e as Error)?.message ?? e);
  }
}

// --- guardar en el nodo ------------------------------------------------------------------------------
let saveTimer = 0;
function saveLater(): void {
  if (!ctx.editable) return;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 700);
}

async function save(): Promise<void> {
  if (!ctx.editable) return;
  await docodez.setJSON(state);
  await docodez.setPreview(preview());
  $('status').textContent = t.saved;
  setTimeout(() => {
    if ($('status').textContent === t.saved) $('status').textContent = '';
  }, 1500);
}

/** La página de respaldo: el nombre del modelo y una foto (la ven la búsqueda y los Docodez sin el plugin). */
function preview(): string {
  const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  let img = '';
  if (object) {
    renderer.render(scene, camera);
    const src = renderer.domElement;
    const scale = Math.min(1, 480 / Math.max(src.width, 1));
    const c = document.createElement('canvas');
    c.width = Math.round(src.width * scale);
    c.height = Math.round(src.height * scale);
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
    img = `<p><img src="${c.toDataURL('image/jpeg', 0.8)}" alt="${esc(state.model)}"></p>`;
  }
  return `<h2>${esc(ctx.nodeTitle)}</h2><p>${t.model}: ${esc(state.model ?? '-')}</p>${img}`;
}

// --- interfaz ------------------------------------------------------------------------------------------
$('open').textContent = t.open;
$('wireLabel').textContent = t.wire;
$('spinLabel').textContent = t.spin;
$('reset').textContent = t.reset;
$('saveView').textContent = t.saveView;
// Fase 9f: lista y color dibujados en la página (los nativos se abrían fuera de lugar con el visor integrado).
const modelPicker = createPicker($('model'), t.model);
createColorPicker($('color'), 'Color', state.color, (color) => { state.color = color; applyMaterial(); saveLater(); });
$<HTMLInputElement>('wire').checked = state.wireframe;
$<HTMLInputElement>('spin').checked = state.spin;

function setEditable(editable: boolean): void {
  ctx.editable = editable;
  document.body.classList.toggle('editable', editable);
  $('empty').textContent = editable ? t.emptyEdit : t.empty;
}

async function refreshModels(select: string | null): Promise<string | null> {
  const models = (await docodez.listAttachments()).map((a) => a.name).filter(isModel);
  const chosen = select && models.includes(select) ? select : state.model && models.includes(state.model) ? state.model : models[0] ?? null;
  modelPicker.set(models, chosen);
  $('model').style.display = models.length > 1 ? '' : 'none';
  return chosen;
}

async function addModel(name: string, data: ArrayBuffer): Promise<void> {
  await docodez.putAttachment(name, data);
  state.model = await refreshModels(name);
  state.camera = null;
  await show(state.model, false);
  saveLater();
}

modelPicker.onchange = async (model) => {
  state.model = model;
  state.camera = null;
  await show(state.model, false);
  saveLater();
};
$<HTMLInputElement>('wire').onchange = () => { state.wireframe = $<HTMLInputElement>('wire').checked; applyMaterial(); saveLater(); };
$<HTMLInputElement>('spin').onchange = () => { state.spin = $<HTMLInputElement>('spin').checked; saveLater(); };
$('reset').onclick = fit;
$('saveView').onclick = () => {
  state.camera = { position: camera.position.toArray(), target: controls.target.toArray() };
  void save();
};
$('open').onclick = async () => {
  const file = await docodez.pickFile(MODEL_TYPES);
  if (file) await addModel(file.name, file.data);
};

// Soltar un archivo sobre el visor (modo edición).
view.addEventListener('dragover', (e) => {
  if (ctx.editable) {
    e.preventDefault();
    view.classList.add('drop');
  }
});
view.addEventListener('dragleave', () => view.classList.remove('drop'));
view.addEventListener('drop', async (e) => {
  view.classList.remove('drop');
  if (!ctx.editable) return;
  e.preventDefault();
  const file = [...(e.dataTransfer?.files ?? [])].find((f) => isModel(f.name));
  if (file) await addModel(file.name, await file.arrayBuffer());
});

docodez.on('modechange', (p) => setEditable(p.editable));
docodez.on('themechange', (p) => applyTheme(p.theme));

applyTheme(ctx.theme);
setEditable(ctx.editable);
resize();
state.model = await refreshModels(state.model);
await show(state.model, true);

// Para las pruebas automáticas.
(window as unknown as { __visor3d: unknown }).__visor3d = {
  get loaded() { return !!object; },
  get state() { return state; },
  addModel,
};
