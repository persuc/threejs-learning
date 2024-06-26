import * as THREE from "three"
import * as CANNON from "cannon-es"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { copyBodyToMesh } from "./game/cannonHelpers"
import { getMouseVector2, checkRayIntersections } from "./game/raycast"
import { drawTileGrid } from "./game/hexagons"
import { MousePosition, setUpMouse } from "./game/mouse"
import {
  updateCameraInner,
  updateCameraPosition,
  updateCameraRotation,
  updateCameraZoom,
  rotateCamera,
  cameraAngle,
  cameraHeight,
  cameraRadius,
  cameraLocation,
} from "./game/camera"
import { EXAMPLE_GRID } from "./game/tile"
import { setUpKeys } from "./game/keys"
import { TileGrid } from "./game/tile"
import * as RpgPlayer from "./game/rpgPlayer"

let frame = 0

// three.js setup
const raycaster = new THREE.Raycaster()
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)
renderer.domElement.onclick = () => {
  EXAMPLE_GRID.onClick()
}

// cannon.js setup
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, 0, -0.1),
})
const radius = 1
const sphereBody = new CANNON.Body({
  mass: 5,
  position: new CANNON.Vec3(0, 0, 3),
  shape: new CANNON.Sphere(radius),
})
world.addBody(sphereBody)

const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane(),
})
// make it face up
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), 0)
// world.addBody(groundBody);

const rpgPlayer = RpgPlayer.create()

// listen for window resize
window.addEventListener("resize", () => {
  // update camera
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  // update renderer
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
})

function getDebugInfoString(camera: THREE.PerspectiveCamera) {
  // return {
  //   fov: camera.fov,
  //   aspect: camera.aspect,
  //   near: camera.near,
  //   far: camera.far,
  //   position: camera.position,
  //   rotation: camera.rotation,
  // };
  const positionFixed = camera.position.toArray().map((val) => val.toFixed(2))
  const rotationFixed = camera.rotation.toArray().filter(val => Number.isFinite(val)).map((val: number) => val.toFixed(2))
  return `
mouse-1 drag to translate
mouse-2 drag to rotate (or arrow keys)
scroll to zoom
fov: ${camera.fov}
aspect: ${camera.aspect}
near: ${camera.near}
far: ${camera.far}
position: ${positionFixed.join(', ')}
rotation: ${rotationFixed.join(', ')}
gameRotation: ${cameraAngle}`
}

function updateDebugText(camera: THREE.PerspectiveCamera) {
  const debugText = document.getElementById("info")
  if (debugText) {
    debugText.innerText = getDebugInfoString(camera)
  }
}

function updateCamera() {
  updateCameraInner(
    cameraLocation,
    cameraHeight,
    cameraRadius,
    cameraAngle,
    camera
  )
  updateDebugText(camera)
}

// controls

function raycastMouse(position: MousePosition, tileGrid: TileGrid) {
  // const mousePointer = new THREE.Vector2();
  // mousePointer.x = (position.x / window.innerWidth) * 2 - 1;
  // mousePointer.y = -(position.y / window.innerHeight) * 2 + 1;
  const mousePointer = getMouseVector2(position, window)
  const intersections = checkRayIntersections(
    mousePointer,
    camera,
    raycaster,
    scene
  )

  // unhover all tiles
  tileGrid.unhoverAll()

  // hover over the intersected tiles
  if (intersections.length > 0) {
    // hover over first
    const uuid = intersections[0].object.uuid
    if (tileGrid.hashMesh(uuid)) {
      tileGrid.hoverOver(uuid)
    }
  }
}

const rotationSpeed = 0.05

updateCamera()
setUpMouse(
  [updateCameraPosition],
  [updateCameraRotation],
  [updateCameraZoom],
  [(position: MousePosition) => raycastMouse(position, EXAMPLE_GRID)]
)
const controlsOnGameTick = setUpKeys([
  {
    key: "ArrowLeft",
    handler: () => {
      rotateCamera(-rotationSpeed)
    },
  },
  {
    key: "ArrowRight",
    handler: () => {
      rotateCamera(rotationSpeed)
    },
  },
  {
    key: "w",
    handler: (deltaTime) => rpgPlayer.velocity[1] = 1,
  },
  {
    key: "a",
    handler: (deltaTime) => rpgPlayer.velocity[0] = -1,
  },
  {
    key: "s",
    handler: (deltaTime) => rpgPlayer.velocity[1] = -1,
  },
  {
    key: "d",
    handler: (deltaTime) => rpgPlayer.velocity[0] = 1,
  },
],
  [],
  [
    {
      key: "w",
      handler: (deltaTime) => rpgPlayer.velocity[1] = 0,
    },
    {
      key: "a",
      handler: (deltaTime) => rpgPlayer.velocity[0] = 0,
    },
    {
      key: "s",
      handler: (deltaTime) => rpgPlayer.velocity[1] = 0,
    },
    {
      key: "d",
      handler: (deltaTime) => rpgPlayer.velocity[0] = 0,
    },
  ])

const light = new THREE.AmbientLight(0x404040) // soft white light
const pointLight = new THREE.PointLight(0xffffff, 50, 500)
pointLight.position.set(0, 0, 10)

const loader = new GLTFLoader()
let avocado: THREE.Object3D | undefined = undefined
loader.load(
  "/avocado/Avocado.gltf",
  (gltf: any) => {
    // scale up by 100
    gltf.scene.scale.set(10, 10, 10)
    gltf.scene.position.set(0, 0, 1)
    scene.add(gltf.scene)
    avocado = gltf.scene
  },
  // called while loading is progressing
  function (xhr: any) {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded")
  },
  (error: any) => {
    console.log(error)
  }
)

// const hexagonGrid = drawHexagonGrid(15, 15, 1);
const hexagonGrid = drawTileGrid(EXAMPLE_GRID, 1)

// add sphere
const geometry = new THREE.SphereGeometry(radius, 32, 32)
const material = new THREE.MeshBasicMaterial({ color: 0xffff00 })
const sphere = new THREE.Mesh(geometry, material)

// add plane
const planeGeometry = new THREE.PlaneGeometry(3, 3, 3)
// beige
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xf5f5dc })
const plane = new THREE.Mesh(planeGeometry, planeMaterial)

// Update plane from ground body
copyBodyToMesh(groundBody, plane)

scene.add(sphere)
scene.add(plane)

scene.add(hexagonGrid)
scene.add(light)
scene.add(pointLight)

scene.background = new THREE.Color(0xffffff)

let lastFrameTime = performance.now()

function animate() {
  const frameTime = performance.now()
  const deltaTime = (frameTime - lastFrameTime) / 1000
  requestAnimationFrame(animate)

  controlsOnGameTick(deltaTime)
  world.fixedStep()

  // the sphere y position shows the sphere falling
  copyBodyToMesh(sphereBody, sphere)
  // update sphere position
  sphere.position.x = sphereBody.position.x

  updateDebugText(camera)
  updateCamera()
  rpgPlayer.update(deltaTime)

  if (avocado) {
    avocado.position.fromArray(rpgPlayer.position)
  }

  renderer.render(scene, camera)
  frame++
  lastFrameTime = frameTime
}
animate()
