// SOLANO HEAT — keyboard and mouse state. One shared object the game polls
// each step; listeners only record, they never act, so the fixed-step loop
// stays in charge of what a keypress means.

export const input = {
  keys: new Set(),
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  clicked: false, // set for one step on mousedown
  pressed: new Set(), // key codes that went down since the last step
};

let attached = false;

export function attachInput(canvas) {
  if (attached) return;
  attached = true;
  addEventListener('keydown', (e) => {
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => input.keys.delete(e.code));
  addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
    input.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.clicked = true;
    const r = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
    input.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
}

export const down = (code) => input.keys.has(code);
export const tapped = (code) => input.pressed.has(code);

/** Called at the end of each fixed step to age one-shot inputs. */
export function endStep() {
  input.pressed.clear();
  input.clicked = false;
}

/** Movement vector from the keys: x/y in -1..1, not normalised. */
export function moveVector() {
  let x = 0, y = 0;
  if (down('KeyA') || down('ArrowLeft')) x -= 1;
  if (down('KeyD') || down('ArrowRight')) x += 1;
  if (down('KeyW') || down('ArrowUp')) y -= 1;
  if (down('KeyS') || down('ArrowDown')) y += 1;
  return { x, y };
}
