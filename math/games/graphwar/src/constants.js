// Ported from src/GraphServer/Constants.java (graphwar repo) — only the values
// needed by the trajectory engine and the GraphPlane prototype.

export const PLANE_LENGTH = 770;
export const PLANE_HEIGHT = 450;
export const PLANE_GAME_LENGTH = 50;

export const SOLDIER_RADIUS = 7;
export const EXPLOSION_RADIUS = 12;
export const SOLDIER_MAX_DEATH_TIME = 6000;

export const FUNCTION_VELOCITY = 1500; // steps per second
export const FUNC_FADE_TIME = 1000;
export const NEXT_TURN_DELAY = 3000; // ms after a hit before turn switches

export const FUNC_MAX_STEPS = 20000;
export const FUNC_MAX_STEP_DISTANCE_SQUARED = 0.001;
export const FUNC_MIN_X_STEP_DISTANCE = 0.00001;
export const STEP_SIZE = 0.01;

export const ANGLE_ERROR = Math.PI / 360;
export const MAX_ANGLE_LOOPS = 100;

export const MAX_SOLDIERS_PER_PLAYER = 4;

export const CIRCLE_MEAN_RADIUS = 40;
export const CIRCLE_STANDARD_DEVIATION = 25;
export const NUM_CIRCLES_MEAN_VALUE = 15;
export const NUM_CIRCLES_STANDARD_DEVIATION = 7;

export const TEAM1 = 1;
export const TEAM2 = 2;

export const NORMAL_FUNC = 0;
export const FST_ODE = 1;
export const SND_ODE = 2;

export const NONE = 0;
export const PRE_GAME = 1;
export const GAME = 2;

export const MAX_PLAYERS = 10;

export const PUBLIC_ROOM_PORT = 28842;

export const TIMEOUT_KEEPALIVE = 5000; // send a keepalive after this long idle
export const TIMEOUT_DROP = 300000; // the server drops a connection idle this long
