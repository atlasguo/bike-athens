/**
 * map-config.js — Single source of truth for all visual styles.
 *
 * Both map.js and storymap.js read from window.ATHENS_CONFIG.
 * To tweak any colour, width, or effect: edit here only.
 *
 * Sections
 * ────────
 *  1. PAL     — all colours as [R, G, B] arrays
 *  2. W       — line widths (inverted + conventional renderers, bike, shadows)
 *  3. FX      — bloom / blur effect strings
 *  4. LBL     — label sizes and scale thresholds
 *  5. VIEW    — map center, scale limits, background, pan boundary
 *  6. Renderers  — invertedRenderer, normalRenderer (built from 1–2 above)
 *  7. layerOpts  — GeoJSONLayer option objects for every data layer
 */

(function () {
  "use strict";

  // ════════════════════════════════════════════════════════════
  // 1. PAL — colour palette
  //    All values are [R, G, B].  Alpha is added per-symbol below.
  //    ── Road tiers follow INVERTED hierarchy logic: ──────────
  //       slower road → brighter colour + greater width
  //       faster road → darker colour  + lesser width
  // ════════════════════════════════════════════════════════════
  var PAL = {

    // Inverted road tiers (used in main map + storymap scenes 2–8)
    // Calibrated to match static reference: fast roads ≈ near-black, slow roads ≈ warm mid-gray
    roadA:      [14,  12,  10],   // Tier A  >80 km/h  motorway      — near-invisible, merges with canvas
    roadB:      [28,  26,  22],   // Tier B  60–80     trunk/primary
    roadC:      [50,  48,  44],   // Tier C  40–60     secondary
    roadD:      [76,  73,  68],   // Tier D  20–40     tertiary
    roadE:      [118, 114, 107],  // Tier E  ≤20       residential   — brightest / thickest
    roadDef:    [92,  89,  84],   // fallback for unlisted fclass values

    // Conventional road tiers (used in storymap scene 1 + swipe left side)
    normA:      [212, 200, 180],  // motorway      — warm cream, thickest
    normB:      [174, 163, 146],  // trunk/primary
    normC:      [132, 124, 112],  // secondary
    normD:      [96,  91,  82],   // tertiary
    normE:      [54,  51,  46],   // residential   — darkest / thinnest
    normDef:    [68,  64,  58],

    // Bike infrastructure — warm gold matching static reference (bike-centered)
    bikeGold:   [232, 200, 64],
    // Muted green for bike infrastructure in car-centered view
    bikeGreenPath: [95,  140, 68],
    bikeGreenLane: [76,  114, 52],

    // Polygon fills — calibrated to static image
    park:       [29,  35,  20],    // deep dark olive-green
    parkEdge:   [32,  48,  10],
    uga:        [32,  25,  20],   // very dark neutral, recedes into background
    ugaEdge:    [48,  46,  44],
    water:      [22,  35,  52],   // deep dark teal-blue

    // Boundary / exterior mask
    boundary:   [208, 192, 155],  // warm ochre-cream Athens edge
    mask:       [10,  8,   6],    // near-black outside Athens boundary

    // Repair station marker
    repairFill:    [238, 142, 48],
    repairOutline: [240, 236, 224],

    // Label text + halo
    roadLabel:  [148, 143, 136],
    parkLabel:  [118, 142, 86],
    waterLabel: [66,  118, 150],
    repairLbl:  [238, 142, 48],
    labelHalo:  [10,  8,   6],

    // Storymap highlight colour
    highlight:  [232, 200, 64],
  };

  // ════════════════════════════════════════════════════════════
  // 2. W — line widths (pixels)
  //    inv  = inverted hierarchy (main map style)
  //    norm = conventional hierarchy (storymap scene 1 / swipe)
  // ════════════════════════════════════════════════════════════
  var W = {

    inv: {
      // Tier A  >80 km/h
      Amain: 0.6,  Alink: 0.45,
      // Tier B  60–80 km/h
      Bmain: 0.9,  Blink: 0.7,
      // Tier C  40–60 km/h
      Cmain: 1.35, Clink: 0.9,  CtLink: 0.75,
      // Tier D  20–40 km/h
      Dmain: 1.15, Duncl: 0.9,
      // Tier E  ≤20 km/h
      Eres:  1.5,  Elive: 1.2,  Etrack: 0.75,
      def:   1.35
    },

    norm: {
      Amain: 4.0,  Alink: 2.4,
      Bmain: 3.2,  Blink: 1.9,
      Cmain: 2.2,  Clink: 1.4,
      Dmain: 1.6,  Dlink: 1.1,  Duncl: 1.2,
      Eres:  0.75, Elive: 0.6,  Etrack: 0.5,
      def:   0.9
    },

    // Bike paths and lanes
    pathMain:  2.8,   // Multi-use Trail / Multi-use Path
    pathOff:   2.2,   // Off-Road Facility
    pathShare: 1.4,   // Sharrows (dashed)
    pathDef:   2.5,
    lane:      2.0,

    water:     3.5,
    boundary:  2,
    boundaryHalo: 5,

    // Black halo underlays beneath fast roads (Tier A largest → Tier C smallest)
    shadowA:   10,
    shadowB:   6,
    shadowC:   3,
  };

  // ════════════════════════════════════════════════════════════
  // 3. FX — bloom / blur effect strings
  //    bloom(strength, radius, threshold)
  //    blur(radius)
  // ════════════════════════════════════════════════════════════
  var FX = {
    roadInv:   "bloom(0.18, 0.5px, 0.03)",  // slightly stronger glow — residential streets visibly warm
    bikePath:  "bloom(0.35, 0.8px, 0.05)",
    bikeLane:  "bloom(0.30, 0.7px, 0.05)",
    repair:    "bloom(0.28, 1.2px, 0.07)",
    water:     "bloom(0.20, 0.7px, 0.04)",
    hlLayer:   "bloom(1.0, 3px, 0.07)",
    shadowA:   "blur(8px)",
    shadowB:   "blur(5px)",
    shadowC:   "blur(3px)",
  };

  // ════════════════════════════════════════════════════════════
  // 4. LBL — label sizes and scale gates
  //    minScale: label appears only when view.scale < this value
  //    (lower scale number = more zoomed-in)
  // ════════════════════════════════════════════════════════════
  var LBL = {
    parkMinScale:   30000,
    repairMinScale: 25000,
    roadSize:    9,
    parkSize:    9,
    waterSize:   9,
    repairSize:  9.5,
    haloSize:    1.5,
  };

  // ════════════════════════════════════════════════════════════
  // 5. VIEW — MapView construction parameters
  // ════════════════════════════════════════════════════════════
  var VIEW = {
    center:     [-83.389, 33.952],
    scale:      72000,      // opening zoom level
    minScale:   150000,     // maximum zoom-out allowed
    maxScale:   4000,       // maximum zoom-in allowed
    background: [14, 12, 10, 1],    // canvas colour — matches static reference warm near-black
    // Hard pan boundary — Athens-Clarke County (WGS84 decimal degrees)
    panBounds: { xmin: -83.545, ymin: 33.840, xmax: -83.235, ymax: 34.055 }
  };

  // ════════════════════════════════════════════════════════════
  // 6. RENDERERS
  //    Helper: c(rgb, alpha) → [R, G, B, A]
  //    Helper: sl(rgb, a, w) → simple-line symbol object
  // ════════════════════════════════════════════════════════════
  function c(rgb, a) { return [rgb[0], rgb[1], rgb[2], a]; }
  function sl(rgb, a, w) { return { type: "simple-line", color: c(rgb, a), width: w }; }

  var invertedRenderer = {
    type: "unique-value",
    field: "fclass",
    defaultSymbol: sl(PAL.roadDef, 0.65, W.inv.def),
    uniqueValueInfos: [
      // ── Tier A: >80 km/h — thinnest, darkest ──────────────
      { value: "motorway",       symbol: sl(PAL.roadA, 1.00, W.inv.Amain) },
      { value: "motorway_link",  symbol: sl(PAL.roadA, 0.90, W.inv.Alink) },
      // ── Tier B: 60–80 km/h ────────────────────────────────
      { value: "trunk",          symbol: sl(PAL.roadB, 1.00, W.inv.Bmain) },
      { value: "trunk_link",     symbol: sl(PAL.roadB, 0.90, W.inv.Blink) },
      { value: "primary",        symbol: sl(PAL.roadB, 1.00, W.inv.Bmain) },
      { value: "primary_link",   symbol: sl(PAL.roadB, 0.90, W.inv.Blink) },
      // ── Tier C: 40–60 km/h ────────────────────────────────
      { value: "secondary",      symbol: sl(PAL.roadC, 0.95, W.inv.Cmain) },
      { value: "secondary_link", symbol: sl(PAL.roadC, 0.85, W.inv.Clink) },
      { value: "tertiary_link",  symbol: sl(PAL.roadC, 0.80, W.inv.CtLink) },
      // ── Tier D: 20–40 km/h ────────────────────────────────
      { value: "tertiary",       symbol: sl(PAL.roadD, 0.90, W.inv.Dmain) },
      { value: "unclassified",   symbol: sl(PAL.roadD, 0.80, W.inv.Duncl) },
      // ── Tier E: ≤20 km/h — thickest, brightest ───────────
      { value: "residential",    symbol: sl(PAL.roadE, 0.85, W.inv.Eres) },
      { value: "living_street",  symbol: sl(PAL.roadE, 0.75, W.inv.Elive) },
      { value: "track",          symbol: sl(PAL.roadD, 0.50, W.inv.Etrack) },
      { value: "track_grade1",   symbol: sl(PAL.roadD, 0.50, W.inv.Etrack) },
      { value: "cycleway",       symbol: sl([90,72,20], 0.28, 0.8) }
    ]
  };

  var normalRenderer = {
    type: "unique-value",
    field: "fclass",
    defaultSymbol: sl(PAL.normDef, 0.6, W.norm.def),
    uniqueValueInfos: [
      // ── Tier A: >80 km/h — thickest, brightest ───────────
      { value: "motorway",       symbol: sl(PAL.normA, 1.00, W.norm.Amain) },
      { value: "motorway_link",  symbol: sl(PAL.normA, 0.75, W.norm.Alink) },
      // ── Tier B: 60–80 km/h ────────────────────────────────
      { value: "trunk",          symbol: sl(PAL.normB, 1.00, W.norm.Bmain) },
      { value: "trunk_link",     symbol: sl(PAL.normB, 0.75, W.norm.Blink) },
      { value: "primary",        symbol: sl(PAL.normB, 1.00, W.norm.Bmain) },
      { value: "primary_link",   symbol: sl(PAL.normB, 0.75, W.norm.Blink) },
      // ── Tier C: 40–60 km/h ────────────────────────────────
      { value: "secondary",      symbol: sl(PAL.normC, 0.95, W.norm.Cmain) },
      { value: "secondary_link", symbol: sl(PAL.normC, 0.80, W.norm.Clink) },
      // ── Tier D: 20–40 km/h ────────────────────────────────
      { value: "tertiary",       symbol: sl(PAL.normD, 0.90, W.norm.Dmain) },
      { value: "tertiary_link",  symbol: sl(PAL.normD, 0.75, W.norm.Dlink) },
      { value: "unclassified",   symbol: sl(PAL.normD, 0.80, W.norm.Duncl) },
      // ── Tier E: ≤20 km/h — thinnest, darkest ────────────
      { value: "residential",    symbol: sl(PAL.normE, 0.65, W.norm.Eres) },
      { value: "living_street",  symbol: sl(PAL.normE, 0.55, W.norm.Elive) },
      { value: "track",          symbol: sl(PAL.normE, 0.38, W.norm.Etrack) }
    ]
  };

  // ════════════════════════════════════════════════════════════
  // 7. LAYER OPTIONS
  //    Objects passed directly to new GeoJSONLayer({...opts})
  // ════════════════════════════════════════════════════════════

  var roadLabelInfo = [{
    labelExpressionInfo: {
      expression: "IIf(IsEmpty($feature.name), '', $feature.name)"
    },
    labelPlacement: "above-along",
    symbol: {
      type: "text",
      color: c(PAL.roadLabel, 0.85),
      haloColor: c(PAL.labelHalo, 0.9),
      haloSize: LBL.haloSize,
      font: { family: "Arial", size: LBL.roadSize }
    }
  }];

  var layerOpts = {

    roads: {
      labelsVisible: false,
      labelingInfo: roadLabelInfo,
      effect: FX.roadInv,
      renderer: invertedRenderer,
      customParameters: { layerTag: "road" }
    },

    park: {
      popupEnabled: false,
      labelsVisible: true,
      labelingInfo: [{
        labelExpressionInfo: { expression: "$feature.Park_Name" },
        symbol: {
          type: "text",
          color: c(PAL.parkLabel, 0.9),
          haloColor: c(PAL.labelHalo, 0.9),
          haloSize: LBL.haloSize,
          font: { family: "Arial", size: LBL.parkSize, style: "italic" }
        },
        minScale: LBL.parkMinScale,
        where: "Park_Name IS NOT NULL AND Park_Name <> ''"
      }],
      customParameters: { layerTag: "park" },
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: c(PAL.park, 0.92),
          outline: { color: c(PAL.parkEdge, 0.28), width: 0.4 }
        }
      }
    },

    uga: {
      popupEnabled: false,
      customParameters: { layerTag: "uga" },
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: c(PAL.uga, 0.82),
          outline: { color: c(PAL.ugaEdge, 0.22), width: 0.4 }
        }
      }
    },

    water: {
      labelsVisible: true,
      labelingInfo: [{
        labelExpressionInfo: { expression: "$feature.name" },
        symbol: {
          type: "text",
          color: c(PAL.waterLabel, 0.90),
          haloColor: c(PAL.labelHalo, 0.9),
          haloSize: LBL.haloSize,
          font: { family: "Arial", size: LBL.waterSize, style: "italic" }
        },
        where: "name IS NOT NULL AND name <> ''"
      }],
      effect: FX.water,
      customParameters: { layerTag: "water" },
      renderer: {
        type: "simple",
        symbol: { type: "simple-line", color: c(PAL.water, 1), width: W.water }
      }
    },

    bikePath: {
      popupEnabled: false,
      customParameters: { layerTag: "bikepath" },
      effect: FX.bikePath,
      blendMode: "lighten",
      renderer: {
        type: "unique-value",
        field: "Type",
        defaultSymbol: sl(PAL.bikeGold, 1, W.pathDef),
        uniqueValueInfos: [
          { value: "Multi-use Trail",   symbol: sl(PAL.bikeGold, 1.00, W.pathMain) },
          { value: "Multi-use Path",    symbol: sl(PAL.bikeGold, 1.00, W.pathMain) },
          { value: "Off-Road Facility", symbol: sl(PAL.bikeGold, 0.95, W.pathOff) },
          { value: "Sharrows",          symbol: { type: "simple-line", color: c(PAL.bikeGold, 0.60), width: W.pathShare, style: "short-dash" } }
        ]
      }
    },

    bikeLane: {
      popupEnabled: false,
      customParameters: { layerTag: "bikelane" },
      effect: FX.bikeLane,
      blendMode: "lighten",
      renderer: {
        type: "simple",
        symbol: { type: "simple-line", color: c(PAL.bikeGold, 0.90), width: W.lane, style: "short-dot" }
      }
    },

    repair: {
      popupEnabled: false,
      customParameters: { layerTag: "repair" },
      effect: FX.repair,
      labelsVisible: true,
      labelingInfo: [{
        labelExpressionInfo: { expression: "$feature.Name" },
        symbol: {
          type: "text",
          color: c(PAL.repairLbl, 1),
          haloColor: c(PAL.labelHalo, 0.95),
          haloSize: LBL.haloSize,
          font: { family: "Arial", size: LBL.repairSize, weight: "bold" },
          yoffset: 10
        },
        minScale: LBL.repairMinScale
      }],
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-marker",
          style: "circle",
          color: c(PAL.repairFill, 1),
          size: 7,
          outline: { color: c(PAL.repairOutline, 0.85), width: 1.5 }
        }
      }
    },

    mask: {
      popupEnabled: false,
      renderer: {
        type: "simple",
        symbol: { type: "simple-fill", color: c(PAL.mask, 0.82), outline: { color: [0,0,0,0], width: 0 } }
      }
    },

    boundary: {
      popupEnabled: false,
      renderer: {
        type: "simple",
        symbol: { type: "simple-fill", color: [0,0,0,0], outline: { color: c(PAL.boundary, 0.90), width: W.boundary, style: "dash" } }
      }
    },

    boundaryHalo: {
      popupEnabled: false,
      renderer: {
        type: "simple",
        symbol: { type: "simple-fill", color: [0,0,0,0], outline: { color: c(PAL.boundary, 0.28), width: W.boundaryHalo } }
      }
    },

    // ── Car-centered bike renderers (scene 0, 1, swipe left side) ──
    // Bike paths: thin muted green, low bloom — reads like a standard map layer
    bikePathNormal: {
      popupEnabled: false,
      blendMode: "normal",
      renderer: {
        type: "unique-value",
        field: "Type",
        defaultSymbol: sl(PAL.bikeGreenPath, 0.65, 0.8),
        uniqueValueInfos: [
          { value: "Multi-use Trail",   symbol: sl(PAL.bikeGreenPath, 0.72, 1.0) },
          { value: "Multi-use Path",    symbol: sl(PAL.bikeGreenPath, 0.72, 1.0) },
          { value: "Off-Road Facility", symbol: sl(PAL.bikeGreenPath, 0.60, 0.7) },
          { value: "Sharrows",          symbol: { type: "simple-line", color: c(PAL.bikeGreenPath, 0.40), width: 0.5, style: "short-dash" } }
        ]
      }
    },

    // Bike lanes: even thinner, more transparent, standard dot pattern
    bikeLaneNormal: {
      popupEnabled: false,
      blendMode: "normal",
      renderer: {
        type: "simple",
        symbol: { type: "simple-line", color: c(PAL.bikeGreenLane, 0.38), width: 0.45, style: "short-dot" }
      }
    },

    // ── Road shadow underlays (3 tiers, below main road layer) ──
    // Black blurred lines give fast roads a "heavy" visual presence.
    // Tier A (motorway) = widest halo; Tier C (secondary) = narrowest.
    shadowA: {
      popupEnabled: false,
      definitionExpression: "fclass IN ('motorway','motorway_link')",
      effect: FX.shadowA,
      renderer: { type: "simple", symbol: { type: "simple-line", color: [0,0,0,0.88], width: W.shadowA } }
    },
    shadowB: {
      popupEnabled: false,
      definitionExpression: "fclass IN ('trunk','trunk_link','primary','primary_link')",
      effect: FX.shadowB,
      renderer: { type: "simple", symbol: { type: "simple-line", color: [0,0,0,0.80], width: W.shadowB } }
    },
    shadowC: {
      popupEnabled: false,
      definitionExpression: "fclass IN ('secondary','secondary_link','tertiary_link')",
      effect: FX.shadowC,
      renderer: { type: "simple", symbol: { type: "simple-line", color: [0,0,0,0.65], width: W.shadowC } }
    }
  };

  // ── Export ───────────────────────────────────────────────────
  window.ATHENS_CONFIG = { PAL: PAL, W: W, FX: FX, LBL: LBL, VIEW: VIEW, invertedRenderer: invertedRenderer, normalRenderer: normalRenderer, layerOpts: layerOpts };

}());
