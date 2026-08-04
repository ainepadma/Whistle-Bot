var petApp = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../third_party/vscode-pets/src/panel/main.ts
  var main_exports = {};
  __export(main_exports, {
    allPets: () => allPets,
    petPanelApp: () => petPanelApp,
    saveState: () => saveState
  });

  // ../third_party/vscode-pets/src/panel/states.ts
  var PetPanelState = class {
    petStates;
    petCounter;
  };
  var BallState = class {
    cx;
    cy;
    vx;
    vy;
    paused;
    constructor(cx, cy, vx, vy) {
      this.cx = cx;
      this.cy = cy;
      this.vx = vx;
      this.vy = vy;
      this.paused = false;
    }
  };
  function isStateAboveGround(state) {
    return state === "climb-wall-left" /* climbWallLeft */ || state === "wall-dig-left" /* wallDigLeft */ || state === "wall-nap" /* wallNap */ || state === "jump-down-left" /* jumpDownLeft */ || state === "land" /* land */ || state === "wall-hang-left" /* wallHangLeft */;
  }
  function resolveState(state, pet) {
    switch (state) {
      case "sit-idle" /* sitIdle */:
        return new SitIdleState(pet);
      case "walk-right" /* walkRight */:
        return new WalkRightState(pet);
      case "walk-left" /* walkLeft */:
        return new WalkLeftState(pet);
      case "run-right" /* runRight */:
        return new RunRightState(pet);
      case "run-left" /* runLeft */:
        return new RunLeftState(pet);
      case "lie" /* lie */:
        return new LieState(pet);
      case "wall-hang-left" /* wallHangLeft */:
        return new WallHangLeftState(pet);
      case "wall-dig-left" /* wallDigLeft */:
        return new WallDigLeftState(pet);
      case "wall-nap" /* wallNap */:
        return new WallNapState(pet);
      case "climb-wall-left" /* climbWallLeft */:
        return new ClimbWallLeftState(pet);
      case "jump-down-left" /* jumpDownLeft */:
        return new JumpDownLeftState(pet);
      case "land" /* land */:
        return new LandState(pet);
      case "swipe" /* swipe */:
        return new SwipeState(pet);
      case "idle-with-ball" /* idleWithBall */:
        return new IdleWithBallState(pet);
      case "chase-friend" /* chaseFriend */:
        return new ChaseFriendState(pet);
      case "stand-right" /* standRight */:
        return new StandRightState(pet);
      case "stand-left" /* standLeft */:
        return new StandLeftState(pet);
    }
    return new SitIdleState(pet);
  }
  var AbstractStaticState = class {
    label = "sit-idle" /* sitIdle */;
    idleCounter;
    spriteLabel = "idle";
    holdTime = 50;
    pet;
    horizontalDirection = 0 /* left */;
    constructor(pet) {
      this.idleCounter = 0;
      this.pet = pet;
    }
    nextFrame() {
      this.idleCounter++;
      if (this.idleCounter > this.holdTime) {
        return 1 /* stateComplete */;
      }
      return 0 /* stateContinue */;
    }
  };
  var SitIdleState = class extends AbstractStaticState {
    label = "sit-idle" /* sitIdle */;
    spriteLabel = "idle";
    horizontalDirection = 1 /* right */;
    holdTime = 50;
  };
  var LieState = class extends AbstractStaticState {
    label = "lie" /* lie */;
    spriteLabel = "lie";
    horizontalDirection = 1 /* right */;
    holdTime = 50;
  };
  var WallHangLeftState = class extends AbstractStaticState {
    label = "wall-hang-left" /* wallHangLeft */;
    spriteLabel = "wallgrab";
    horizontalDirection = 0 /* left */;
    holdTime = 50;
  };
  var WallDigLeftState = class extends AbstractStaticState {
    label = "wall-dig-left" /* wallDigLeft */;
    spriteLabel = "walldig";
    horizontalDirection = 0 /* left */;
    holdTime = 60;
  };
  var WallNapState = class extends AbstractStaticState {
    label = "wall-nap" /* wallNap */;
    spriteLabel = "wallnap";
    horizontalDirection = 1 /* right */;
    holdTime = 50;
  };
  var LandState = class extends AbstractStaticState {
    label = "land" /* land */;
    spriteLabel = "land";
    horizontalDirection = 0 /* left */;
    holdTime = 10;
  };
  var SwipeState = class extends AbstractStaticState {
    label = "swipe" /* swipe */;
    spriteLabel = "swipe";
    horizontalDirection = 2 /* natural */;
    holdTime = 15;
  };
  var IdleWithBallState = class extends AbstractStaticState {
    label = "idle-with-ball" /* idleWithBall */;
    spriteLabel = "with_ball";
    horizontalDirection = 0 /* left */;
    holdTime = 30;
  };
  var WalkRightState = class {
    label = "walk-right" /* walkRight */;
    pet;
    spriteLabel = "walk";
    horizontalDirection = 1 /* right */;
    leftBoundary;
    speedMultiplier = 1;
    idleCounter;
    holdTime = 60;
    constructor(pet) {
      this.leftBoundary = Math.floor(window.innerWidth * 0.95);
      this.pet = pet;
      this.idleCounter = 0;
    }
    nextFrame() {
      this.idleCounter++;
      const newLeft = this.pet.left + this.pet.speed * this.speedMultiplier;
      const maxRight = this.leftBoundary - this.pet.width;
      this.pet.positionLeft(newLeft > maxRight ? maxRight : newLeft);
      if (this.pet.isMoving && this.pet.left >= maxRight) {
        return 1 /* stateComplete */;
      } else if (!this.pet.isMoving && this.idleCounter > this.holdTime) {
        return 1 /* stateComplete */;
      }
      return 0 /* stateContinue */;
    }
  };
  var WalkLeftState = class {
    label = "walk-left" /* walkLeft */;
    spriteLabel = "walk";
    horizontalDirection = 0 /* left */;
    pet;
    speedMultiplier = 1;
    idleCounter;
    holdTime = 60;
    constructor(pet) {
      this.pet = pet;
      this.idleCounter = 0;
    }
    nextFrame() {
      this.idleCounter++;
      const newLeft = this.pet.left - this.pet.speed * this.speedMultiplier;
      this.pet.positionLeft(newLeft < 0 ? 0 : newLeft);
      if (this.pet.isMoving && this.pet.left <= 0) {
        return 1 /* stateComplete */;
      } else if (!this.pet.isMoving && this.idleCounter > this.holdTime) {
        return 1 /* stateComplete */;
      }
      return 0 /* stateContinue */;
    }
  };
  var RunRightState = class extends WalkRightState {
    label = "run-right" /* runRight */;
    spriteLabel = "walk_fast";
    speedMultiplier = 1.6;
    holdTime = 130;
  };
  var RunLeftState = class extends WalkLeftState {
    label = "run-left" /* runLeft */;
    spriteLabel = "walk_fast";
    speedMultiplier = 1.6;
    holdTime = 130;
  };
  var ChaseState = class {
    label = "chase" /* chase */;
    spriteLabel = "run";
    horizontalDirection = 0 /* left */;
    ballState;
    canvas;
    pet;
    constructor(pet, ballState2, canvas2) {
      this.pet = pet;
      this.ballState = ballState2;
      this.canvas = canvas2;
    }
    nextFrame() {
      if (this.ballState.paused) {
        return 2 /* stateCancel */;
      }
      if (this.pet.left > this.ballState.cx) {
        this.horizontalDirection = 0 /* left */;
        this.pet.positionLeft(this.pet.left - this.pet.speed);
      } else {
        this.horizontalDirection = 1 /* right */;
        this.pet.positionLeft(this.pet.left + this.pet.speed);
      }
      if (this.canvas.height - this.ballState.cy < this.pet.width + this.pet.floor && this.ballState.cx < this.pet.left && this.pet.left < this.ballState.cx + 15) {
        this.canvas.style.display = "none";
        this.ballState.paused = true;
        return 1 /* stateComplete */;
      }
      return 0 /* stateContinue */;
    }
  };
  var ChaseFriendState = class {
    label = "chase-friend" /* chaseFriend */;
    spriteLabel = "run";
    horizontalDirection = 0 /* left */;
    pet;
    constructor(pet) {
      this.pet = pet;
    }
    nextFrame() {
      if (!this.pet.hasFriend || !this.pet.friend?.isPlaying) {
        return 2 /* stateCancel */;
      }
      if (this.pet.left > this.pet.friend.left) {
        this.horizontalDirection = 0 /* left */;
        this.pet.positionLeft(this.pet.left - this.pet.speed);
      } else {
        this.horizontalDirection = 1 /* right */;
        this.pet.positionLeft(this.pet.left + this.pet.speed);
      }
      return 0 /* stateContinue */;
    }
  };
  var ClimbWallLeftState = class {
    label = "climb-wall-left" /* climbWallLeft */;
    spriteLabel = "wallclimb";
    horizontalDirection = 0 /* left */;
    pet;
    constructor(pet) {
      this.pet = pet;
    }
    nextFrame() {
      this.pet.positionBottom(this.pet.bottom + this.pet.climbSpeed);
      if (this.pet.bottom >= this.pet.climbHeight) {
        return 1 /* stateComplete */;
      }
      return 0 /* stateContinue */;
    }
  };
  var JumpDownLeftState = class {
    label = "jump-down-left" /* jumpDownLeft */;
    spriteLabel = "fall_from_grab";
    horizontalDirection = 1 /* right */;
    pet;
    constructor(pet) {
      this.pet = pet;
    }
    nextFrame() {
      this.pet.positionBottom(this.pet.bottom - this.pet.fallSpeed);
      if (this.pet.bottom <= this.pet.floor) {
        this.pet.positionBottom(this.pet.floor);
        return 1 /* stateComplete */;
      }
      return 0 /* stateContinue */;
    }
  };
  var StandRightState = class extends AbstractStaticState {
    label = "stand-right" /* standRight */;
    spriteLabel = "stand";
    horizontalDirection = 1 /* right */;
    holdTime = 60;
  };
  var StandLeftState = class extends AbstractStaticState {
    label = "stand-left" /* standLeft */;
    spriteLabel = "stand";
    horizontalDirection = 0 /* left */;
    holdTime = 60;
  };

  // ../third_party/vscode-pets/src/panel/basepettype.ts
  var InvalidStateError = class extends Error {
    fromState;
    petType;
    constructor(fromState, petType) {
      super(`Invalid state ${fromState} for pet type ${petType}`);
      this.fromState = fromState;
      this.petType = petType;
    }
  };
  var BasePetType = class {
    label = "base";
    static count = 0;
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: []
    };
    static possibleColors;
    currentState;
    currentStateEnum;
    holdState;
    holdStateEnum;
    el;
    collision;
    speech;
    _left;
    _bottom;
    petRoot;
    _floor;
    _friend;
    _name;
    _speed;
    _size;
    _climbSpeed = 1;
    _climbHeight = 100;
    _fallSpeed = 5;
    constructor(spriteElement, collisionElement, speechElement, size, left, bottom, petRoot, floor2, name, speed) {
      this.el = spriteElement;
      this.collision = collisionElement;
      this.speech = speechElement;
      this.petRoot = petRoot;
      this._floor = floor2;
      this._left = left;
      this._bottom = bottom;
      this.initSprite(size, left, bottom);
      this.currentStateEnum = this.sequence.startingState;
      this.currentState = resolveState(this.currentStateEnum, this);
      this._name = name;
      this._size = size;
      this._speed = this.randomizeSpeed(speed);
      if (this._name.toLowerCase() === "debug") {
        console.log(
          `Creating pet ${this._name} of size ${this._size} at position (${this._left}, ${this._bottom}) with speed ${this._speed}`
        );
      }
      this.constructor.count += 1;
    }
    initSprite(petSize, left, bottom) {
      this.el.style.left = `${left}px`;
      this.el.style.bottom = `${bottom}px`;
      this.el.style.width = "auto";
      this.el.style.height = "auto";
      this.el.style.maxWidth = `${this.calculateSpriteWidth(petSize)}px`;
      this.el.style.maxHeight = `${this.calculateSpriteWidth(petSize)}px`;
      this.collision.style.left = `${left}px`;
      this.collision.style.bottom = `${bottom}px`;
      this.collision.style.width = `${this.calculateSpriteWidth(petSize)}px`;
      this.collision.style.height = `${this.calculateSpriteWidth(petSize)}px`;
      this.speech.style.left = `${left}px`;
      this.speech.style.bottom = `${bottom + this.calculateSpriteWidth(petSize)}px`;
      this.hideSpeechBubble();
    }
    get left() {
      return this._left;
    }
    get bottom() {
      return this._bottom;
    }
    repositionAccompanyingElements() {
      this.collision.style.left = `${this._left}px`;
      this.collision.style.bottom = `${this._bottom}px`;
      this.speech.style.left = `${this._left}px`;
      this.speech.style.bottom = `${this._bottom + this.calculateSpriteWidth(this._size)}px`;
    }
    calculateSpriteWidth(size) {
      if (size === "nano" /* nano */) {
        return 30;
      } else if (size === "small" /* small */) {
        return 40;
      } else if (size === "medium" /* medium */) {
        return 55;
      } else if (size === "large" /* large */) {
        return 110;
      } else {
        return 30;
      }
    }
    positionBottom(bottom) {
      this._bottom = bottom;
      this.el.style.bottom = `${this._bottom}px`;
      this.repositionAccompanyingElements();
    }
    positionLeft(left) {
      this._left = left;
      this.el.style.left = `${this._left}px`;
      this.repositionAccompanyingElements();
    }
    get width() {
      return this.el.width;
    }
    get floor() {
      return this._floor;
    }
    get hello() {
      return ` says hello \u{1F44B}!`;
    }
    getState() {
      return { currentStateEnum: this.currentStateEnum };
    }
    get speed() {
      return this._speed;
    }
    randomizeSpeed(speed) {
      const min = speed * 0.7;
      const max = speed * 1.3;
      const newSpeed = Math.random() * (max - min) + min;
      return newSpeed;
    }
    /**
     * The speed at which the pet can climb.
     * Default is 1.
     */
    get climbSpeed() {
      return this._climbSpeed;
    }
    /**
     * The height to which a pet can climb.
     * Default is 100.
     */
    get climbHeight() {
      return this._climbHeight;
    }
    /**
     * The speed at which the pet falls when it is in the air.
     * Default is 5.
     */
    get fallSpeed() {
      return this._fallSpeed;
    }
    get isMoving() {
      return this._speed !== 0 /* still */;
    }
    recoverFriend(friend) {
      this._friend = friend;
    }
    recoverState(state) {
      this.currentStateEnum = state.currentStateEnum ?? "sit-idle" /* sitIdle */;
      this.currentState = resolveState(this.currentStateEnum, this);
      if (!isStateAboveGround(this.currentStateEnum)) {
        this.positionBottom(this.floor);
      }
    }
    get canSwipe() {
      return !isStateAboveGround(this.currentStateEnum);
    }
    get canChase() {
      return !isStateAboveGround(this.currentStateEnum) && this.isMoving;
    }
    showSpeechBubble(message, duration = 3e3) {
      this.speech.innerHTML = message;
      this.speech.style.display = "block";
      setTimeout(() => {
        this.hideSpeechBubble();
      }, duration);
    }
    hideSpeechBubble() {
      this.speech.style.display = "none";
    }
    swipe() {
      if (this.currentStateEnum === "swipe" /* swipe */) {
        return;
      }
      this.holdState = this.currentState;
      this.holdStateEnum = this.currentStateEnum;
      this.currentStateEnum = "swipe" /* swipe */;
      this.currentState = resolveState(this.currentStateEnum, this);
      this.showSpeechBubble("\u{1F44B}");
    }
    chase(ballState2, canvas2) {
      this.currentStateEnum = "chase" /* chase */;
      this.currentState = new ChaseState(this, ballState2, canvas2);
    }
    faceLeft() {
      this.el.style.transform = "scaleX(-1)";
    }
    faceRight() {
      this.el.style.transform = "scaleX(1)";
    }
    setAnimation(face) {
      if (this.el.src.endsWith(`_${face}_8fps.gif`)) {
        return;
      }
      this.el.src = `${this.petRoot}_${face}_8fps.gif`;
    }
    chooseNextState(fromState) {
      var possibleNextStates = void 0;
      for (var i = 0; i < this.sequence.sequenceStates.length; i++) {
        if (this.sequence.sequenceStates[i].state === fromState) {
          possibleNextStates = this.sequence.sequenceStates[i].possibleNextStates;
          break;
        }
      }
      if (!possibleNextStates) {
        throw new InvalidStateError(fromState, this.label);
      }
      const idx = Math.floor(Math.random() * possibleNextStates.length);
      return possibleNextStates[idx];
    }
    nextFrame() {
      if (this.currentState.horizontalDirection === 0 /* left */) {
        this.faceLeft();
      } else if (this.currentState.horizontalDirection === 1 /* right */) {
        this.faceRight();
      }
      this.setAnimation(this.currentState.spriteLabel);
      if (this.hasFriend && this.currentStateEnum !== "chase-friend" /* chaseFriend */ && this.isMoving) {
        if (this.friend?.isPlaying && !isStateAboveGround(this.currentStateEnum)) {
          this.currentState = resolveState("chase-friend" /* chaseFriend */, this);
          this.currentStateEnum = "chase-friend" /* chaseFriend */;
          return;
        }
      }
      var frameResult = this.currentState.nextFrame();
      if (frameResult === 1 /* stateComplete */) {
        if (this.holdState && this.holdStateEnum) {
          this.currentState = this.holdState;
          this.currentStateEnum = this.holdStateEnum;
          this.holdState = void 0;
          this.holdStateEnum = void 0;
          return;
        }
        var nextState = this.chooseNextState(this.currentStateEnum);
        this.currentState = resolveState(nextState, this);
        this.currentStateEnum = nextState;
      } else if (frameResult === 2 /* stateCancel */) {
        if (this.currentStateEnum === "chase" /* chase */) {
          var nextState = this.chooseNextState("idle-with-ball" /* idleWithBall */);
          this.currentState = resolveState(nextState, this);
          this.currentStateEnum = nextState;
        } else if (this.currentStateEnum === "chase-friend" /* chaseFriend */) {
          var nextState = this.chooseNextState("idle-with-ball" /* idleWithBall */);
          this.currentState = resolveState(nextState, this);
          this.currentStateEnum = nextState;
        }
      }
    }
    get hasFriend() {
      return this._friend !== void 0;
    }
    get friend() {
      return this._friend;
    }
    get name() {
      return this._name;
    }
    makeFriendsWith(friend) {
      this._friend = friend;
      console.log(this.name, ": I'm now friends \u2764\uFE0F with ", friend.name);
      return true;
    }
    get isPlaying() {
      return this.isMoving && (this.currentStateEnum === "run-right" /* runRight */ || this.currentStateEnum === "run-left" /* runLeft */);
    }
    get emoji() {
      return "\u{1F436}";
    }
    get size() {
      return this._size;
    }
    remove() {
    }
  };

  // ../third_party/vscode-pets/src/panel/pets/bunny.ts
  var Bunny = class extends BasePetType {
    label = "bunny";
    static possibleColors = ["white" /* white */, "purple" /* purple */, "gray" /* gray */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "lie" /* lie */,
          // Will sit idle after lying
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "sit-idle" /* sitIdle */,
          // Can lie back, walk right/left or stand left/right
          possibleNextStates: [
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "stand-left" /* standLeft */,
            "stand-right" /* standRight */
          ]
        },
        {
          state: "stand-left" /* standLeft */,
          // Can lie back, walk right, walk left (twice the chance)
          possibleNextStates: [
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "walk-left" /* walkLeft */
          ]
        },
        {
          state: "stand-right" /* standRight */,
          // Can lie back, walk right, walk left (twice the chance)
          possibleNextStates: [
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */
          ]
        },
        {
          state: "walk-right" /* walkRight */,
          // Can walk left, run right (twice the chance)
          possibleNextStates: [
            "walk-left" /* walkLeft */,
            "run-right" /* runRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "walk-left" /* walkLeft */,
          // Can walk right, run left (twice the chance)
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "run-left" /* runLeft */,
            "run-left" /* runLeft */
          ]
        },
        {
          state: "run-right" /* runRight */,
          // Can walk left or run left (twice the chance)
          possibleNextStates: [
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-left" /* runLeft */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          // After running left always stand
          possibleNextStates: ["stand-left" /* standLeft */]
        },
        {
          state: "chase" /* chase */,
          // After the chase always idle with ball
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          // Can walk right, walk left, run left, run right
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F430}";
    }
    get hello() {
      return `Your pookie bunny ${this.name} hopin' by!`;
    }
  };
  var BUNNY_NAMES = [
    "Bella",
    "Bugs",
    "BunBun",
    "Bunny",
    "Bunny",
    "Boo",
    "Charlie",
    "Coco",
    "Daisy",
    "Daisy",
    "Ginger",
    "Hazel",
    "Honey",
    "Hopper",
    "Lily",
    "Lola",
    "Lucy",
    "Luna",
    "Minnie",
    "Misty",
    "Mocha",
    "Mocha",
    "Molly",
    "Oreo",
    "Penny",
    "Peter",
    "Pookie",
    "Rosie",
    "Ruby",
    "Sandy",
    "Sunny",
    "Thumper",
    "Willow"
  ];

  // ../third_party/vscode-pets/src/panel/pets/cat.ts
  var Cat = class extends BasePetType {
    label = "cat";
    static possibleColors = [
      "black" /* black */,
      "brown" /* brown */,
      "gray" /* gray */,
      "lightbrown" /* lightbrown */,
      "orange" /* orange */,
      "white" /* white */
    ];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "climb-wall-left" /* climbWallLeft */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "climb-wall-left" /* climbWallLeft */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "climb-wall-left" /* climbWallLeft */,
          possibleNextStates: ["wall-hang-left" /* wallHangLeft */]
        },
        {
          state: "wall-hang-left" /* wallHangLeft */,
          possibleNextStates: ["jump-down-left" /* jumpDownLeft */]
        },
        {
          state: "jump-down-left" /* jumpDownLeft */,
          possibleNextStates: ["land" /* land */]
        },
        {
          state: "land" /* land */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F431}";
    }
    get hello() {
      return `brrr... Meow!`;
    }
  };
  var CAT_NAMES = [
    "Bella",
    "Charlie",
    "Molly",
    "Coco",
    "Ruby",
    "Oscar",
    "Lucy",
    "Bailey",
    "Milo",
    "Daisy",
    "Archie",
    "Ollie",
    "Rosie",
    "Lola",
    "Frankie",
    "Roxy",
    "Poppy",
    "Luna",
    "Jack",
    "Millie",
    "Teddy",
    "Cooper",
    "Bear",
    "Rocky",
    "Alfie",
    "Hugo",
    "Bonnie",
    "Pepper",
    "Lily",
    "Tilly",
    "Leo",
    "Maggie",
    "George",
    "Mia",
    "Marley",
    "Harley",
    "Chloe",
    "Lulu",
    "Missy",
    "Jasper",
    "Billy",
    "Nala",
    "Monty",
    "Ziggy",
    "Winston",
    "Zeus",
    "Zoe",
    "Stella",
    "Sasha",
    "Rusty",
    "Gus",
    "Baxter",
    "Dexter",
    "Willow",
    "Barney",
    "Bruno",
    "Penny",
    "Honey",
    "Milly",
    "Murphy",
    "Simba",
    "Holly",
    "Benji",
    "Henry",
    "Lilly",
    "Pippa",
    "Shadow",
    "Sam",
    "Lucky",
    "Ellie",
    "Duke",
    "Jessie",
    "Cookie",
    "Harvey",
    "Bruce",
    "Jax",
    "Rex",
    "Louie",
    "Jet",
    "Banjo",
    "Beau",
    "Ella",
    "Ralph",
    "Loki",
    "Lexi",
    "Chester",
    "Sophie",
    "Chilli",
    "Billie",
    "Louis",
    "Scout",
    "Cleo",
    "Purfect",
    "Spot",
    "Bolt",
    "Julia",
    "Ginger",
    "Daisy",
    "Amelia",
    "Oliver",
    "Ghost",
    "Midnight",
    "Pumpkin",
    "Shadow",
    "Binx",
    "Riley",
    "Lenny",
    "Mango",
    "Alex",
    "Boo",
    "Botas",
    "Romeo",
    "Bob",
    "Clyde",
    "Simon",
    "Mimmo",
    "Carlotta",
    "Felix",
    "Duchess",
    "Byrt",
    "Nianian",
    "Twylah",
    "Giselle"
  ];

  // ../third_party/vscode-pets/src/panel/pets/chicken.ts
  var Chicken = class extends BasePetType {
    label = "chicken";
    static possibleColors = ["white" /* white */, "brown" /* brown */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "run-right" /* runRight */,
            "swipe" /* swipe */
          ]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "swipe" /* swipe */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */,
            "swipe" /* swipe */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F414}";
    }
    get hello() {
      return ` Puk Puk Pukaaak - just let me lay my egg. \u{1F95A}`;
    }
  };
  var CHICKEN_NAMES = [
    "Hen Solo",
    "Cluck Vader",
    "Obi Wan Henobi",
    "Albert Eggstein",
    "Abrahen Lincoln",
    "Cluck Norris",
    "Sir Clucks-A-Lot",
    "Frank-hen-stein",
    "Richard",
    "Dixi",
    "Nugget",
    "Bella",
    "Cotton",
    "Pip",
    "Lucky",
    "Polly",
    "Mirabel",
    "Elsa",
    "Bon-Bon",
    "Ruby",
    "Rosie",
    "Teriyaki",
    "Penguin",
    "Sybil"
  ];

  // ../third_party/vscode-pets/src/panel/pets/morph.ts
  var Morph = class extends BasePetType {
    label = "morph";
    static possibleColors = ["purple" /* purple */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F7E3}";
    }
    get hello() {
      return ` Spider psycho. \u{1F577}\uFE0F`;
    }
  };
  var MORPH_NAMES = ["Morph"];

  // ../third_party/vscode-pets/src/panel/pets/clippy.ts
  var Clippy = class extends BasePetType {
    label = "clippy";
    static possibleColors = [
      "black" /* black */,
      "brown" /* brown */,
      "green" /* green */,
      "yellow" /* yellow */
    ];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F4CE}";
    }
    get hello() {
      return ` Hi, I'm Clippy, would you like some assistance today? \u{1F44B}!`;
    }
  };
  var CLIPPY_NAMES = [
    "Clippy",
    "Karl Klammer",
    "Clippy Jr.",
    "Molly",
    "Coco",
    "Buddy",
    "Ruby",
    "Oscar",
    "Lucy",
    "Bailey"
  ];

  // ../third_party/vscode-pets/src/panel/pets/cockatiel.ts
  var Cockatiel = class extends BasePetType {
    label = "cockatiel";
    static possibleColors = ["gray" /* gray */, "brown" /* brown */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F99C}";
    }
    get hello() {
      return ` Hello, I'm a good bird \u{1F44B}!`;
    }
  };
  var COCKATIEL_NAMES = [
    "Cocktail",
    "Pipsqueak",
    "Sir Chirps a Lot",
    "Nibbles",
    "Lord of the Wings",
    "Girl Nest Door",
    "Wingman",
    "Meryl Cheep",
    "Jack Sparrow",
    "Godfeather",
    "Mickey",
    "Baquack Obama",
    "Dame Judi Finch",
    "Kanye Nest",
    "Speck",
    "Cheecky",
    "Arthur",
    "Paco",
    "Bobo",
    "Walt",
    "Happy",
    "Junior",
    "Coco",
    "Yoyo",
    "Milo",
    "Skipper",
    "Scarlet",
    "Diva",
    "Ursula",
    "Donna",
    "Lola",
    "Kiko",
    "Luna"
  ];

  // ../third_party/vscode-pets/src/panel/pets/crab.ts
  var Crab = class extends BasePetType {
    label = "crab";
    static possibleColors = ["red" /* red */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F980}";
    }
    get hello() {
      return ` Hi, I'm Crabsolutely Clawsome Crab \u{1F44B}!`;
    }
  };
  var CRAB_NAMES = [
    "Ferris",
    "Pinchy",
    "Grabby",
    "Big Red",
    "Crabby",
    "Buddy",
    "Ruby Red",
    "Oscar",
    "Lucy",
    "Bailey",
    "Crabito",
    "Percy",
    "Rocky",
    "Mr. Krabs",
    "Shelly",
    "Santa Claws",
    "Clawdia",
    "Scuttle",
    "Snappy",
    "Hermit",
    "Horseshoe",
    "Snapper",
    "Coconut",
    "Sebastian",
    "Abby",
    "Bubbles",
    "Bait",
    "Big Mac",
    "Biggie",
    "Claws",
    "Copper",
    "Crabette",
    "Crabina",
    "Crabmister",
    "Crusty",
    "Crabcake",
    "Digger",
    "Nipper",
    "Pincer",
    "Poopsie",
    "Recluse",
    "Salty",
    "Squirt",
    "Groucho",
    "Grumpy",
    "Lenny Krabitz",
    "Leonardo DaPinchy",
    "Peeves",
    "Penny Pincher",
    "Prickl"
  ];

  // ../third_party/vscode-pets/src/panel/pets/deno.ts
  var Deno = class extends BasePetType {
    label = "deno";
    static possibleColors = ["green" /* green */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F995}";
    }
    get hello() {
      return `I \u2764\uFE0F TS`;
    }
  };
  var DENO_NAMES = [
    "Dee",
    "Dee Dee",
    "Deno",
    "Deno Jr.",
    "Deno the Dino",
    "Deploydocus",
    "Dino",
    "Dippy",
    "Dr Deno",
    "Herby",
    "Littlefoot",
    "Ry"
  ];

  // ../third_party/vscode-pets/src/panel/pets/dog.ts
  var Dog = class extends BasePetType {
    label = "dog";
    static possibleColors = [
      "black" /* black */,
      "brown" /* brown */,
      "white" /* white */,
      "red" /* red */,
      "akita" /* akita */
    ];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "run-right" /* runRight */,
            "lie" /* lie */
          ]
        },
        {
          state: "lie" /* lie */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F436}";
    }
    get hello() {
      return ` Every dog has its day - and today is woof day! Today I just want to bark. Take me on a walk`;
    }
  };
  var DOG_NAMES = [
    "Bella",
    "Charlie",
    "Max",
    "Molly",
    "Coco",
    "Buddy",
    "Ruby",
    "Oscar",
    "Lucy",
    "Bailey",
    "Milo",
    "Daisy",
    "Archie",
    "Ollie",
    "Rosie",
    "Lola",
    "Frankie",
    "Toby",
    "Roxy",
    "Poppy",
    "Luna",
    "Jack",
    "Millie",
    "Teddy",
    "Harry",
    "Cooper",
    "Bear",
    "Rocky",
    "Alfie",
    "Hugo",
    "Bonnie",
    "Pepper",
    "Lily",
    "Leo",
    "Maggie",
    "George",
    "Mia",
    "Marley",
    "Harley",
    "Chloe",
    "Lulu",
    "Jasper",
    "Billy",
    "Nala",
    "Monty",
    "Ziggy",
    "Winston",
    "Zeus",
    "Zoe",
    "Stella",
    "Sasha",
    "Rusty",
    "Gus",
    "Baxter",
    "Dexter",
    "Diesel",
    "Willow",
    "Barney",
    "Bruno",
    "Penny",
    "Honey",
    "Milly",
    "Murphy",
    "Holly",
    "Benji",
    "Henry",
    "Lilly",
    "Pippa",
    "Shadow",
    "Sam",
    "Buster",
    "Lucky",
    "Ellie",
    "Duke",
    "Jessie",
    "Cookie",
    "Harvey",
    "Bruce",
    "Jax",
    "Rex",
    "Louie",
    "Bentley",
    "Jet",
    "Banjo",
    "Beau",
    "Ella",
    "Ralph",
    "Loki",
    "Lexi",
    "Chester",
    "Sophie",
    "Billie",
    "Louis",
    "Charlie",
    "Cleo",
    "Spot",
    "Harry",
    "Bolt",
    "Ein",
    "Maddy",
    "Ghost",
    "Midnight",
    "Pumpkin",
    "Shadow",
    "Sparky",
    "Linus",
    "Cody",
    "Slinky",
    "Toto",
    "Balto",
    "Golfo",
    "Pongo",
    "Beethoven",
    "Hachiko",
    "Scooby",
    "Clifford",
    "Astro",
    "Goofy",
    "Chip",
    "Einstein",
    "Fang",
    "Truman",
    "Uggie",
    "Bingo",
    "Blue",
    "Cometa",
    "Krypto",
    "Huesos",
    "Odie",
    "Snoopy",
    "Aisha",
    "Moly",
    "Chiquita",
    "Chavela",
    "Tramp",
    "Lady",
    "Puddles",
    "Gunun"
  ];

  // ../third_party/vscode-pets/src/panel/pets/fox.ts
  var Fox = class extends BasePetType {
    label = "fox";
    static possibleColors = ["red" /* red */, "white" /* white */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: [
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-right" /* runRight */,
            "run-left" /* runLeft */
          ]
        },
        {
          state: "lie" /* lie */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-right" /* runRight */,
            "run-left" /* runLeft */
          ]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */
          ]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: [
            "lie" /* lie */,
            "sit-idle" /* sitIdle */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: [
            "lie" /* lie */,
            "sit-idle" /* sitIdle */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-right" /* runRight */,
            "run-left" /* runLeft */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F98A}";
    }
    get hello() {
      return `fox says hello`;
    }
  };
  var FOX_NAMES = [
    "Arizona",
    "Frankie",
    "Rosy",
    "Cinnamon",
    "Ginger",
    "Todd",
    "Rocky",
    "Felix",
    "Sandy",
    "Archie",
    "Flynn",
    "Foxy",
    "Elmo",
    "Ember",
    "Hunter",
    "Otto",
    "Sonic",
    "Amber",
    "Maroon",
    "Spark",
    "Sparky",
    "Sly",
    "Scout",
    "Penny",
    "Ash",
    "Rose",
    "Apollo",
    "Chili",
    "Blaze",
    "Radish",
    "Scarlett",
    "Juliet",
    "Goldie",
    "Rooney",
    "Paprika",
    "Alpine",
    "Rusty",
    "Maple",
    "Vixen",
    "David",
    "Apricot",
    "Claire",
    "Wilma",
    "Copper",
    "Pepper",
    "Crimson",
    "Ariel",
    "Arvi",
    "George",
    "Eva",
    "Fuzzy",
    "Russell",
    "Rufus",
    "Mystic",
    "Leopold",
    "Scully",
    "Ferris",
    "Robin",
    "Zorro",
    "Scarlet",
    "Comet",
    "Rowan",
    "Jake",
    "Hope",
    "Molly",
    "Mars",
    "Apple",
    "Geneva",
    "Redford",
    "Chestnut",
    "Evelyn",
    "Red",
    "Aurora",
    "Agniya",
    "Fitz",
    "Crispin",
    "Sunny",
    "Autumn",
    "Bridget",
    "Ruby",
    "Iris",
    "Pumpkin",
    "Rose",
    "Rosie",
    "Vesta",
    "Adolf",
    "Lava",
    "Conan",
    "Flame",
    "Oswald",
    "Tails",
    "Chester",
    "Jasper",
    "Finch",
    "Scarlet",
    "Chewy",
    "Finnick",
    "Biscuit",
    "Prince Harry",
    "Loki",
    "Pip",
    "Pippin"
  ];

  // ../third_party/vscode-pets/src/panel/pets/frog.ts
  var Frog = class extends BasePetType {
    label = "frog";
    static possibleColors = ["red" /* red */, "green" /* green */, "blue" /* blue */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F438}";
    }
    get hello() {
      return Math.random() > 0.5 ? `croak...` : `ribbit!`;
    }
  };
  var FROG_NAMES = [
    "Blinky",
    "Bubbles",
    "Drift",
    "Frogger",
    "Freddy",
    "Hopper",
    "Jumpy",
    "Kermit",
    "Lily",
    "Leapster",
    "Marsh",
    "Misty",
    "Moss",
    "Pebbles",
    "Pip",
    "Pondy",
    "Quagmire",
    "Rango",
    "Razor",
    "Slick",
    "Swamper",
    "Swampy",
    "Sprout",
    "Thistle",
    "Tad",
    "Toady",
    "Warty",
    "Willow",
    "Wiggle"
  ];

  // ../third_party/vscode-pets/src/panel/pets/mod.ts
  var Mod = class extends BasePetType {
    label = "mod";
    static possibleColors = ["purple" /* purple */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F916}";
    }
    get hello() {
      return ` Hi, I'm Mod the dotnet bot, what are you building today?`;
    }
  };
  var MOD_NAMES = [
    "Mod",
    "Moddy",
    "Dotnetbot",
    "Bot",
    "Purple Pal",
    "Ro Bot"
  ];

  // ../third_party/vscode-pets/src/panel/pets/panda.ts
  var Panda = class extends BasePetType {
    label = "panda";
    static possibleColors = ["black" /* black */, "brown" /* brown */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "run-right" /* runRight */,
            "lie" /* lie */
          ]
        },
        {
          state: "lie" /* lie */,
          possibleNextStates: ["walk-right" /* walkRight */, "walk-left" /* walkLeft */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "lie" /* lie */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */
          ]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "lie" /* lie */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */
          ]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: ["sit-idle" /* sitIdle */, "lie" /* lie */]
        }
      ]
    };
    get emoji() {
      return "\u{1F43C}";
    }
    get hello() {
      return `Zzzz bamboo`;
    }
  };
  var PANDA_NAMES = [
    "Boba",
    "Winnie",
    "Teddy",
    "Luna",
    "Tofu",
    "Mochi",
    "Coco",
    "Hana",
    "Beiei",
    "Jinging",
    "Huanan",
    "Yingng",
    "Nini"
  ];

  // ../third_party/vscode-pets/src/panel/pets/rocky.ts
  var Rocky = class extends BasePetType {
    label = "rocky";
    static possibleColors = ["gray" /* gray */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["sit-idle" /* sitIdle */, "run-right" /* runRight */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["sit-idle" /* sitIdle */, "walk-right" /* walkRight */]
        }
      ]
    };
    get emoji() {
      return "\u{1F48E}";
    }
    get canChase() {
      return false;
    }
    get hello() {
      return ` \u{1F44B} I'm rock! I always Rock`;
    }
  };
  var ROCKY_NAMES = [
    "Rocky",
    "The Rock",
    "Quartzy",
    "Rocky I",
    "Rocky II",
    "Rocky III",
    "Pebbles Sr.",
    "Big Granite",
    "Boulder",
    "Rockefeller",
    "Pebble",
    "Rocksanne",
    "Rockstar",
    "Onix",
    "Rock and Roll",
    "Dolomite",
    "Granite",
    "Miss Marble",
    "Rock On",
    "Amberstone",
    "Rock With Me",
    "Rock On It",
    "Rock Out"
  ];

  // ../third_party/vscode-pets/src/panel/pets/rubberduck.ts
  var RubberDuck = class extends BasePetType {
    label = "rubber-duck";
    static possibleColors = ["yellow" /* yellow */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F425}";
    }
    get hello() {
      return ` Hi, I love to quack around \u{1F44B}!`;
    }
  };
  var DUCK_NAMES = [
    "Quacky",
    "Floaty",
    "Duck",
    "Molly",
    "Sunshine",
    "Buddy",
    "Chirpy",
    "Oscar",
    "Lucy",
    "Bailey",
    "Beaky",
    "Jemima",
    "Peaches",
    "Quackers",
    "Jelly Beans",
    "Donald",
    "Chady",
    "Waddles",
    "Bill",
    "Bubbles",
    "James Pond",
    "Moby Duck",
    "Quack Sparrow",
    "Peanut",
    "Psyduck",
    "Mr Quack",
    "Louie",
    "Golduck",
    "Daisy",
    "Pickles",
    "Ducky Duck",
    "Mrs Fluffs",
    "Squeek",
    "Ace",
    "Rubberduck",
    "Mrs Beak",
    "April",
    "Tutu",
    "Billy the duck",
    "Ducky",
    "Neco",
    "Dodo",
    "Colonel",
    "Franklin",
    "Emmett",
    "Bubba",
    "Dillard",
    "Duncan",
    "Pogo",
    "Uno",
    "Peanut",
    "Nero",
    "Mowgli",
    "Eggspresso",
    "Webster",
    "Quacker Jack",
    "Plucker",
    "Meeko"
  ];

  // ../third_party/vscode-pets/src/panel/pets/skeleton.ts
  var getRandomElement = (array) => {
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
  };
  var Skeleton = class extends BasePetType {
    constructor(spriteElement, collisionElement, speechElement, size, left, bottom, petRoot, floor2, name, speed) {
      const petRootClean = petRoot.replace(" ", "_");
      super(
        spriteElement,
        collisionElement,
        speechElement,
        size,
        left,
        bottom,
        petRootClean,
        floor2,
        name,
        speed
      );
    }
    label = "skeleton";
    static possibleColors = [
      "white" /* white */,
      "brown" /* brown */,
      "purple" /* purple */,
      "blue" /* blue */,
      "pink" /* pink */,
      "yellow" /* yellow */,
      "green" /* green */,
      "red" /* red */,
      "orange" /* orange */,
      "warrior" /* warrior */
    ];
    sequence = {
      startingState: "stand-right" /* standRight */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          // Only on first adding the skeleton
          possibleNextStates: ["walk-right" /* walkRight */]
        },
        {
          state: "stand-right" /* standRight */,
          // Can start walking either direction (twice as likely to keep going right), or just keep standing
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "stand-right" /* standRight */
          ]
        },
        {
          state: "stand-left" /* standLeft */,
          // Can start walking either direction (twice as likely to keep going left), or just keep standing
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "walk-left" /* walkLeft */,
            "stand-left" /* standLeft */
          ]
        },
        {
          state: "walk-right" /* walkRight */,
          // Can switch directions or stand still
          possibleNextStates: ["walk-left" /* walkLeft */, "stand-right" /* standRight */]
        },
        {
          state: "walk-left" /* walkLeft */,
          // Can switch directions or stand still
          possibleNextStates: ["walk-right" /* walkRight */, "stand-left" /* standLeft */]
        },
        {
          state: "chase" /* chase */,
          // After the chase, the skeleton has the ball!
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "swipe" /* swipe */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          // Can go back to walking
          possibleNextStates: ["walk-right" /* walkRight */, "walk-left" /* walkLeft */]
        }
      ]
    };
    get emoji() {
      if (this.name.toLowerCase() === "beau") {
        return "\u{1F921}";
      }
      if (this.petRoot.endsWith("warrior")) {
        return getRandomElement(["\u{1F5E1}\uFE0F", "\u{1F3F4}\u200D\u2620\uFE0F", "\u2694\uFE0F"]);
      }
      return "\u{1F480}";
    }
    get hello() {
      let response = "Bone to be Wild!";
      switch (this.name.toLowerCase()) {
        case "crypt keeper":
          response = "Hello, kiddies!";
          break;
        case "hugo":
          response = "I'm the world's laziest skeleton!";
          break;
        case "skeletor":
          response = "I have the power!";
          break;
        case "jack skellington":
          response = "Eureka! Merry Christmas!";
          break;
        case "scorpion":
          response = "Get over here!";
          break;
        case "walter donovan":
          response = "Choose wisely.";
          break;
      }
      if (this.petRoot.endsWith("warrior")) {
        response = response.toUpperCase();
      }
      if (this.name.toLowerCase() === "warner") {
        return `\u{1F49C} ${response} \u{1F9E1}`;
      }
      return response;
    }
    swipe() {
      if (this.currentStateEnum === "swipe" /* swipe */) {
        return;
      }
      this.holdState = this.currentState;
      this.holdStateEnum = this.currentStateEnum;
      this.currentStateEnum = "swipe" /* swipe */;
      this.currentState = resolveState(this.currentStateEnum, this);
      this.showSpeechBubble(
        this.petRoot.endsWith("orange") ? "\u{1F383}" : this.petRoot.endsWith("warrior") ? "\u{1F3F4}\u200D\u2620\uFE0F" : "\u2620\uFE0F"
      );
    }
    chooseNextState(fromState) {
      const nextState = super.chooseNextState(fromState);
      if (this.name.toLowerCase() === "debug") {
        console.log(`${this.label}-> \x1B[1m${nextState}\x1B[0m`);
      }
      return nextState;
    }
  };
  var SKELETON_NAMES = [
    "Sans",
    //Undertale
    "Papyrus",
    //Undertale
    "Red Skull",
    //Marvel
    "Ghost Rider",
    //Marvel
    "Skeletor",
    //He-Man
    "Jack Skellington",
    //Nightmare Before Christmas
    "Grim",
    //Grim Adventures of Billy and Mandy
    "Brook",
    //One Piece
    "Bonejangles",
    //Corpse Bride
    "Smitty Werbenjagermanjensen",
    //SpongeBob
    "The Lich",
    //Adventure Time
    "Crypt Keeper",
    //Tales from the Crypt
    "Scorpion",
    //Mortal Kombat
    "Eddie",
    //Iron Maiden
    "Mister Bones",
    //DC
    "Imhotep",
    //The Mummy
    "Nito",
    //Dark Souls
    "Spinal",
    //Killer Instinct
    "Geoff Peterson",
    //The Late Late Show with Craig Ferguson
    "Horrorman",
    //Anpanman
    "Baron Samedi",
    //James Bond
    "Skelly",
    "Yorick",
    //Hamlet
    "Lucy",
    "Hugo",
    "The Horned King",
    //The Black Cauldron
    "Walter Donovan",
    //Indiana Jones and the Last Crusade
    "Sherlock Bones",
    "Napolean Bone-aparte",
    "Skellyman"
  ];

  // ../third_party/vscode-pets/src/panel/pets/snail.ts
  var Snail = class extends BasePetType {
    label = "snail";
    static possibleColors = ["brown" /* brown */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F40C}";
    }
    get hello() {
      return "hello! \u{1F44B}";
    }
  };
  var SNAIL_NAMES = [
    "Flash",
    "Sonwy",
    "Shally",
    "Taggy"
  ];

  // ../third_party/vscode-pets/src/panel/pets/snake.ts
  var Snake = class extends BasePetType {
    label = "snake";
    static possibleColors = ["green" /* green */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F40D}";
    }
    get hello() {
      return `Sss... Oh. Oh my gosh! I'm a snake!`;
    }
  };
  var SNAKE_NAMES = [
    "Sneaky",
    "Mr Slippery",
    "Hissy Elliott",
    "Molly",
    "Coco",
    "Buddy",
    "Ruby",
    "Bailey",
    "Max",
    "Seb",
    "Kaa",
    "Mr Hiss",
    "Miss Hiss",
    "Snaku",
    "Kaa",
    "Madame Snake",
    "Sir Hiss",
    "Loki",
    "Steelix",
    "Gyarados",
    "Seviper",
    "Ekanes",
    "Arbok",
    "Snivy",
    "Servine",
    "Serperior",
    "Mojo",
    "Moss",
    "Nigel",
    "Tootsie",
    "Sammy",
    "Ziggy",
    "Asmodeus",
    "Attila",
    "Basil",
    "Diablo",
    "Eden",
    "Eve",
    "Heaven",
    "Hydra",
    "Indiana",
    "Jafaar",
    "Kaa",
    "Medusa",
    "Naga",
    "Severus",
    "Slytherin",
    "Snape",
    "Raven",
    "Slider",
    "Slinky",
    "Stripes"
  ];

  // ../third_party/vscode-pets/src/panel/pets/squirrel.ts
  var getRandomIntegerInRange = (low, high) => {
    if (low > high) {
      [low, high] = [high, low];
    }
    const min = Math.ceil(low);
    const max = Math.floor(high);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  var getRandomElement2 = (array) => {
    const randomIndex = getRandomIntegerInRange(0, array.length - 1);
    return array[randomIndex];
  };
  var Squirrel = class extends BasePetType {
    _resizeListener;
    constructor(spriteElement, collisionElement, speechElement, size, left, bottom, petRoot, floor2, name, speed) {
      const petRootClean = petRoot.replace(" ", "_");
      super(
        spriteElement,
        collisionElement,
        speechElement,
        size,
        left,
        bottom,
        petRootClean,
        floor2,
        name,
        speed * 1.15
      );
      this._climbSpeed = 7;
      this._fallSpeed = 15;
      this._resizeListener = () => {
        this.adjustClimbHeight();
      };
      window.addEventListener("resize", this._resizeListener);
      this.adjustClimbHeight();
    }
    label = "squirrel";
    static possibleColors = [
      "gray" /* gray */,
      "black" /* black */,
      "brown" /* brown */,
      "purple" /* purple */,
      "white" /* white */
    ];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "walk-left" /* walkLeft */]
        },
        {
          state: "stand-right" /* standRight */,
          // Can start walking either direction, or run to the right
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "run-right" /* runRight */,
            "walk-left" /* walkLeft */
          ]
        },
        {
          state: "stand-left" /* standLeft */,
          // Can start walking either direction, or run to the left
          possibleNextStates: [
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "walk-right" /* walkRight */,
            "climb-wall-left" /* climbWallLeft */
          ]
        },
        {
          state: "walk-right" /* walkRight */,
          // Can stand, start running, or switch directions
          possibleNextStates: [
            "stand-right" /* standRight */,
            "run-right" /* runRight */,
            "walk-left" /* walkLeft */,
            "walk-right" /* walkRight */
          ]
        },
        {
          state: "walk-left" /* walkLeft */,
          // Can stand, start running, or switch directions
          possibleNextStates: [
            "stand-left" /* standLeft */,
            "run-left" /* runLeft */,
            "climb-wall-left" /* climbWallLeft */,
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */
          ]
        },
        {
          state: "run-right" /* runRight */,
          // Can switch directions or slow down to a walk (twice as likely), or even abruptly stop to eat
          possibleNextStates: [
            "run-left" /* runLeft */,
            "walk-right" /* walkRight */,
            "walk-right" /* walkRight */,
            "stand-right" /* standRight */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          // Can switch directions or slow down to a walk (twice as likely), or even abruptly stop to eat
          possibleNextStates: [
            "run-right" /* runRight */,
            "walk-left" /* walkLeft */,
            "walk-left" /* walkLeft */,
            "stand-left" /* standLeft */,
            "climb-wall-left" /* climbWallLeft */
          ]
        },
        {
          state: "climb-wall-left" /* climbWallLeft */,
          possibleNextStates: ["wall-dig-left" /* wallDigLeft */]
        },
        {
          state: "wall-dig-left" /* wallDigLeft */,
          possibleNextStates: ["wall-nap" /* wallNap */]
        },
        {
          state: "wall-nap" /* wallNap */,
          possibleNextStates: ["wall-hang-left" /* wallHangLeft */]
        },
        {
          state: "wall-hang-left" /* wallHangLeft */,
          possibleNextStates: ["jump-down-left" /* jumpDownLeft */]
        },
        {
          state: "jump-down-left" /* jumpDownLeft */,
          possibleNextStates: ["land" /* land */]
        },
        {
          state: "land" /* land */,
          possibleNextStates: ["sit-idle" /* sitIdle */, "run-right" /* runRight */]
        },
        {
          state: "chase" /* chase */,
          // After the chase, the squirrel has the ball!
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "swipe" /* swipe */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          // Eat the ball, then go back to running
          possibleNextStates: ["run-right" /* runRight */, "run-left" /* runLeft */]
        }
      ]
    };
    get emoji() {
      return "\u{1F43F}\uFE0F";
    }
    get hello() {
      let response = "Got any nuts?!";
      switch (this.name.toLowerCase()) {
        case "bruce":
          response = "Wanna get nuts? Let's get nuts!";
          break;
        case "hugo":
          response = "I'm the world's laziest squirrel!";
          break;
        case "rocky":
          response = "Oh, Bullwinkle! You did it again!";
          break;
        case "slappy":
          response = "You remind me of...";
          break;
        case "bucky":
          response = "\u{1F388}\u{1FAA1}? \u{1F406}\u{1F406}";
          break;
        case "sandy":
          response = "I don\u2019t cry, I sweat through my eyes!";
          break;
        case "sinan":
        case "twiggy":
          response = "Go Vols! \u{1F34A}";
          break;
        case "charlie":
          response = "Charie DO know!";
          break;
        case "noah":
          response = "Is that a \u{1F327}\uFE0F\u{1F30E} reference?";
          break;
        case "eleanor":
          response = "Meow?";
          break;
      }
      return response;
    }
    swipe() {
      if (this.currentStateEnum === "swipe" /* swipe */) {
        return;
      }
      this.holdState = this.currentState;
      this.holdStateEnum = this.currentStateEnum;
      this.currentStateEnum = "swipe" /* swipe */;
      this.currentState = resolveState(this.currentStateEnum, this);
      const food = getRandomElement2(["\u{1F330}", "\u{1F355}", "\u{1F968}", "\u{1F95C}", "\u{1F961}", "\u{1F34F}"]);
      this.showSpeechBubble(`${food}?`);
    }
    chooseNextState(fromState) {
      const nextState = super.chooseNextState(fromState);
      if (this.name.toLowerCase() === "debug") {
        console.log(`${this.label}-> \x1B[1m${nextState}\x1B[0m`);
      }
      return nextState;
    }
    _variation = 0;
    _variationCounter = 0;
    _variationTimer = 10;
    get climbSpeed() {
      this._variationCounter++;
      if (this._variationCounter >= this._variationTimer) {
        this._variation = Math.floor(Math.random() * 6) - 4;
        this._variationTimer = Math.floor(Math.random() * 16) + 10;
        this._variationCounter = 0;
      }
      return this._climbSpeed + this._variation;
    }
    adjustClimbHeight() {
      const viewportHeight = window.innerHeight;
      const elementHeight = this.calculateSpriteWidth(this.size);
      const minHeight = Math.floor(viewportHeight * 0.3);
      const maxHeight = Math.floor(viewportHeight * 0.8);
      this._climbHeight = getRandomIntegerInRange(
        Math.max(elementHeight * 2, minHeight),
        Math.min(viewportHeight - elementHeight, maxHeight)
      );
      if (this.name.toLowerCase() === "debug") {
        console.log(
          `Squirrel ${this.name} adjusted climb height to ${this._climbHeight} (viewport: ${viewportHeight}, element: ${elementHeight})`
        );
      }
    }
    remove() {
      if (this._resizeListener) {
        window.removeEventListener("resize", this._resizeListener);
        this._resizeListener = void 0;
      }
      super.remove();
    }
  };
  var SQUIRREL_NAMES = [
    "Twiggy",
    // Water-skiing squirrel from Knoxville
    "Scrat",
    // Ice Age
    "Rocky",
    // Rocky and Bullwinkle
    "Sandy",
    // Sandy Cheeks from Spongebob
    "Secret Squirrel",
    // The Atom Ant
    "Slappy",
    // Slappy the Squirrel from Animaniacs
    "Skippy",
    // Skippy Squirrel from Animaniacs
    "Conker",
    // Conker's Bad Fur Day
    "Bucky",
    // Emperor's New Groove
    "Guinevere",
    // Guinevere the Squirrel from The Sword in the Stone
    "Sally",
    // Sonic the Hedgehog and Pete the Cat - Wowee!
    "Chitter",
    // Smurfs
    "Squeaks",
    // Looney Tunes
    "Sinan",
    // World's Smallest Vol Fan
    "Nutsy",
    // Robin Hood
    "Lady Timbertail",
    // Ferngully 2
    "Nibbles",
    // Tom and Jerry
    "Nutty",
    // Happy Tree Friends
    "Twitchy",
    // Hoodwinked and Kung Fu Panda
    "Nutkin",
    // The Tale of Squirrel Nutkin
    "Acornelia",
    // Magic the Gathering
    "Sneezy",
    // Penn State Squirrel
    "Scamper",
    "Peanut",
    "Eleanor",
    "Acorn",
    "Bruce",
    "Walnut",
    "Hazel",
    "Noah",
    "Henry",
    "Ranger",
    "Link",
    "Tomato",
    "Charlie",
    "Pinecone"
  ];

  // ../third_party/vscode-pets/src/panel/pets/totoro.ts
  var Totoro = class extends BasePetType {
    label = "totoro";
    static possibleColors = ["gray" /* gray */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "lie" /* lie */]
        },
        {
          state: "lie" /* lie */,
          possibleNextStates: ["walk-right" /* walkRight */, "walk-left" /* walkLeft */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "sit-idle" /* sitIdle */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "climb-wall-left" /* climbWallLeft */,
            "sit-idle" /* sitIdle */
          ]
        },
        {
          state: "climb-wall-left" /* climbWallLeft */,
          possibleNextStates: ["wall-hang-left" /* wallHangLeft */]
        },
        {
          state: "wall-hang-left" /* wallHangLeft */,
          possibleNextStates: ["jump-down-left" /* jumpDownLeft */]
        },
        {
          state: "jump-down-left" /* jumpDownLeft */,
          possibleNextStates: ["land" /* land */]
        },
        {
          state: "land" /* land */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "walk-right" /* walkRight */,
            "lie" /* lie */
          ]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: ["walk-right" /* walkRight */, "walk-left" /* walkLeft */]
        }
      ]
    };
    get emoji() {
      return "\u{1F43E}";
    }
    get hello() {
      return `Try Laughing. Then Whatever Scares You Will Go Away. \u{1F3AD}`;
    }
  };
  var TOTORO_NAMES = [
    "Totoro",
    "\u30C8\u30C8\u30ED",
    "Max",
    "Molly",
    "Coco",
    "Buddy",
    "Ruby",
    "Oscar",
    "Lucy",
    "Bailey",
    "Big fella"
  ];

  // ../third_party/vscode-pets/src/panel/pets/zappy.ts
  var Zappy = class extends BasePetType {
    label = "zappy";
    static possibleColors = ["yellow" /* yellow */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u26A1";
    }
    get hello() {
      return ` Hello this is Zappy! Do I look familiar?? I am the mascot for Azure Functions\u{1F609}`;
    }
  };
  var ZAPPY_NAMES = [
    "Zappy",
    "Zippy",
    "Zappy Jr.",
    "Zoppy",
    "Zuppy",
    "Zeppy",
    "Big Z",
    "Little z",
    "The Flash",
    "Thor",
    "Electric Bolt",
    "Azula",
    "Lightning Bolt",
    "Power",
    "Sonic",
    "Speedy",
    "Rush"
  ];

  // ../third_party/vscode-pets/src/panel/pets/rat.ts
  var Rat = class extends BasePetType {
    label = "rat";
    static possibleColors = ["gray" /* gray */, "white" /* white */, "brown" /* brown */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F400}";
    }
    get hello() {
      return `Rat noises...`;
    }
  };
  var RAT_NAMES = [
    "Molly",
    "Coco",
    "Ruby",
    "Lucy",
    "Milo",
    "Daisy",
    "Archie",
    "Ollie",
    "Rosie",
    "Lola",
    "Frankie",
    "Roxy",
    "Poppy",
    "Luna",
    "Millie",
    "Rocky",
    "Alfie",
    "Hugo",
    "Pepper",
    "Lily",
    "Tilly",
    "Leo",
    "Maggie",
    "Mia",
    "Chloe",
    "Lulu",
    "Missy",
    "Jasper",
    "Billy",
    "Nala",
    "Ziggy",
    "Zoe",
    "Penny",
    "Milly",
    "Holly",
    "Henry",
    "Lilly",
    "Pippa",
    "Shadow",
    "Lucky",
    "Duke",
    "Jessie",
    "Cookie",
    "Bruce",
    "Jax",
    "Rex",
    "Louie",
    "Jet",
    "Banjo",
    "Beau",
    "Ella",
    "Ralph",
    "Loki",
    "Lexi",
    "Chilli",
    "Billie",
    "Louis",
    "Scout",
    "Cleo",
    "Spot",
    "Bolt",
    "Ginger",
    "Daisy",
    "Amelia",
    "Oliver",
    "Ghost",
    "Midnight",
    "Pumpkin",
    "Shadow",
    "Binx",
    "Riley",
    "Lenny",
    "Mango",
    "Boo",
    "Botas",
    "Romeo",
    "Simon",
    "Mimmo",
    "Carlotta",
    "Felix",
    "Duchess",
    "Walter",
    "Jesse",
    "Hank",
    "Gus",
    "Mike",
    "Saul",
    "Hector",
    "Tuco",
    "Jupiter",
    "Venus",
    "Apollo",
    "Alexandrite",
    "Amazonite",
    "Flint",
    "Jett",
    "Kyanite",
    "Mica",
    "Micah",
    "Splinter",
    "Remy"
  ];

  // ../third_party/vscode-pets/src/panel/pets/turtle.ts
  var Turtle = class extends BasePetType {
    label = "turtle";
    static possibleColors = ["green" /* green */, "orange" /* orange */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "run-right" /* runRight */,
            "lie" /* lie */
          ]
        },
        {
          state: "lie" /* lie */,
          possibleNextStates: ["walk-right" /* walkRight */, "run-right" /* runRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: ["walk-left" /* walkLeft */, "run-left" /* runLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */
          ]
        }
      ]
    };
    get emoji() {
      return "\u{1F422}";
    }
    get hello() {
      return ` Slow and steady wins the race!`;
    }
  };
  var TURTLE_NAMES = [
    "Shelldon",
    "Shelly",
    "Shelley",
    "Sheldon",
    "Tortuga",
    "Tortellini",
    "Charlie",
    "Ross",
    "Squirt",
    "Crush",
    "Squirtle",
    "Koopa",
    "Bowser",
    "Bowsette",
    "Franklin",
    "Koopa Troopa",
    "Blastoise",
    "Cecil",
    "Wartortle",
    "Donatello",
    "Michaelangelo",
    "Leonardo",
    "Leo",
    "Donny",
    "Mikey",
    "Raphael",
    "Chelone",
    "Emily",
    "Joseph",
    "Anne",
    "Zagreus",
    "Kratos",
    "Atreus",
    "Loki",
    "Freya",
    "Brevity",
    "Arthur",
    "Doyle",
    "Sherlock",
    "Charli"
  ];

  // ../third_party/vscode-pets/src/panel/pets/horse.ts
  var getRandomElement3 = (array) => {
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
  };
  var Horse = class extends BasePetType {
    constructor(spriteElement, collisionElement, speechElement, size, left, bottom, petRoot, floor2, name, speed) {
      const petRootClean = petRoot.replace(" ", "_");
      super(
        spriteElement,
        collisionElement,
        speechElement,
        size,
        left,
        bottom,
        petRootClean,
        floor2,
        name,
        speed
      );
    }
    label = "horse";
    static possibleColors = [
      "brown" /* brown */,
      "white" /* white */,
      "black" /* black */,
      "socks beige" /* socksbeige */,
      "socks black" /* socksblack */,
      "socks brown" /* socksbrown */,
      "paint beige" /* paintbeige */,
      "paint black" /* paintblack */,
      "paint brown" /* paintbrown */,
      "magical" /* magical */,
      "warrior" /* warrior */
    ];
    sequence = {
      startingState: "stand-right" /* standRight */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          // Only on first adding the horse
          possibleNextStates: ["walk-right" /* walkRight */]
        },
        {
          state: "stand-right" /* standRight */,
          // Can start walking either direction (twice as likely to keep going right), or just keep on eating
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "stand-right" /* standRight */
          ]
        },
        {
          state: "stand-left" /* standLeft */,
          // Can start walking either direction (twice as likely to keep going left), or just keep on eating
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-left" /* walkLeft */,
            "walk-left" /* walkLeft */,
            "stand-left" /* standLeft */
          ]
        },
        {
          state: "walk-right" /* walkRight */,
          // Can switch directions, start running the same direction, or start eating (more likely)
          possibleNextStates: [
            "walk-left" /* walkLeft */,
            "run-right" /* runRight */,
            "run-left" /* runLeft */,
            "stand-right" /* standRight */,
            "stand-right" /* standRight */,
            "stand-right" /* standRight */
          ]
        },
        {
          state: "run-right" /* runRight */,
          // Can switch directions or slow down to a walk (twice as likely)
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "walk-right" /* walkRight */,
            "run-left" /* runLeft */
          ]
        },
        {
          state: "walk-left" /* walkLeft */,
          // Can switch directions, start running the same direction, or start eating (more likely)
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "run-left" /* runLeft */,
            "run-right" /* runRight */,
            "stand-left" /* standLeft */,
            "stand-left" /* standLeft */,
            "stand-left" /* standLeft */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          // Can switch directions or slow down to a walk (twice as likely)
          possibleNextStates: [
            "walk-left" /* walkLeft */,
            "walk-left" /* walkLeft */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "chase" /* chase */,
          // After the chase, the horse has the ball!
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "swipe" /* swipe */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          // Can go back to running or have a bite to eat
          possibleNextStates: [
            "run-right" /* runRight */,
            "run-left" /* runLeft */,
            "stand-right" /* standRight */,
            "stand-left" /* standLeft */
          ]
        }
      ]
    };
    get emoji() {
      if (this.petRoot.endsWith("magical")) {
        return "\u{1F984}";
      }
      if (this.name.toLowerCase() === "beau") {
        return "\u{1F921}";
      }
      if (this.petRoot.endsWith("warrior")) {
        return getRandomElement3(["\u{1F5E1}\uFE0F", "\u{1FA93}", "\u{1F52A}", "\u{1F4A3}", "\u{1F9E8}"]);
      }
      return "\u{1F434}";
    }
    get hello() {
      let response = Math.random() > 0.5 ? `Neigh!` : `Neigh?`;
      switch (this.name.toLowerCase()) {
        case "artax":
          response = "Swamps of Sadness? No thanks!";
          break;
        case "hugo":
          response = "I'm the world's laziest horse!";
          break;
        case "james baxter":
          response = "James Baxter! James... Baxter!";
          break;
        case "jimison":
          response = "Son of Jimmy!";
          break;
        case "mister ed":
        case "mr. ed":
          response = "Hello, Wilbur!";
          break;
        case "mr. horse":
          response = "No sir, I don't like it.";
          break;
        case "pony soprano":
        case "tony the pony":
          response = "Fuggedaboutit!";
          break;
        case "vigo horsenberg":
        case "tiny horse jr.":
        case "ol jethro":
          response = "To battle!";
          break;
        case "shadowfax":
          response = "I am Shadowfax, lord of all horses!";
          break;
        case "silver":
          response = "Hi ho, Silver!";
          break;
      }
      if (this.petRoot.endsWith("warrior")) {
        response = response.toUpperCase();
      }
      if (this.petRoot.endsWith("magical")) {
        return `\u{1F308} ${response} \u2728`;
      }
      if (this.name.toLowerCase() === "warner") {
        return `\u{1F49C} ${response} \u{1F9E1}`;
      }
      return response;
    }
    swipe() {
      if (this.currentStateEnum === "swipe" /* swipe */) {
        return;
      }
      this.holdState = this.currentState;
      this.holdStateEnum = this.currentStateEnum;
      this.currentStateEnum = "swipe" /* swipe */;
      this.currentState = resolveState(this.currentStateEnum, this);
      this.showSpeechBubble("Neigh!");
    }
  };
  var HORSE_NAMES = [
    "Tiny Horse jr.",
    "Mister Ed",
    "Tony the Pony",
    "Vigo Horsenberg",
    "Ol Jetrho",
    "Pony Soprano",
    "Hugo",
    "Jimison",
    "Copper",
    "Lightning",
    "Pilgrim",
    "Thunder",
    "Buddy",
    "Rusty",
    "Smokey",
    "Tennessee Stud",
    "Duke",
    "Tumbleweed",
    "Buster",
    "Scout",
    "Champ",
    "Whiskey",
    "Henry",
    "Artax",
    // Neverending Story
    "Silver",
    // Lone Ranger
    "Trigger",
    // Roy Rogers
    "Shadowfax",
    // Lord of the Rings
    "Mr Horse",
    // Ren & Stimpy
    "Beau",
    // Famous clown horse
    "Bullseye",
    // Toy Story
    "Tornado",
    // Zorro
    "Boxer",
    // Animal Farm
    "Clover",
    // Animal Farm
    "Warner",
    // Purple/Orange race horse
    "Binky",
    // Discworld
    "Porkpie",
    // Percy Jackson
    "James Baxter",
    // Adventure Time
    "Buttercup",
    // Toy Story
    "Maximus",
    // Tangled
    "Seabiscuit"
    // Famous race horse
  ];

  // ../third_party/vscode-pets/src/panel/pets/monkey.ts
  var Monkey = class extends BasePetType {
    label = "monkey";
    static possibleColors = ["gray" /* gray */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: ["walk-right" /* walkRight */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: ["sit-idle" /* sitIdle */, "walk-left" /* walkLeft */]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: ["sit-idle" /* sitIdle */, "walk-right" /* walkRight */]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: ["sit-idle" /* sitIdle */]
        }
      ]
    };
    get emoji() {
      return "\u{1F412}";
    }
    get hello() {
      return `Ooh ooh aah aah!`;
    }
  };
  var MONKEY_NAMES = ["Punch"];

  // ../third_party/vscode-pets/src/panel/pets/raccoon.ts
  var Raccoon = class extends BasePetType {
    label = "raccoon";
    static possibleColors = ["gray" /* gray */, "gray_jimothy" /* grayJimothy */];
    sequence = {
      startingState: "sit-idle" /* sitIdle */,
      sequenceStates: [
        {
          state: "sit-idle" /* sitIdle */,
          possibleNextStates: [
            "walk-right" /* walkRight */,
            "run-right" /* runRight */,
            "lie" /* lie */
          ]
        },
        {
          state: "lie" /* lie */,
          possibleNextStates: ["walk-right" /* walkRight */, "walk-left" /* walkLeft */]
        },
        {
          state: "walk-right" /* walkRight */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "lie" /* lie */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */
          ]
        },
        {
          state: "run-right" /* runRight */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "lie" /* lie */,
            "walk-left" /* walkLeft */,
            "run-left" /* runLeft */
          ]
        },
        {
          state: "walk-left" /* walkLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "run-left" /* runLeft */,
          possibleNextStates: [
            "sit-idle" /* sitIdle */,
            "lie" /* lie */,
            "walk-right" /* walkRight */,
            "run-right" /* runRight */
          ]
        },
        {
          state: "chase" /* chase */,
          possibleNextStates: ["idle-with-ball" /* idleWithBall */]
        },
        {
          state: "idle-with-ball" /* idleWithBall */,
          possibleNextStates: ["sit-idle" /* sitIdle */, "lie" /* lie */]
        }
      ]
    };
    get emoji() {
      return "\u{1F99D}";
    }
    get hello() {
      return `BANZAAAIII`;
    }
  };
  var RACCOON_NAMES = [
    "Bandit",
    "Rocket",
    "Rascal",
    "Ranger",
    "Cash",
    "Dusty",
    "Pumpkin",
    "Cinder",
    "Bandido",
    "Scout",
    "Rocky",
    "Peanut",
    "Whiskers",
    "Mochi",
    "Marbles",
    "Ziggy",
    "Trash",
    "Pretzel",
    "Copper",
    "Ringo",
    "Bindi",
    "Rummage",
    "Pilfer",
    "Nibbles",
    "Chubbs",
    "Zorro",
    "Meeko",
    "Rocket",
    "Fenwick",
    "Trixie",
    "Gizmo",
    "Buckwheat",
    "Sable",
    "Boomer",
    "Cheddar",
    "Ash",
    "Pockets",
    "Scrappy",
    "Dodger",
    "Bramble",
    "Chester",
    "Snickers",
    "Waffles",
    "Bijou",
    "Cascade",
    "Otis",
    "Puddin",
    "Rosco",
    "Sneak",
    "Tumbler",
    "Rambo",
    "Wisp",
    "Domino",
    "Pilot",
    "Bandy",
    "Charcoal",
    "Ivy",
    "Loot",
    "Mask",
    "Nugget"
  ];

  // ../third_party/vscode-pets/src/common/names.ts
  function randomName(type) {
    const collection = {
      ["bunny" /* bunny */]: BUNNY_NAMES,
      ["cat" /* cat */]: CAT_NAMES,
      ["chicken" /* chicken */]: CHICKEN_NAMES,
      ["dog" /* dog */]: DOG_NAMES,
      ["fox" /* fox */]: FOX_NAMES,
      ["frog" /* frog */]: FROG_NAMES,
      ["crab" /* crab */]: CRAB_NAMES,
      ["clippy" /* clippy */]: CLIPPY_NAMES,
      ["deno" /* deno */]: DENO_NAMES,
      ["mod" /* mod */]: MOD_NAMES,
      ["totoro" /* totoro */]: TOTORO_NAMES,
      ["snail" /* snail */]: SNAIL_NAMES,
      ["snake" /* snake */]: SNAKE_NAMES,
      ["squirrel" /* squirrel */]: SQUIRREL_NAMES,
      ["rubber-duck" /* rubberduck */]: DUCK_NAMES,
      ["zappy" /* zappy */]: ZAPPY_NAMES,
      ["rocky" /* rocky */]: ROCKY_NAMES,
      ["cockatiel" /* cockatiel */]: COCKATIEL_NAMES,
      ["raccoon" /* raccoon */]: RACCOON_NAMES,
      ["rat" /* rat */]: RAT_NAMES,
      ["turtle" /* turtle */]: TURTLE_NAMES,
      ["horse" /* horse */]: HORSE_NAMES,
      ["panda" /* panda */]: PANDA_NAMES,
      ["morph" /* morph */]: MORPH_NAMES,
      ["skeleton" /* skeleton */]: SKELETON_NAMES,
      ["monkey" /* monkey */]: MONKEY_NAMES
    }[type] ?? CAT_NAMES;
    return collection[Math.floor(Math.random() * collection.length)] ?? "Unknown";
  }

  // ../third_party/vscode-pets/src/panel/pets.ts
  var PetElement = class {
    el;
    collision;
    speech;
    pet;
    color;
    type;
    remove() {
      this.el.remove();
      this.collision.remove();
      this.speech.remove();
      this.color = "null" /* null */;
      this.type = "null" /* null */;
      this.pet.remove();
    }
    constructor(el, collision, speech, pet, color, type) {
      this.el = el;
      this.collision = collision;
      this.speech = speech;
      this.pet = pet;
      this.color = color;
      this.type = type;
    }
  };
  var PetCollection = class {
    _pets;
    constructor() {
      this._pets = new Array(0);
    }
    get pets() {
      return this._pets;
    }
    push(pet) {
      this._pets.push(pet);
    }
    reset() {
      this._pets.forEach((pet) => {
        pet.remove();
      });
      this._pets = [];
    }
    locate(name) {
      return this._pets.find((collection) => {
        return collection.pet.name === name;
      });
    }
    locatePet(name, type, color) {
      return this._pets.find((collection) => {
        return collection.pet.name === name && collection.type === type && collection.color === color;
      });
    }
    remove(targetPet) {
      this._pets.forEach((pet) => {
        if (pet === targetPet) {
          pet.remove();
        }
      });
      this._pets = this._pets.filter((pet) => {
        return pet !== targetPet;
      });
    }
    seekNewFriends() {
      if (this._pets.length <= 1) {
        return;
      }
      const theFriendless = this._pets.filter((pet) => !pet.pet.hasFriend);
      if (theFriendless.length <= 1) {
        return;
      }
      theFriendless.forEach((lonelyPet) => {
        const potentialFriends = theFriendless.filter(
          (pet) => pet !== lonelyPet
        );
        potentialFriends.forEach((potentialFriend) => {
          if (!potentialFriend.pet.canChase) {
            return;
          }
          if (potentialFriend.pet.left > lonelyPet.pet.left && potentialFriend.pet.left < lonelyPet.pet.left + lonelyPet.pet.width) {
            console.log(
              lonelyPet.pet.name,
              " wants to be friends with ",
              potentialFriend.pet.name,
              "."
            );
            if (lonelyPet.pet.makeFriendsWith(potentialFriend.pet)) {
              potentialFriend.pet.showSpeechBubble("\u2764\uFE0F", 2e3);
              lonelyPet.pet.showSpeechBubble("\u2764\uFE0F", 2e3);
            }
          }
        });
      });
    }
  };
  var InvalidPetException = class {
    message;
    constructor(message) {
      this.message = message;
    }
  };
  function createPet(petType, el, collision, speech, size, left, bottom, petRoot, floor2, name) {
    if (name === void 0 || name === null || name === "") {
      throw new InvalidPetException("name is undefined");
    }
    const standardPetArguments = [el, collision, speech, size, left, bottom, petRoot, floor2, name];
    switch (petType) {
      case "bunny" /* bunny */:
        return new Bunny(...standardPetArguments, 5 /* veryFast */);
      case "cat" /* cat */:
        return new Cat(...standardPetArguments, 3 /* normal */);
      case "chicken" /* chicken */:
        return new Chicken(...standardPetArguments, 3 /* normal */);
      case "deno" /* deno */:
        return new Deno(...standardPetArguments, 2 /* slow */);
      case "dog" /* dog */:
        return new Dog(...standardPetArguments, 3 /* normal */);
      case "fox" /* fox */:
        return new Fox(...standardPetArguments, 4 /* fast */);
      case "frog" /* frog */:
        return new Frog(...standardPetArguments, 3 /* normal */);
      case "crab" /* crab */:
        return new Crab(...standardPetArguments, 2 /* slow */);
      case "clippy" /* clippy */:
        return new Clippy(...standardPetArguments, 2 /* slow */);
      case "mod" /* mod */:
        return new Mod(...standardPetArguments, 3 /* normal */);
      case "totoro" /* totoro */:
        return new Totoro(...standardPetArguments, 3 /* normal */);
      case "snail" /* snail */:
        return new Snail(...standardPetArguments, 1 /* verySlow */);
      case "snake" /* snake */:
        return new Snake(...standardPetArguments, 1 /* verySlow */);
      case "squirrel" /* squirrel */:
        return new Squirrel(...standardPetArguments, 5 /* veryFast */);
      case "rubber-duck" /* rubberduck */:
        return new RubberDuck(...standardPetArguments, 4 /* fast */);
      case "zappy" /* zappy */:
        return new Zappy(...standardPetArguments, 5 /* veryFast */);
      case "rocky" /* rocky */:
        return new Rocky(...standardPetArguments, 0 /* still */);
      case "cockatiel" /* cockatiel */:
        return new Cockatiel(...standardPetArguments, 3 /* normal */);
      case "monkey" /* monkey */:
        return new Monkey(...standardPetArguments, 3 /* normal */);
      case "rat" /* rat */:
        return new Rat(...standardPetArguments, 3 /* normal */);
      case "turtle" /* turtle */:
        return new Turtle(...standardPetArguments, 1 /* verySlow */);
      case "horse" /* horse */:
        return new Horse(...standardPetArguments, 3 /* normal */);
      case "panda" /* panda */:
        return new Panda(...standardPetArguments, 2 /* slow */);
      case "morph" /* morph */:
        return new Morph(...standardPetArguments, 3 /* normal */);
      case "skeleton" /* skeleton */:
        return new Skeleton(...standardPetArguments, 3 /* normal */);
      case "raccoon" /* raccoon */:
        return new Raccoon(...standardPetArguments, 3 /* normal */);
      default:
        throw new InvalidPetException("Pet type doesn't exist");
    }
  }
  function availableColors(petType) {
    switch (petType) {
      case "bunny" /* bunny */:
        return Bunny.possibleColors;
      case "cat" /* cat */:
        return Cat.possibleColors;
      case "chicken" /* chicken */:
        return Chicken.possibleColors;
      case "morph" /* morph */:
        return Morph.possibleColors;
      case "dog" /* dog */:
        return Dog.possibleColors;
      case "deno" /* deno */:
        return Deno.possibleColors;
      case "fox" /* fox */:
        return Fox.possibleColors;
      case "frog" /* frog */:
        return Frog.possibleColors;
      case "crab" /* crab */:
        return Crab.possibleColors;
      case "clippy" /* clippy */:
        return Clippy.possibleColors;
      case "mod" /* mod */:
        return Mod.possibleColors;
      case "monkey" /* monkey */:
        return Monkey.possibleColors;
      case "totoro" /* totoro */:
        return Totoro.possibleColors;
      case "snail" /* snail */:
        return Snail.possibleColors;
      case "snake" /* snake */:
        return Snake.possibleColors;
      case "squirrel" /* squirrel */:
        return Squirrel.possibleColors;
      case "rubber-duck" /* rubberduck */:
        return RubberDuck.possibleColors;
      case "zappy" /* zappy */:
        return Zappy.possibleColors;
      case "rocky" /* rocky */:
        return Rocky.possibleColors;
      case "cockatiel" /* cockatiel */:
        return Cockatiel.possibleColors;
      case "rat" /* rat */:
        return Rat.possibleColors;
      case "turtle" /* turtle */:
        return Turtle.possibleColors;
      case "horse" /* horse */:
        return Horse.possibleColors;
      case "panda" /* panda */:
        return Panda.possibleColors;
      case "skeleton" /* skeleton */:
        return Skeleton.possibleColors;
      case "raccoon" /* raccoon */:
        return Raccoon.possibleColors;
      default:
        throw new InvalidPetException("Pet type doesn't exist");
    }
  }

  // ../third_party/vscode-pets/src/panel/effects/snow.ts
  var Vector2 = class {
    x;
    y;
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  };
  function floorRandom(min, max) {
    return (min || 0) + Math.random() * ((max || 1) - (min || 0));
  }
  function microtime() {
    return (/* @__PURE__ */ new Date()).getTime() * 1e-3;
  }
  var Particle = class {
    origin;
    position;
    velocity;
    size;
    amplitude;
    dx;
    constructor(origin, velocity, size, amplitude) {
      this.origin = origin;
      this.position = new Vector2(origin.x, origin.y);
      this.velocity = velocity || new Vector2(0, 0);
      this.size = size;
      this.amplitude = amplitude;
      this.dx = Math.random() * 100;
    }
    update(timeDelta) {
      this.position.y += this.velocity.y * timeDelta;
      this.dx += this.velocity.x * timeDelta;
      this.position.x = this.origin.x + this.amplitude * Math.sin(this.dx);
    }
  };
  var SnowEffect = class {
    name = "Snow";
    description = "Falling snow effect";
    canvas;
    ctx;
    particles = [];
    running = false;
    startTime = 0;
    frameTime = 0;
    maxTimeDelta = 0.1;
    pAmount = 2500;
    // Snowiness
    pSize = [0.5, 1.5];
    // min and max size
    pSwing = [0.1, 1];
    // min and max oscillation speed for x movement
    pSpeed = [10, 50];
    // min and max y speed
    pAmplitude = [5, 20];
    // min and max distance for x movement
    floor = 0;
    enable() {
      this.running = true;
      this.startTime = this.frameTime = microtime();
      this.loop();
    }
    disable() {
      this.running = false;
    }
    init(foregroundCanvas, backgroundCanvas, scale, floor2, themeKind) {
      this.canvas = foregroundCanvas;
      this.ctx = this.canvas.getContext("2d");
      this.floor = floor2;
      switch (scale) {
        case "nano" /* nano */:
          this.pSize = [0.1, 0.5];
          this.pAmount = 5e3;
          break;
        case "small" /* small */:
          this.pSize = [0.5, 1.5];
          this.pAmount = 2500;
          break;
        case "medium" /* medium */:
          this.pSize = [1, 2];
          this.pAmount = 1e3;
          break;
        case "large" /* large */:
          this.pSize = [1.5, 3];
          this.pAmount = 500;
          break;
      }
      this.initParticles();
    }
    loop() {
      if (this.running) {
        this.clear();
        this.update();
        this.draw();
        this.queue();
      } else {
        console.log("Snow effect stopped");
      }
    }
    initParticles() {
      if (!this.canvas) {
        console.log("Canvas not initialized");
        return;
      }
      this.particles.length = 0;
      for (var i = 0; i < this.pAmount; i++) {
        var origin = new Vector2(
          floorRandom(0, this.canvas.width),
          floorRandom(-this.canvas.height, 0)
        );
        var velocity = new Vector2(
          floorRandom(this.pSwing[0], this.pSwing[1]),
          floorRandom(this.pSpeed[0], this.pSpeed[1])
        );
        var size = floorRandom(this.pSize[0], this.pSize[1]);
        var amplitude = floorRandom(this.pAmplitude[0], this.pAmplitude[1]);
        this.particles.push(
          new Particle(origin, velocity, size, amplitude)
        );
      }
    }
    update() {
      if (!this.canvas) {
        console.log("Canvas not initialized");
        return;
      }
      var timeNow = microtime();
      var timeDelta = Math.min(timeNow - this.frameTime, this.maxTimeDelta);
      for (var i = 0; i < this.particles.length; i++) {
        var particle = this.particles[i];
        particle.update(timeDelta);
        if (particle.position.y - particle.size > this.canvas.height - this.floor) {
          particle.position.y = -particle.size;
          particle.position.x = particle.origin.x = Math.random() * this.canvas.width;
          particle.dx = Math.random() * 100;
        }
      }
      this.frameTime = timeNow;
    }
    draw() {
      if (!this.ctx) {
        console.log("Canvas context not initialized");
        return;
      }
      this.ctx.fillStyle = "rgb(255,255,255)";
      for (var i = 0; i < this.particles.length; i++) {
        var particle = this.particles[i];
        this.ctx.fillRect(
          particle.position.x,
          particle.position.y,
          particle.size,
          particle.size
        );
      }
    }
    clear() {
      if (!this.ctx || !this.canvas) {
        console.log("Canvas or context not initialized");
        return;
      }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    queue() {
      window.requestAnimationFrame(() => this.loop());
    }
    handleResize() {
      return;
    }
  };

  // ../third_party/vscode-pets/src/panel/effects/stars.ts
  var Star = class {
    x;
    y;
    size;
    brightness;
    twinkleDirection;
    sizeMin;
    sizeMax;
    constructor(x, y, size, sizeMin, sizeMax) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.brightness = Math.random();
      this.twinkleDirection = 1;
      this.sizeMin = sizeMin;
      this.sizeMax = sizeMax;
    }
    twinkle() {
      this.size += 0.1 * this.twinkleDirection;
      this.brightness += 0.1 * this.twinkleDirection;
      if (this.brightness > 1) {
        this.brightness = 1;
      }
      if (this.brightness < 0) {
        this.brightness = 0;
      }
      if (this.size > this.sizeMax || this.size < this.sizeMin) {
        this.twinkleDirection *= -1;
      }
    }
  };
  var StarEffect = class {
    name = "Stars";
    description = "Twinkling stars effect";
    enabled = false;
    canvas;
    scale;
    stars = [];
    ctx;
    pSize = [0, 0];
    pDensity = 0;
    themeKind = 2 /* dark */;
    init(foregroundCanvas, backgroundCanvas, scale, floor2, themeKind) {
      this.themeKind = themeKind;
      this.canvas = backgroundCanvas;
      this.ctx = this.canvas.getContext("2d");
      this.scale = scale;
      switch (this.scale) {
        case "nano" /* nano */:
          this.pSize = [0.5, 1.5];
          this.pDensity = 100;
          break;
        case "small" /* small */:
          this.pSize = [0.5, 1.5];
          this.pDensity = 75;
          break;
        case "medium" /* medium */:
          this.pSize = [1, 2];
          this.pDensity = 50;
          break;
        case "large" /* large */:
          this.pSize = [1.5, 3];
          this.pDensity = 35;
          break;
      }
      this.pDensity = Math.floor(
        this.pDensity * this.canvas.width * this.canvas.height / 1e5
      );
      for (let i = 0; i < this.pDensity; i++) {
        const x = Math.random() * this.canvas.width;
        const y = Math.random() * this.canvas.height;
        const size = Math.random() * (this.pSize[1] - this.pSize[0]) + this.pSize[0];
        this.stars.push(new Star(x, y, size, this.pSize[0], this.pSize[1]));
      }
      console.log("Stars initialized \u{1F31F}");
    }
    handleResize() {
      if (this.canvas && this.ctx && this.scale) {
        this.stars = [];
        this.init(this.canvas, this.canvas, this.scale, 0, this.themeKind);
      }
    }
    enable() {
      if (this.themeKind === 1 /* light */ || this.themeKind === 4 /* highContrastLight */) {
        this.enabled = false;
        return;
      }
      if (this.ctx === null || !this.canvas) {
        console.log("Canvas context not initialized");
        return;
      }
      this.enabled = true;
      this.loop();
      console.log("Stars enabled");
    }
    draw() {
      this.stars.forEach((star) => {
        if (!this.ctx) {
          return;
        }
        star.twinkle();
        this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
        this.ctx.fillRect(star.x, star.y, star.size, star.size);
      });
    }
    disable() {
      if (!this.ctx || !this.canvas) {
        console.log("Canvas context not initialized");
        return;
      }
      this.enabled = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      console.log("Stars disabled");
    }
    loop() {
      if (this.enabled) {
        this.clear();
        this.draw();
        this.queue();
      } else {
        console.log("Stars effect stopped");
      }
    }
    clear() {
      if (!this.ctx || !this.canvas) {
        console.log("Canvas or context not initialized");
        return;
      }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    queue() {
      setTimeout(() => {
        window.requestAnimationFrame(() => this.loop());
      }, 1e3);
    }
  };

  // ../third_party/vscode-pets/src/panel/effects/leaves.ts
  var colors = ["#D7A50F", "#704910", "#A22D16", "#BB8144"];
  var Vector22 = class {
    x;
    y;
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  };
  function floorRandom2(min, max) {
    return (min || 0) + Math.random() * ((max || 1) - (min || 0));
  }
  function microtime2() {
    return (/* @__PURE__ */ new Date()).getTime() * 1e-3;
  }
  var Leaf = class {
    origin;
    position;
    velocity;
    amplitude;
    dx;
    color;
    rotation;
    rotationSpeed;
    settled;
    settleTime;
    settleDuration;
    constructor(origin, velocity, amplitude, rotationSpeed) {
      this.origin = origin;
      this.position = new Vector22(origin.x, origin.y);
      this.velocity = velocity || new Vector22(0, 0);
      this.amplitude = amplitude;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.rotationSpeed = rotationSpeed;
      this.dx = Math.random() * 100;
      this.rotation = Math.random() * Math.PI * 2;
      this.settled = false;
      this.settleTime = 0;
      this.settleDuration = floorRandom2(4, 7);
    }
    update(timeDelta) {
      if (this.settled) {
        return;
      }
      this.position.y += this.velocity.y * timeDelta;
      this.dx += this.velocity.x * timeDelta;
      this.position.x = this.origin.x + this.amplitude * Math.sin(this.dx);
      this.rotation += this.rotationSpeed * timeDelta;
    }
  };
  var LeafEffect = class {
    name = "Leaves";
    description = "Falling leaves effect";
    canvas;
    ctx;
    particles = [];
    running = false;
    startTime = 0;
    frameTime = 0;
    maxTimeDelta = 0.1;
    treeLine = 600;
    // y position of the tree line. Exactly half the height of the graphic
    scale = 1;
    // scale of the leaf graphic. Adjusted for pet size
    pAmount = 25;
    // Leafiness
    pSwing = [0.1, 1];
    // min and max oscillation speed for x movement
    pSpeed = [10, 50];
    // min and max y speed
    pAmplitude = [5, 100];
    // min and max distance for x movement
    pRotationSpeed = [0.5, 3];
    // min and max rotation speed for flutter effect
    floor = 0;
    enable() {
      this.running = true;
      this.startTime = this.frameTime = microtime2();
      this.loop();
    }
    disable() {
      this.running = false;
    }
    init(foregroundCanvas, backgroundCanvas, scale, floor2, themeKind) {
      this.canvas = foregroundCanvas;
      this.ctx = this.canvas.getContext("2d");
      this.floor = floor2;
      switch (scale) {
        case "nano" /* nano */:
          this.pAmount = 100;
          this.treeLine = 187 / 2;
          this.scale = 1 / 20;
          this.pSpeed = [2, 10];
          break;
        case "small" /* small */:
          this.pAmount = 50;
          this.treeLine = 250 / 2;
          this.scale = 1 / 15;
          this.pSpeed = [5, 20];
          break;
        case "medium" /* medium */:
          this.pAmount = 20;
          this.treeLine = 375 / 2;
          this.scale = 1 / 10;
          this.pSpeed = [10, 30];
          break;
        case "large" /* large */:
          this.pAmount = 15;
          this.treeLine = 500 / 2;
          this.scale = 1 / 10;
          this.pSpeed = [20, 50];
          break;
      }
      this.initParticles();
    }
    loop() {
      if (this.running) {
        this.clear();
        this.update();
        this.draw();
        this.queue();
      } else {
        console.log("Leaf effect stopped");
      }
    }
    initParticles() {
      if (!this.canvas) {
        console.log("Canvas not initialized");
        return;
      }
      this.particles.length = 0;
      for (var i = 0; i < this.pAmount; i++) {
        var origin = new Vector22(
          floorRandom2(0, this.canvas.width),
          floorRandom2(
            this.canvas.height - this.treeLine,
            this.canvas.height - this.floor
          )
        );
        var velocity = new Vector22(
          floorRandom2(this.pSwing[0], this.pSwing[1]),
          floorRandom2(this.pSpeed[0], this.pSpeed[1])
        );
        var amplitude = floorRandom2(this.pAmplitude[0], this.pAmplitude[1]);
        var rotationSpeed = floorRandom2(
          this.pRotationSpeed[0],
          this.pRotationSpeed[1]
        );
        this.particles.push(
          new Leaf(origin, velocity, amplitude, rotationSpeed)
        );
      }
    }
    update() {
      if (!this.canvas) {
        console.log("Canvas not initialized");
        return;
      }
      var timeNow = microtime2();
      var timeDelta = Math.min(timeNow - this.frameTime, this.maxTimeDelta);
      for (var i = 0; i < this.particles.length; i++) {
        var particle = this.particles[i];
        particle.update(timeDelta);
        var leafCenterY = particle.position.y + 119.5 * this.scale;
        if (leafCenterY >= this.canvas.height - this.floor) {
          if (!particle.settled) {
            particle.settled = true;
            particle.settleTime = timeNow;
            particle.position.y = this.canvas.height - this.floor - 119.5 * this.scale;
          } else {
            if (timeNow - particle.settleTime >= particle.settleDuration) {
              particle.position.y = particle.origin.y = this.canvas.height - this.treeLine;
              particle.position.x = particle.origin.x = Math.random() * this.canvas.width;
              particle.dx = Math.random() * 100;
              particle.rotation = Math.random() * Math.PI * 2;
              particle.settled = false;
              particle.settleDuration = floorRandom2(2, 5);
            }
          }
        }
      }
      this.frameTime = timeNow;
    }
    draw() {
      if (!this.ctx) {
        console.log("Canvas context not initialized");
        return;
      }
      for (var i = 0; i < this.particles.length; i++) {
        var particle = this.particles[i];
        var x = particle.position.x;
        var y = particle.position.y;
        this.ctx.save();
        var centerX = x + 100 * this.scale / 2;
        var centerY = y + (85 * this.scale + 169 * this.scale) / 2;
        this.ctx.translate(centerX, centerY);
        this.ctx.rotate(particle.rotation);
        this.ctx.translate(-centerX, -centerY);
        this.ctx.fillStyle = particle.color;
        this.ctx.beginPath();
        this.ctx.moveTo(100 * this.scale + x, 85 * this.scale + y);
        this.ctx.lineTo(0 + x, 107 * this.scale + y);
        this.ctx.lineTo(73 * this.scale + x, 112 * this.scale + y);
        this.ctx.lineTo(32 * this.scale + x, 138 * this.scale + y);
        this.ctx.lineTo(92 * this.scale + x, 123 * this.scale + y);
        this.ctx.lineTo(100 * this.scale + x, 169 * this.scale + y);
        this.ctx.lineTo(123 * this.scale + x, 123 * this.scale + y);
        this.ctx.lineTo(168 * this.scale + x, 133 * this.scale + y);
        this.ctx.lineTo(133 * this.scale + x, 112 * this.scale + y);
        this.ctx.lineTo(184 * this.scale + x, 110 * this.scale + y);
        this.ctx.lineTo(100 * this.scale + x, 85 * this.scale + y);
        this.ctx.lineTo(100 * this.scale + x, 70 * this.scale + y);
        this.ctx.fill();
        this.ctx.restore();
      }
    }
    clear() {
      if (!this.ctx || !this.canvas) {
        console.log("Canvas or context not initialized");
        return;
      }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    queue() {
      window.requestAnimationFrame(() => this.loop());
    }
    handleResize() {
      return;
    }
  };

  // ../third_party/vscode-pets/src/panel/themes.ts
  function normalizeColorThemeKind(kind) {
    switch (kind) {
      case 1 /* light */:
        return "light";
      case 2 /* dark */:
        return "dark";
      case 3 /* highContrast */:
        return "dark";
      case 4 /* highContrastLight */:
        return "light";
      default:
        return "light";
    }
  }
  var ThemeInfo = class {
    name = "";
    description = "";
    effect = void 0;
    // eslint-disable-next-line no-unused-vars
    floor(size) {
      return 0;
    }
    backgroundImageUrl(basePetUri, themeKind, petSize) {
      var _themeKind = normalizeColorThemeKind(themeKind);
      return `url('${basePetUri}/backgrounds/${this.name}/background-${_themeKind}-${petSize}.png')`;
    }
    foregroundImageUrl(basePetUri, themeKind, petSize) {
      var _themeKind = normalizeColorThemeKind(themeKind);
      return `url('${basePetUri}/backgrounds/${this.name}/foreground-${_themeKind}-${petSize}.png')`;
    }
  };
  var ForestThemeInfo = class extends ThemeInfo {
    name = "forest";
    description = "A forest theme";
    effect = new StarEffect();
    floor(size) {
      switch (size) {
        case "small" /* small */:
          return 30;
        case "medium" /* medium */:
          return 40;
        case "large" /* large */:
          return 65;
        case "nano" /* nano */:
        default:
          return 23;
      }
    }
  };
  var CastleThemeInfo = class extends ThemeInfo {
    name = "castle";
    description = "A castle theme";
    floor(size) {
      switch (size) {
        case "small" /* small */:
          return 60;
        case "medium" /* medium */:
          return 80;
        case "large" /* large */:
          return 120;
        case "nano" /* nano */:
        default:
          return 45;
      }
    }
  };
  var BeachThemeInfo = class extends ThemeInfo {
    name = "beach";
    description = "A beach theme";
    effect = new StarEffect();
    floor(size) {
      switch (size) {
        case "small" /* small */:
          return 60;
        case "medium" /* medium */:
          return 80;
        case "large" /* large */:
          return 120;
        case "nano" /* nano */:
        default:
          return 45;
      }
    }
  };
  var WinterThemeInfo = class extends ThemeInfo {
    name = "winter";
    description = "A winter theme";
    effect = new SnowEffect();
    floor(size) {
      switch (size) {
        case "small" /* small */:
          return 20;
        case "medium" /* medium */:
          return 30;
        case "large" /* large */:
          return 45;
        case "nano" /* nano */:
        default:
          return 18;
      }
    }
  };
  var AutumnThemeInfo = class extends ThemeInfo {
    name = "autumn";
    description = "An autumn theme";
    effect = new LeafEffect();
    floor(size) {
      switch (size) {
        case "small" /* small */:
          return 9;
        case "medium" /* medium */:
          return 15;
        case "large" /* large */:
          return 20;
        case "nano" /* nano */:
        default:
          return 7;
      }
    }
  };
  var THEMES = {
    none: {
      name: "none",
      description: "No theme",
      /* eslint-disable no-unused-vars */
      floor: (size) => 0,
      backgroundImageUrl: (basePetUri, themeKind, petSize) => "",
      foregroundImageUrl: (basePetUri, themeKind, petSize) => ""
      /* eslint-enable no-unused-vars */
    },
    forest: new ForestThemeInfo(),
    castle: new CastleThemeInfo(),
    beach: new BeachThemeInfo(),
    winter: new WinterThemeInfo(),
    autumn: new AutumnThemeInfo()
  };

  // ../third_party/vscode-pets/src/panel/ball.ts
  var gravity = 0.6;
  var damping = 0.9;
  var traction = 0.8;
  var interval = 1e3 / 24;
  var then = 0;
  var ballState;
  var canvas;
  var ballRadius;
  var floor;
  function calculateBallRadius(size) {
    if (size === "nano" /* nano */) {
      return 2;
    } else if (size === "small" /* small */) {
      return 3;
    } else if (size === "medium" /* medium */) {
      return 4;
    } else if (size === "large" /* large */) {
      return 8;
    } else {
      return 1;
    }
  }
  function setupBallThrowing(canvasName, petSize, floor_) {
    canvas = document.getElementById(canvasName);
    ballRadius = calculateBallRadius(petSize);
    floor = floor_;
  }
  function resetBall() {
    if (ballState) {
      ballState.paused = true;
    }
    if (canvas) {
      canvas.style.display = "block";
    }
    ballState = new BallState(100, 100, 4, 5);
  }
  function dynamicThrowOn(pets) {
    let startMouseX;
    let startMouseY;
    let endMouseX;
    let endMouseY;
    console.log("Enabling dynamic throw");
    window.onmousedown = (e) => {
      if (ballState) {
        ballState.paused = true;
      }
      if (canvas) {
        canvas.style.display = "block";
      }
      endMouseX = e.clientX;
      endMouseY = e.clientY;
      startMouseX = e.clientX;
      startMouseY = e.clientY;
      ballState = new BallState(e.clientX, e.clientY, 0, 0);
      pets.forEach((petEl) => {
        if (petEl.pet.canChase && canvas) {
          petEl.pet.chase(ballState, canvas);
        }
      });
      ballState.paused = true;
      drawBall();
      window.onmousemove = (ev) => {
        ev.preventDefault();
        if (ballState) {
          ballState.paused = true;
        }
        startMouseX = endMouseX;
        startMouseY = endMouseY;
        endMouseX = ev.clientX;
        endMouseY = ev.clientY;
        ballState = new BallState(ev.clientX, ev.clientY, 0, 0);
        drawBall();
      };
      window.onmouseup = (ev) => {
        ev.preventDefault();
        window.onmouseup = null;
        window.onmousemove = null;
        ballState = new BallState(
          endMouseX,
          endMouseY,
          endMouseX - startMouseX,
          endMouseY - startMouseY
        );
        pets.forEach((petEl) => {
          if (petEl.pet.canChase && canvas) {
            petEl.pet.chase(ballState, canvas);
          }
        });
        throwBall();
      };
    };
  }
  function dynamicThrowOff() {
    console.log("Disabling dynamic throw");
    window.onmousedown = null;
    if (ballState) {
      ballState.paused = true;
    }
    if (canvas) {
      canvas.style.display = "none";
    }
  }
  function throwBall() {
    if (!canvas) {
      return;
    }
    if (!ballState.paused) {
      requestAnimationFrame(throwBall);
    }
    const now = Date.now();
    const elapsed = now - then;
    if (elapsed <= interval) {
      return;
    }
    then = now - elapsed % interval;
    if (ballState.cx + ballRadius >= canvas.width) {
      ballState.vx = -ballState.vx * damping;
      ballState.cx = canvas.width - ballRadius;
    } else if (ballState.cx - ballRadius <= 0) {
      ballState.vx = -ballState.vx * damping;
      ballState.cx = ballRadius;
    }
    if (ballState.cy + ballRadius + floor >= canvas.height) {
      ballState.vy = -ballState.vy * damping;
      ballState.cy = canvas.height - ballRadius - floor;
      ballState.vx *= traction;
    } else if (ballState.cy - ballRadius <= 0) {
      ballState.vy = -ballState.vy * damping;
      ballState.cy = ballRadius;
    }
    ballState.vy += gravity;
    ballState.cx += ballState.vx;
    ballState.cy += ballState.vy;
    drawBall();
  }
  function drawBall() {
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(ballState.cx, ballState.cy, ballRadius, 0, 2 * Math.PI, false);
    ctx.fillStyle = "#2ed851";
    ctx.fill();
  }
  function throwAndChase(pets) {
    resetBall();
    throwBall();
    pets.forEach((petEl) => {
      if (petEl.pet.canChase && canvas) {
        petEl.pet.chase(ballState, canvas);
      }
    });
  }

  // ../third_party/vscode-pets/src/panel/main.ts
  var FOREGROUND_EFFECT_CANVAS_ID = "foregroundEffectCanvas";
  var BACKGROUND_EFFECT_CANVAS_ID = "backgroundEffectCanvas";
  var PET_CANVAS_ID = "ballCanvas";
  var allPets = new PetCollection();
  var petCounter;
  function handleMouseOver(e) {
    var el = e.currentTarget;
    allPets.pets.forEach((element) => {
      if (element.collision === el && element.pet.canSwipe) {
        element.pet.swipe();
      }
    });
  }
  function startAnimations(collision, pet, stateApi) {
    if (!stateApi) {
      stateApi = acquireVsCodeApi();
    }
    collision.addEventListener("mouseover", handleMouseOver);
  }
  function addPetToPanel(petType, basePetUri, petColor, petSize, left, bottom, floor2, name, stateApi) {
    var petSpriteElement = document.createElement("img");
    petSpriteElement.className = "pet";
    document.getElementById("petsContainer").appendChild(
      petSpriteElement
    );
    var collisionElement = document.createElement("div");
    collisionElement.className = "collision";
    document.getElementById("petsContainer").appendChild(
      collisionElement
    );
    var speechBubbleElement = document.createElement("div");
    speechBubbleElement.className = `bubble bubble-${petSize}`;
    speechBubbleElement.innerText = "Hello!";
    document.getElementById("petsContainer").appendChild(
      speechBubbleElement
    );
    const root = basePetUri + "/" + petType + "/" + petColor;
    console.log("Creating new pet : ", petType, root, petColor, petSize, name);
    try {
      if (!availableColors(petType).includes(petColor)) {
        throw new InvalidPetException("Invalid color for pet type");
      }
      var newPet = createPet(
        petType,
        petSpriteElement,
        collisionElement,
        speechBubbleElement,
        petSize,
        left,
        bottom,
        root,
        floor2,
        name
      );
      petCounter++;
      startAnimations(collisionElement, newPet, stateApi);
    } catch (e) {
      petSpriteElement.remove();
      collisionElement.remove();
      speechBubbleElement.remove();
      throw e;
    }
    return new PetElement(
      petSpriteElement,
      collisionElement,
      speechBubbleElement,
      newPet,
      petColor,
      petType
    );
  }
  function saveState(stateApi) {
    if (!stateApi) {
      stateApi = acquireVsCodeApi();
    }
    var state = new PetPanelState();
    state.petStates = new Array();
    allPets.pets.forEach((petItem) => {
      state.petStates?.push({
        petName: petItem.pet.name,
        petColor: petItem.color,
        petType: petItem.type,
        petState: petItem.pet.getState(),
        petFriend: petItem.pet.friend?.name ?? void 0,
        elLeft: petItem.el.style.left,
        elBottom: petItem.el.style.bottom
      });
    });
    state.petCounter = petCounter;
    stateApi?.setState(state);
  }
  function recoverState(basePetUri, petSize, floor2, stateApi) {
    if (!stateApi) {
      stateApi = acquireVsCodeApi();
    }
    var state = stateApi?.getState();
    if (!state) {
      petCounter = 1;
    } else {
      if (state.petCounter === void 0 || isNaN(state.petCounter)) {
        petCounter = 1;
      } else {
        petCounter = state.petCounter ?? 1;
      }
    }
    var recoveryMap = /* @__PURE__ */ new Map();
    state?.petStates?.forEach((p) => {
      if (p.petType === "rubber duck") {
        p.petType = "rubber-duck";
      }
      try {
        var newPet = addPetToPanel(
          p.petType ?? "cat" /* cat */,
          basePetUri,
          p.petColor ?? "brown" /* brown */,
          petSize,
          parseInt(p.elLeft ?? "0"),
          parseInt(p.elBottom ?? "0"),
          floor2,
          p.petName ?? randomName(p.petType ?? "cat" /* cat */),
          stateApi
        );
        allPets.push(newPet);
        recoveryMap.set(newPet.pet, p);
      } catch (InvalidPetException2) {
        console.log(
          "State had invalid pet (" + p.petType + "), discarding."
        );
      }
    });
    recoveryMap.forEach((state2, pet) => {
      if (state2.petState !== void 0) {
        pet.recoverState(state2.petState);
      }
      var friend = void 0;
      if (state2.petFriend) {
        friend = allPets.locate(state2.petFriend);
        if (friend) {
          pet.recoverFriend(friend.pet);
        }
      }
    });
  }
  function randomStartPosition() {
    return Math.floor(Math.random() * (window.innerWidth * 0.7));
  }
  function initCanvas(name) {
    const canvas2 = document.getElementById(name);
    if (!canvas2) {
      console.log("Canvas not ready");
      return null;
    }
    const ctx = canvas2.getContext("2d");
    if (!ctx) {
      console.log("Canvas context not ready");
      return null;
    }
    ctx.canvas.width = window.innerWidth;
    ctx.canvas.height = window.innerHeight;
    return canvas2;
  }
  function petPanelApp(basePetUri, theme, themeKind, petColor, petSize, petType, throwBallWithMouse, disableEffects, stateApi) {
    if (!stateApi) {
      stateApi = acquireVsCodeApi();
    }
    const themeInfo = THEMES[theme];
    const foregroundEl = document.getElementById("foreground");
    const backgroundEl = document.getElementById("background");
    backgroundEl.style.backgroundImage = themeInfo.backgroundImageUrl(
      basePetUri,
      themeKind,
      petSize
    );
    foregroundEl.style.backgroundImage = themeInfo.foregroundImageUrl(
      basePetUri,
      themeKind,
      petSize
    );
    const floor2 = themeInfo.floor(petSize);
    console.log(
      "Starting pet session",
      petColor,
      basePetUri,
      petType,
      throwBallWithMouse,
      theme
    );
    var state = stateApi?.getState();
    if (!state) {
      console.log("No state, starting a new session.");
      petCounter = 1;
      allPets.push(
        addPetToPanel(
          petType,
          basePetUri,
          petColor,
          petSize,
          randomStartPosition(),
          floor2,
          floor2,
          randomName(petType),
          stateApi
        )
      );
      saveState(stateApi);
    } else {
      console.log("Recovering state - ", state);
      recoverState(basePetUri, petSize, floor2, stateApi);
    }
    initCanvas(PET_CANVAS_ID);
    setupBallThrowing(PET_CANVAS_ID, petSize, floor2);
    if (throwBallWithMouse) {
      dynamicThrowOn(allPets.pets);
    } else {
      dynamicThrowOff();
    }
    if (themeInfo.effect) {
      const foregroundEffectCanvas = initCanvas(FOREGROUND_EFFECT_CANVAS_ID);
      const backgroundEffectCanvas = initCanvas(BACKGROUND_EFFECT_CANVAS_ID);
      if (foregroundEffectCanvas && backgroundEffectCanvas) {
        themeInfo.effect.init(
          foregroundEffectCanvas,
          backgroundEffectCanvas,
          petSize,
          floor2,
          themeKind
        );
        if (!disableEffects) {
          themeInfo.effect.enable();
        }
      }
    }
    let windowLoaded = false;
    const onTick = () => {
      if (windowLoaded) {
        allPets.seekNewFriends();
        allPets.pets.forEach((petItem) => {
          petItem.pet.nextFrame();
        });
        saveState(stateApi);
      }
    };
    window.addEventListener("load", () => {
      windowLoaded = true;
    });
    window.addEventListener("message", (event) => {
      const message = event.data;
      switch (message.command) {
        case "throw-with-mouse":
          if (message.enabled) {
            dynamicThrowOn(allPets.pets);
          } else {
            dynamicThrowOff();
          }
          break;
        case "throw-ball":
          throwAndChase(allPets.pets);
          break;
        case "spawn-pet":
          allPets.push(
            addPetToPanel(
              message.type,
              basePetUri,
              message.color,
              petSize,
              randomStartPosition(),
              floor2,
              floor2,
              message.name ?? randomName(message.type),
              stateApi
            )
          );
          saveState(stateApi);
          break;
        case "list-pets":
          var pets = allPets.pets;
          stateApi?.postMessage({
            command: "list-pets",
            text: pets.map(
              (pet2) => `${pet2.type},${pet2.pet.name},${pet2.color}`
            ).join("\n")
          });
          break;
        case "roll-call":
          var pets = allPets.pets;
          pets.forEach((pet2) => {
            stateApi?.postMessage({
              command: "info",
              text: `${pet2.pet.emoji} ${pet2.pet.name} (${pet2.color} ${pet2.type}): ${pet2.pet.hello}`
            });
          });
        case "delete-pet":
          var pet = allPets.locatePet(
            message.name,
            message.type,
            message.color
          );
          if (pet) {
            allPets.remove(pet);
            saveState(stateApi);
            stateApi?.postMessage({
              command: "info",
              text: "\u{1F44B} Removed pet " + message.name
            });
          } else {
            stateApi?.postMessage({
              command: "error",
              text: `Could not find pet ${message.name}`
            });
          }
          break;
        case "reset-pet":
          allPets.reset();
          petCounter = 0;
          saveState(stateApi);
          break;
        case "pause-pet":
          petCounter = 1;
          saveState(stateApi);
          break;
        case "disable-effects":
          if (themeInfo.effect && message.disabled) {
            themeInfo.effect.disable();
          } else if (themeInfo.effect && !message.disabled) {
            themeInfo.effect.enable();
          }
          break;
        case "tick":
          onTick();
          break;
      }
    });
    window.addEventListener("resize", function() {
      initCanvas(PET_CANVAS_ID);
      initCanvas(FOREGROUND_EFFECT_CANVAS_ID);
      initCanvas(BACKGROUND_EFFECT_CANVAS_ID);
      if (themeInfo.effect) {
        themeInfo.effect.handleResize();
      }
    });
  }
  return __toCommonJS(main_exports);
})();
