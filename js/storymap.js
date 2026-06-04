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
  var roadLayer, roadSwipeLayer, bikePathLayer, bikeLaneLayer, repairLayer;
  var bikePathSwipeLayer, bikeLaneSwipeLayer;
  var shadowA, shadowB, shadowC;
  var swipeWidget = null;

  // Road layer for swipe leading side (conventional renderer, hidden until scene 8)
  var roadNormalOpts = { labelsVisible: false, renderer: CFG.normalRenderer, visible: false };

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
    makeLayer("data/road_all.geojson",          Object.assign({}, L.roads, { labelsVisible: false })), // 6  main road layer
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

  function clearHL() {
    highlightLayer.removeAll();
  }

  // Scene 0 — title / opening: show conventional map
  function s0() {
    setNormal(); clearHL(); restoreOpacity();
    view.goTo(FULL, FLY_FAST);
  }

  // Scene 1 — "the familiar map": conventional renderer, full extent
  function s1() {
    setNormal(); clearHL(); restoreOpacity();
    view.goTo(FULL, FLY);
  }

  // Scene 2 — "a different measure": switch to inverted renderer
  function s2() {
    setInverted(); clearHL(); restoreOpacity();
    view.goTo(FULL, FLY);
  }

  // Scene 3 — College Avenue: zoom downtown, highlight road by name
  function s3() {
    setInverted(); restoreOpacity(); clearHL();
    view.goTo({ center: [-83.3745, 33.9592], scale: 14000 }, FLY).then(function () {
      roadLayer.queryFeatures({
        where: "name LIKE '%College%'",
        returnGeometry: true,
        outFields: ["name"]
      }).then(function (result) {
        result.features.forEach(function (f) {
          highlightLayer.add(new Graphic({
            geometry: f.geometry,
            symbol: { type: "simple-line", color: [PAL.highlight[0], PAL.highlight[1], PAL.highlight[2], 0.80], width: 5 }
          }));
        });
      });
    });
  }

  // Scene 4 — River / bridges: zoom west Athens, mark inaccessible bridge crossings
  function s4() {
    setInverted(); restoreOpacity(); clearHL();
    view.goTo({ center: [-83.413, 33.9435], scale: 22000 }, FLY).then(function () {
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
    });
  }

  // Scene 5 — Park connectors: zoom SE Athens where arterials link parks
  function s5() {
    setInverted(); restoreOpacity(); clearHL();
    view.goTo({ center: [-83.355, 33.9295], scale: 30000 }, FLY);
  }

  // Scene 6 — Bike network: fade roads, foreground the gold lines
  function s6() {
    setInverted(); clearHL();
    roadLayer.opacity = 0.15;
    view.goTo(FULL, FLY);
  }

  function hideSwipeBikeLayers() {
    if (bikePathSwipeLayer) bikePathSwipeLayer.visible = false;
    if (bikeLaneSwipeLayer) bikeLaneSwipeLayer.visible = false;
  }

  // Scene 7 — Closing: restore full map
  function s7() {
    setInverted(); clearHL(); restoreOpacity();
    if (swipeWidget) { swipeWidget.destroy(); swipeWidget = null; }
    roadSwipeLayer.visible = false;
    hideSwipeBikeLayers();
    view.goTo(FULL, FLY);
  }

  // Scene 8 — Swipe: conventional (left) vs inverted (right)
  // leadingLayers uses car-centered road + bike layers so left side
  // exactly matches scene 0/1 car map style.
  function s8() {
    hideStaticOverlay();
    setInverted(); clearHL(); restoreOpacity();
    // Car side (leading) must match scene 1 — no repair stations
    if (repairLayer) repairLayer.visible = false;
    roadSwipeLayer.visible     = true;
    bikePathSwipeLayer.visible = true;
    bikeLaneSwipeLayer.visible = true;
    view.goTo(FULL, FLY_FAST);
    if (!swipeWidget) {
      swipeWidget = new Swipe({
        view:           view,
        leadingLayers:  [roadSwipeLayer, bikePathSwipeLayer, bikeLaneSwipeLayer],
        trailingLayers: [roadLayer, bikePathLayer, bikeLaneLayer],
        position:  50,
        direction: "horizontal"
      });
      view.ui.add(swipeWidget);
    }
  }

  // Scene 9 — Static map: fade in the print-ready image over the interactive map
  var staticOverlay = document.getElementById('static-overlay');

  function showStaticOverlay() {
    if (staticOverlay) staticOverlay.classList.add('visible');
  }
  function hideStaticOverlay() {
    if (staticOverlay) staticOverlay.classList.remove('visible');
  }

  function s9() {
    setInverted(); clearHL(); restoreOpacity();
    if (swipeWidget) { swipeWidget.destroy(); swipeWidget = null; }
    roadSwipeLayer.visible = false;
    hideSwipeBikeLayers();
    view.goTo(FULL, FLY_FAST);
    showStaticOverlay();
  }

  var SCENE_FNS = [s0, s1, s2, s3, s4, s5, s6, s7, s8, s9];

  // ── IntersectionObserver + nav dots ─────────────────────────
  function initStory() {
    var sceneEls = document.querySelectorAll('.scene');
    var dots     = document.querySelectorAll('.dot');

    function activate(id) {
      if (id !== 9) hideStaticOverlay();
      if (SCENE_FNS[id]) SCENE_FNS[id]();
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
