import { GraphPlane } from "./graphPlane.js";
import { NORMAL_FUNC, FST_ODE, SND_ODE } from "./constants.js";

const canvas = document.getElementById("plane");
const plane = new GraphPlane(canvas);

const modeSelect = document.getElementById("mode");
const functionInput = document.getElementById("function-input");
const fireButton = document.getElementById("fire");
const newMatchButton = document.getElementById("new-match");
const statusEl = document.getElementById("status");
const angleControls = document.getElementById("angle-controls");
const angleValueEl = document.getElementById("angle-value");
const angleUpButton = document.getElementById("angle-up");
const angleDownButton = document.getElementById("angle-down");
const funcLabel = document.getElementById("func-label");

const MODES = { "0": NORMAL_FUNC, "1": FST_ODE, "2": SND_ODE };
const MODE_LABELS = { "0": "y =", "1": "y' =", "2": "y'' =" };
const ANGLE_STEP = (5 * Math.PI) / 180;

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(isError));
}

function updateAngleDisplay() {
  const degrees = Math.round((plane.angle * 180) / Math.PI);
  angleValueEl.textContent = `${degrees}°`;
}

function refreshModeUI() {
  angleControls.classList.toggle("visible", plane.mode === SND_ODE);
  funcLabel.textContent = MODE_LABELS[modeSelect.value];
}

modeSelect.addEventListener("change", () => {
  plane.setMode(MODES[modeSelect.value]);
  refreshModeUI();
});

angleUpButton.addEventListener("click", () => {
  plane.setAngle(plane.angle + ANGLE_STEP);
  updateAngleDisplay();
});

angleDownButton.addEventListener("click", () => {
  plane.setAngle(plane.angle - ANGLE_STEP);
  updateAngleDisplay();
});

document.addEventListener("keydown", (event) => {
  if (plane.mode !== SND_ODE) return;

  if (event.key === "ArrowUp") {
    plane.setAngle(plane.angle + ANGLE_STEP);
    updateAngleDisplay();
  } else if (event.key === "ArrowDown") {
    plane.setAngle(plane.angle - ANGLE_STEP);
    updateAngleDisplay();
  }
});

fireButton.addEventListener("click", () => {
  const result = plane.fire(functionInput.value);

  if (!result.ok) {
    setStatus(result.error, true);
    return;
  }

  setStatus(`Fired: ${functionInput.value}`, false);
});

newMatchButton.addEventListener("click", () => {
  plane.newMatch();
  updateAngleDisplay();
  setStatus("New match started.", false);
});

plane.onTurnChange = (soldier) => {
  setStatus(`${soldier.team === 1 ? "Blue" : "Red"} team's turn.`, false);
};

plane.onGameOver = (winningTeam) => {
  const label = winningTeam === 1 ? "Blue" : winningTeam === 2 ? "Red" : "Nobody";
  setStatus(`Game over — ${label} team wins.`, false);
};

refreshModeUI();
updateAngleDisplay();
plane.start();
