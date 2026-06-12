// All visual styles live in js/map-config.js → window.ATHENS_CONFIG
// Edit colours, widths, effects, and label settings there.

require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/GeoJSONLayer",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/geometry/SpatialReference",
  "esri/widgets/Swipe",
  "esri/widgets/Zoom",
  "esri/widgets/Home",
  "esri/widgets/Compass",
  "esri/widgets/ScaleBar"
], function (Map, MapView, GeoJSONLayer, GraphicsLayer, Graphic, SpatialReference, Swipe, Zoom, Home, Compass, ScaleBar) {

  var CFG = window.ATHENS_CONFIG;
  var V   = CFG.VIEW;
  var FX  = CFG.FX;
  var PAL = CFG.PAL;
  var L   = CFG.layerOpts;

  // ── Projection ───────────────────────────────────────────────
  var athensSR = new SpatialReference({
    wkt: 'PROJCS["Athens_AzimuthalEquidistant",' +
           'GEOGCS["GCS_WGS_1984",' +
             'DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],' +
             'PRIMEM["Greenwich",0.0],' +
             'UNIT["Degree",0.0174532925199433]],' +
           'PROJECTION["Azimuthal_Equidistant"],' +
           'PARAMETER["False_Easting",0.0],' +
           'PARAMETER["False_Northing",0.0],' +
           'PARAMETER["Central_Meridian",-83.389],' +
           'PARAMETER["Latitude_Of_Origin",33.952],' +
           'UNIT["Meter",1.0]]'
  });

  var map  = new Map({ basemap: null });

  var view = new MapView({
    container: "viewDiv",
    map: map,
    spatialReference: athensSR,
    center: V.center,
    scale:  V.scale,
    environment: { bloomEnabled: true },
    constraints: {
      minScale: V.minScale,
      maxScale: V.maxScale,
      geometry: {
        type: "extent",
        xmin: V.panBounds.xmin, ymin: V.panBounds.ymin,
        xmax: V.panBounds.xmax, ymax: V.panBounds.ymax,
        spatialReference: { wkid: 4326 }
      }
    },
    background: { color: V.background },
    ui: { components: ["attribution"] }
  });

  view.popup.autoOpenEnabled = false;

  // ── Navigation widgets ───────────────────────────────────────
  view.when(function () {
    var zoom     = new Zoom({ view: view });
    var home     = new Home({ view: view });
    var compass  = new Compass({ view: view });
    var scaleBar = new ScaleBar({ view: view, unit: "imperial" });

    view.ui.add(zoom,     { position: "top-left",  index: 0 });
    view.ui.add(home,     { position: "top-left",  index: 1 });
    view.ui.add(compass,  { position: "top-right", index: 0 });
    view.ui.add(scaleBar, { position: "bottom-left" });
  });

  var highlightLayer = new GraphicsLayer({ effect: FX.hlLayer });

  // ── Layer factory ────────────────────────────────────────────
  function makeLayer(path, opts) {
    return fetch(path)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var blob = new Blob([JSON.stringify(data)], { type: "application/json" });
        return new GeoJSONLayer(Object.assign({ url: URL.createObjectURL(blob) }, opts));
      });
  }

  // ── Layer refs populated after Promise.all ───────────────────
  var roadLayer, roadSwipeLayer, bikePathLayer, bikeLaneLayer, repairLayer, parkLayer;
  var bikePathSwipeLayer, bikeLaneSwipeLayer;
  var shadowA, shadowB, shadowC;
  var swipeWidget = null;

  // Road layer for swipe leading side (conventional renderer, hidden until scene 8)
  var roadNormalOpts = Object.assign({}, L.roads, {
    effect: null,
    labelsVisible: false,
    labelingInfo: L.roads.labelingInfo,
    renderer: CFG.normalRenderer,
    visible: false
  });

  // Load order (bottom → top):
  //   parks → UGA → water → shadows (C,B,A) → roads → swipe road (hidden)
  //   → bike path → bike lane → repair → mask → boundary halo → boundary → highlight
  //   + two hidden car-centered bike layers for swipe leading side (14, 15)
  Promise.all([
    makeLayer("data/park_athens.geojson",      L.park),            // 0
    makeLayer("data/uga_athens.geojson",        L.uga),             // 1
    makeLayer("data/waterways_athens.geojson",  L.water),           // 2
    makeLayer("data/road_all.geojson",          L.shadowC),         // 3
    makeLayer("data/road_all.geojson",          L.shadowB),         // 4
    makeLayer("data/road_all.geojson",          L.shadowA),         // 5
    makeLayer("data/road_all.geojson",          L.roads),          // 6  main road layer
    makeLayer("data/road_all.geojson",          roadNormalOpts),    // 7  swipe normal (hidden)
    makeLayer("data/bike_path.geojson",         L.bikePath),        // 8
    makeLayer("data/bike_lane.geojson",         L.bikeLane),        // 9
    makeLayer("data/repair_station.geojson",    L.repair),          // 10
    makeLayer("data/athens_mask.geojson",       L.mask),            // 11
    makeLayer("data/athens.geojson",            L.boundaryHalo),    // 12
    makeLayer("data/athens.geojson",            L.boundary),        // 13
    makeLayer("data/bike_path.geojson",         Object.assign({}, L.bikePathNormal, { visible: false })), // 14 swipe car bike path
    makeLayer("data/bike_lane.geojson",         Object.assign({}, L.bikeLaneNormal, { visible: false }))  // 15 swipe car bike lane
  ]).then(function (layers) {
    parkLayer          = layers[0];
    roadLayer          = layers[6];
    roadSwipeLayer     = layers[7];
    bikePathLayer      = layers[8];
    bikeLaneLayer      = layers[9];
    shadowA            = layers[5];
    shadowB            = layers[4];
    shadowC            = layers[3];
    repairLayer        = layers[10];
    bikePathSwipeLayer = layers[14];
    bikeLaneSwipeLayer = layers[15];

    layers.forEach(function (lyr) { map.add(lyr); });
    map.add(highlightLayer);

    function updateStreetLabels(scale) {
      var labelsVisible = scale <= V.maxScale * 2.25;
      roadLayer.labelsVisible = labelsVisible;
      roadSwipeLayer.labelsVisible = labelsVisible;
    }

    updateStreetLabels(view.scale);
    view.watch("scale", function (scale) {
      updateStreetLabels(scale);
    });

    initStory();
  });

  // ════════════════════════════════════════════════════════════
  // SCENE SYSTEM
  // ════════════════════════════════════════════════════════════

  var FULL = { center: V.center, scale: V.scale };
  var FLY  = { duration: 1500, easing: "in-out-expo" };
  var FLY_FAST = { duration: 900, easing: "in-out-expo" };

  function setInverted() {
    roadLayer.renderer = CFG.invertedRenderer;
    roadLayer.effect   = FX.roadInv;
    shadowA.visible    = true;
    shadowB.visible    = true;
    shadowC.visible    = true;
    if (repairLayer) repairLayer.visible = true;
    // Bike-centered: gold, high-bloom, lighten blend
    if (bikePathLayer) {
      bikePathLayer.renderer  = L.bikePath.renderer;
      bikePathLayer.effect    = FX.bikePath;
      bikePathLayer.blendMode = "lighten";
    }
    if (bikeLaneLayer) {
      bikeLaneLayer.renderer  = L.bikeLane.renderer;
      bikeLaneLayer.effect    = FX.bikeLane;
      bikeLaneLayer.blendMode = "lighten";
    }
  }

  function setNormal() {
    roadLayer.renderer = CFG.normalRenderer;
    roadLayer.effect   = null;
    shadowA.visible    = false;
    shadowB.visible    = false;
    shadowC.visible    = false;
    if (repairLayer) repairLayer.visible = false;
    // Car-centered: muted green, minimal bloom, normal blend
    if (bikePathLayer) {
      bikePathLayer.renderer  = L.bikePathNormal.renderer;
      bikePathLayer.blendMode = "normal";
    }
    if (bikeLaneLayer) {
      bikeLaneLayer.renderer  = L.bikeLaneNormal.renderer;
      bikeLaneLayer.blendMode = "normal";
    }
  }

  function restoreOpacity() {
    if (roadLayer)     roadLayer.opacity     = 1;
    if (bikePathLayer) bikePathLayer.opacity = 1;
    if (bikeLaneLayer) bikeLaneLayer.opacity = 1;
  }

  function restoreParks() {
    if (!parkLayer) return;
    parkLayer.renderer = L.park.renderer;
    parkLayer.effect = null;
  }

  function highlightParks() {
    if (!parkLayer) return;
    parkLayer.renderer = {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [116, 158, 92, 0.70],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }
    };
    parkLayer.effect = "bloom(0.62, 2px, 0.06)";
  }

  function clearHL() {
    highlightLayer.removeAll();
  }

  // Scene 0 — Athens, Georgia: Cyclist Survival Map
  function s0() {
    setNormal(); clearHL(); restoreOpacity(); restoreParks();
    view.goTo(FULL, FLY_FAST);
  }

  // Scene 1 — Starting point: The map you already know
  function s1() {
    setNormal(); clearHL(); restoreOpacity(); restoreParks();
    view.goTo(FULL, FLY);
  }

  // Scene 2 — Inversion: A different measure
  function s2() {
    setInverted(); clearHL(); restoreOpacity(); restoreParks();
    view.goTo(FULL, FLY);
  }

  // Scene 3 — Major corridor: Broad Street
  function s3(activationId) {
    setInverted(); restoreOpacity(); restoreParks(); clearHL();
    roadLayer.queryFeatures({
      where: "name IN ('Atlanta Highway', 'West Broad Street', 'East Broad Street', 'Oconee Street', 'Oak Street', 'Lexington Road', 'Lexington Highway')",
      returnGeometry: true,
      outFields: ["name", "fclass"],
      outSpatialReference: { wkid: 4326 }
    }).then(function (result) {
      if (activationId !== activeActivationId) return;
      var broadStreetRed = [235, 68, 68];
      var thomasStreetLongitude = -83.3727684;
      var forkWestLongitude = -83.3673012;
      var forkEastLongitude = -83.3599334;
      result.features.filter(function (f) {
        var name = f.attributes.name;
        var extent = f.geometry.extent;

        if (name === "East Broad Street") {
          return extent.xmax <= thomasStreetLongitude + 0.000001;
        }

        if (name === "Oconee Street") {
          var isLowerFork = extent.xmin >= forkWestLongitude - 0.000001 &&
            extent.xmax <= forkEastLongitude + 0.000001;
          return !isLowerFork;
        }

        if (name === "Lexington Road") {
          return f.attributes.fclass === "trunk";
        }

        return true;
      }).forEach(function (f) {
        var isBroadStreet = f.attributes.name === "West Broad Street" ||
          f.attributes.name === "East Broad Street";
        highlightLayer.add(new Graphic({
          geometry: f.geometry,
            symbol: {
              type: "simple-line",
              color: [broadStreetRed[0], broadStreetRed[1], broadStreetRed[2], isBroadStreet ? 0.90 : 0.78],
              width: isBroadStreet ? 7 : 1.25,
              style: "solid"
            }
          }));
      });
      view.goTo({ center: [-83.3825, 33.9360], scale: 90000 }, FLY);
    });
  }

  // Scene 4 — River crossings: Two inaccessible bridges
  function s4() {
    setInverted(); restoreOpacity(); restoreParks(); clearHL();
    // Road-river crossings over the Middle Oconee River
    var bridgeRed = [235, 68, 68];
    var bridges = [[-83.42295, 33.94690], [-83.39013, 33.91855]];
    bridges.forEach(function (coords) {
      var geo = { type: "point", longitude: coords[0], latitude: coords[1] };
      // Circle ring
      highlightLayer.add(new Graphic({ geometry: geo, symbol: { type: "simple-marker", style: "circle", color: [0,0,0,0], size: 26, outline: { color: [bridgeRed[0],bridgeRed[1],bridgeRed[2],0.9], width: 2.5 } } }));
      // X mark — signals "inaccessible"
      highlightLayer.add(new Graphic({ geometry: geo, symbol: { type: "simple-marker", style: "x",      color: [bridgeRed[0],bridgeRed[1],bridgeRed[2],0.95],  size: 11, outline: { color: [bridgeRed[0],bridgeRed[1],bridgeRed[2],0.95], width: 2 } } }));
    });
    view.goTo({ center: [-83.413, 33.9435], scale: 22000 }, FLY);
  }

  // Scene 5 — Green spaces: Park connectors
  function s5() {
    setInverted(); restoreOpacity(); clearHL();
    highlightParks();
    view.goTo(FULL, FLY);
  }

  // Scene 6 — Infrastructure: The bike network
  function s6() {
    setInverted(); clearHL(); restoreParks();
    roadLayer.opacity = 0.15;
    view.goTo(FULL, FLY);
  }

  function hideSwipeBikeLayers() {
    if (bikePathSwipeLayer) bikePathSwipeLayer.visible = false;
    if (bikeLaneSwipeLayer) bikeLaneSwipeLayer.visible = false;
  }

  // Scene 7 — Reading the map: What the map reveals
  function s7() {
    setInverted(); clearHL(); restoreOpacity(); restoreParks();
    if (swipeWidget) { swipeWidget.destroy(); swipeWidget = null; }
    roadSwipeLayer.visible = false;
    hideSwipeBikeLayers();
    view.goTo(FULL, FLY);
  }

  // Scene 8 — Comparison: Two maps, one city
  // leadingLayers uses car-centered road + bike layers so left side
  // exactly matches scene 0/1 car map style.
  function s8() {
    hideStaticOverlay();
    setInverted(); clearHL(); restoreOpacity(); restoreParks();
    var showStreetLabels = view.scale <= V.maxScale * 2.25;
    roadLayer.labelsVisible = showStreetLabels;
    roadSwipeLayer.labelsVisible = showStreetLabels;
    roadSwipeLayer.visible     = true;
    bikePathSwipeLayer.visible = true;
    bikeLaneSwipeLayer.visible = true;
    if (!swipeWidget) {
      swipeWidget = new Swipe({
        view:           view,
        leadingLayers:  [roadSwipeLayer, bikePathSwipeLayer, bikeLaneSwipeLayer],
        trailingLayers: [roadLayer, bikePathLayer, bikeLaneLayer, repairLayer],
        position:  50,
        direction: "horizontal"
      });
      view.ui.add(swipeWidget);
    }
    view.goTo(FULL, FLY_FAST);
  }

  // Scene 9 — Static edition: The shareable map
  var staticOverlay = document.getElementById('static-overlay');

  function showStaticOverlay() {
    if (staticOverlay) staticOverlay.classList.add('visible');
  }
  function hideStaticOverlay() {
    if (staticOverlay) staticOverlay.classList.remove('visible');
  }

  function s9() {
    setInverted(); clearHL(); restoreOpacity(); restoreParks();
    if (swipeWidget) { swipeWidget.destroy(); swipeWidget = null; }
    roadSwipeLayer.visible = false;
    hideSwipeBikeLayers();
    showStaticOverlay();
    view.goTo(FULL, FLY_FAST);
  }

  var SCENE_FNS = [s0, s1, s2, s3, s4, s5, s6, s7, s8, s9];
  var activeActivationId = 0;

  // ── IntersectionObserver + nav dots ─────────────────────────
  function initStory() {
    var sceneEls = document.querySelectorAll('.scene');
    var dots     = document.querySelectorAll('.dot');

    function activate(id) {
      activeActivationId += 1;
      if (id !== 9) hideStaticOverlay();
      if (SCENE_FNS[id]) SCENE_FNS[id](activeActivationId);
      dots.forEach(function (d, i) { d.classList.toggle('active', i === id); });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) activate(parseInt(e.target.dataset.scene));
      });
    }, {
      root:       document.getElementById('story-pane'),
      rootMargin: '-45% 0px -45% 0px',
      threshold:  0
    });

    sceneEls.forEach(function (s) { observer.observe(s); });

    // Scroll progress bar
    var pane = document.getElementById('story-pane');
    var fill = document.getElementById('scroll-bar-fill');
    if (pane && fill) {
      pane.addEventListener('scroll', function () {
        var pct = pane.scrollTop / (pane.scrollHeight - pane.clientHeight) * 100;
        fill.style.width = Math.min(pct, 100) + '%';
      });
    }

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        var target = parseInt(dot.dataset.target);
        sceneEls[target].scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    activate(0);
  }


});
