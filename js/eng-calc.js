(function () {
  'use strict';

  function getTablesApi(tablesApi) {
    var api = tablesApi || window.EngTables;
    if (!api || typeof api.get !== 'function') {
      throw new Error('EngTables is not available. Load js/eng-tables.js first.');
    }
    return api;
  }

  function requireTable(api, name) {
    var tbl = api.get(name);
    if (!tbl || !Array.isArray(tbl.rows)) {
      throw new Error('Engineering table not loaded or missing: ' + name);
    }
    return tbl;
  }

  function resolveAmpacityTableName(opts) {
    if (opts.tableName) {
      return opts.tableName;
    }
    var ins = String(opts.insulation || 'XLPE').toLowerCase();
    var cond = String(opts.conductor || 'Cu').toLowerCase();
    var cores = Number(opts.cores || (Number(opts.phases) === 1 ? 2 : 3));
    var method = String(opts.method || 'air').toLowerCase();
    return 'cable_ampacity_' + ins + '_' + cond + '_' + cores + 'c_' + method;
  }

  function getAmbientFactor(api, method, ambientC, insulation) {
    var factorName = String(method || 'air').toLowerCase() === 'ground'
      ? 'ambient_ground'
      : 'ambient_air';
    var tbl = requireTable(api, factorName);
    var insKey = String(insulation || 'XLPE').toLowerCase();
    var refTemp = tbl.conditions && typeof tbl.conditions.reference_ambient_c === 'number'
      ? tbl.conditions.reference_ambient_c
      : null;
    var targetTemp = typeof ambientC === 'number' && !isNaN(ambientC) ? ambientC : refTemp;

    var sorted = tbl.rows.slice().sort(function (a, b) {
      return a.temp_c - b.temp_c;
    });

    var row = sorted.find(function (r) {
      return r.temp_c === targetTemp;
    });
    if (!row && typeof targetTemp === 'number') {
      row = sorted.find(function (r) {
        return r.temp_c >= targetTemp;
      }) || sorted[sorted.length - 1];
    }
    if (!row || typeof row[insKey] !== 'number') {
      throw new Error('Ambient factor not found in ' + factorName + ' for ' + insKey + ' at ' + targetTemp);
    }
    return { factor: row[insKey], temp_c: row.temp_c, table: api.meta(factorName) };
  }

  function getGroupingFactor(api, circuits) {
    var tbl = requireTable(api, 'grouping');
    var count = typeof circuits === 'number' && circuits >= 1 ? Math.round(circuits) : 1;
    var sorted = tbl.rows.slice().sort(function (a, b) {
      return a.circuits - b.circuits;
    });
    var row = sorted.find(function (r) {
      return r.circuits === count;
    });
    if (!row) {
      row = count > sorted[sorted.length - 1].circuits
        ? sorted[sorted.length - 1]
        : sorted[0];
    }
    return { factor: row.value, circuits: row.circuits, table: api.meta('grouping') };
  }

  function computeDesignCurrent(opts) {
    if (typeof opts.currentA === 'number' && !isNaN(opts.currentA) && opts.currentA > 0) {
      return opts.currentA;
    }
    if (typeof opts.designCurrentA === 'number' && !isNaN(opts.designCurrentA) && opts.designCurrentA > 0) {
      return opts.designCurrentA;
    }
    if (typeof opts.powerKw === 'number' && opts.powerKw > 0) {
      var phases = Number(opts.phases || 3);
      var voltageV = Number(opts.voltageV || (phases === 1 ? 230 : 400));
      var pf = typeof opts.powerFactor === 'number' && opts.powerFactor > 0 ? opts.powerFactor : 0.85;
      var denom = phases === 1 ? (voltageV * pf) : (Math.sqrt(3) * voltageV * pf);
      return (opts.powerKw * 1000) / denom;
    }
    throw new Error('Provide positive currentA (or powerKw with voltageV).');
  }

  function voltageDrop(input, tablesApi) {
    var opts = input || {};
    var api = getTablesApi(tablesApi);
    var size = Number(opts.size_mm2);
    var currentA = Number(opts.currentA);
    var lengthM = Number(opts.lengthM);
    var phases = Number(opts.phases || 3);
    var voltageV = Number(opts.voltageV || (phases === 1 ? 230 : 400));
    var conductor = String(opts.conductor || 'Cu');
    var insulation = String(opts.insulation || 'XLPE').toUpperCase();
    var pf = typeof opts.powerFactor === 'number' ? opts.powerFactor : 0.85;
    var method = String(opts.method || 'auto').toLowerCase();

    if (!(size > 0) || !(currentA > 0) || !(lengthM > 0) || !(voltageV > 0)) {
      throw new Error('voltageDrop requires positive size_mm2, currentA, lengthM, and voltageV.');
    }

    if (method === 'mv_a_m' || method === '4d1b') {
      var mvTableName = 'vdrop_mv_a_m_4d1b';
      requireTable(api, mvTableName);
      var mvRow = api.lookup(mvTableName, 'size_mm2', size);
      if (!mvRow) {
        throw new Error('Size ' + size + ' mm2 not found in ' + mvTableName);
      }
      var mvKey = phases === 1 ? 'mv_1ph' : 'mv_3ph';
      var mvVal = mvRow[mvKey];
      var vdropMv = (mvVal * currentA * lengthM) / 1000;
      return {
        size_mm2: size,
        vdropV: Number(vdropMv.toFixed(3)),
        vdropPct: Number(((vdropMv / voltageV) * 100).toFixed(3)),
        voltageV: voltageV,
        phases: phases,
        conductor: conductor,
        methodUsed: mvTableName,
        table: api.meta(mvTableName)
      };
    }

    var resTableName = 'conductor_resistance_iec60228';
    var resTbl = requireTable(api, resTableName);
    var conds = resTbl.conditions || {};
    var resRow = api.lookup(resTableName, 'size_mm2', size);
    var condKey = conductor.toLowerCase() === 'al' ? 'r20_al' : 'r20_cu';
    if (!resRow || typeof resRow[condKey] !== 'number') {
      throw new Error('Resistance not available for ' + conductor + ' ' + size + ' mm2 in ' + resTableName);
    }

    var r20 = resRow[condKey];
    var refTempC = typeof conds.temp_c === 'number' ? conds.temp_c : 20;
    var defaultOpTempC = typeof opts.operatingTempC === 'number'
      ? opts.operatingTempC
      : (insulation === 'PVC' ? 70 : 90);
    var alpha = conductor.toLowerCase() === 'al'
      ? Number(conds.alpha_al)
      : Number(conds.alpha_cu);
    var x = typeof opts.reactanceOhmKm === 'number'
      ? opts.reactanceOhmKm
      : Number(conds.reactance_default_ohm_km);

    var rOp = r20 * (1 + alpha * (defaultOpTempC - refTempC));
    var sinPhi = Math.sqrt(Math.max(0, 1 - pf * pf));
    var kPhase = phases === 1 ? 2 : Math.sqrt(3);
    var vdropV = kPhase * currentA * (lengthM / 1000) * (rOp * pf + x * sinPhi);

    return {
      size_mm2: size,
      vdropV: Number(vdropV.toFixed(3)),
      vdropPct: Number(((vdropV / voltageV) * 100).toFixed(3)),
      voltageV: voltageV,
      phases: phases,
      conductor: conductor,
      operatingTempC: defaultOpTempC,
      rOpOhmKm: Number(rOp.toFixed(4)),
      xOhmKm: x,
      methodUsed: resTableName,
      table: api.meta(resTableName)
    };
  }

  function cableSizing(input, tablesApi) {
    var opts = input || {};
    var api = getTablesApi(tablesApi);
    var designCurrentA = computeDesignCurrent(opts);
    var tableName = resolveAmpacityTableName(opts);
    var tbl = requireTable(api, tableName);

    var caInfo = getAmbientFactor(api, opts.method || 'air', opts.ambientC, opts.insulation || 'XLPE');
    var cgInfo = getGroupingFactor(api, opts.circuits);
    var combinedFactor = caInfo.factor * cgInfo.factor;
    var requiredBaseAmpacityA = designCurrentA / combinedFactor;

    var sortedRows = tbl.rows.slice().sort(function (a, b) {
      return a.size_mm2 - b.size_mm2;
    });

    var checkVdrop = typeof opts.lengthM === 'number' && opts.lengthM > 0 &&
      typeof opts.maxVdropPct === 'number' && opts.maxVdropPct > 0;

    var selectedRow = null;
    var selectedVdrop = null;

    for (var i = 0; i < sortedRows.length; i += 1) {
      var row = sortedRows[i];
      if (row.value < requiredBaseAmpacityA) {
        continue;
      }
      if (checkVdrop) {
        var vd = voltageDrop({
          size_mm2: row.size_mm2,
          currentA: designCurrentA,
          lengthM: opts.lengthM,
          voltageV: opts.voltageV,
          phases: opts.phases || (Number(opts.cores) === 2 ? 1 : 3),
          conductor: opts.conductor || 'Cu',
          insulation: opts.insulation || 'XLPE',
          powerFactor: opts.powerFactor,
          operatingTempC: opts.operatingTempC
        }, api);
        if (vd.vdropPct > opts.maxVdropPct) {
          continue;
        }
        selectedVdrop = vd;
      }
      selectedRow = row;
      break;
    }

    if (!selectedRow) {
      return {
        compliant: false,
        size_mm2: null,
        designCurrentA: Number(designCurrentA.toFixed(2)),
        requiredBaseAmpacityA: Number(requiredBaseAmpacityA.toFixed(2)),
        factors: {
          ca: caInfo.factor,
          cg: cgInfo.factor,
          combined: Number(combinedFactor.toFixed(4))
        },
        table: api.meta(tableName),
        vdrop: selectedVdrop
      };
    }

    if (!selectedVdrop && typeof opts.lengthM === 'number' && opts.lengthM > 0) {
      selectedVdrop = voltageDrop({
        size_mm2: selectedRow.size_mm2,
        currentA: designCurrentA,
        lengthM: opts.lengthM,
        voltageV: opts.voltageV,
        phases: opts.phases || (Number(opts.cores) === 2 ? 1 : 3),
        conductor: opts.conductor || 'Cu',
        insulation: opts.insulation || 'XLPE',
        powerFactor: opts.powerFactor,
        operatingTempC: opts.operatingTempC
      }, api);
    }

    return {
      compliant: true,
      size_mm2: selectedRow.size_mm2,
      baseAmpacityA: selectedRow.value,
      deratedAmpacityA: Number((selectedRow.value * combinedFactor).toFixed(2)),
      designCurrentA: Number(designCurrentA.toFixed(2)),
      requiredBaseAmpacityA: Number(requiredBaseAmpacityA.toFixed(2)),
      factors: {
        ca: caInfo.factor,
        cg: cgInfo.factor,
        combined: Number(combinedFactor.toFixed(4))
      },
      table: api.meta(tableName),
      vdrop: selectedVdrop
    };
  }

  function breakerSelection(input, tablesApi) {
    var opts = input || {};
    var api = getTablesApi(tablesApi);
    var tableName = 'breaker_ratings_standard';
    var tbl = requireTable(api, tableName);

    var designCurrentA = Number(opts.designCurrentA || opts.currentA || opts.ib);
    if (!(designCurrentA > 0)) {
      throw new Error('breakerSelection requires positive designCurrentA.');
    }

    var safetyFactor = typeof opts.safetyFactor === 'number' && opts.safetyFactor > 0 ? opts.safetyFactor : 1;
    var requiredIn = designCurrentA * safetyFactor;
    var filterType = opts.type && String(opts.type).toLowerCase() !== 'any'
      ? String(opts.type).toUpperCase()
      : null;

    var candidates = tbl.rows
      .filter(function (r) {
        return !filterType || String(r.type).toUpperCase() === filterType;
      })
      .sort(function (a, b) {
        return a.rating_a - b.rating_a;
      });

    var selected = candidates.find(function (r) {
      return r.rating_a >= requiredIn;
    }) || null;

    var cableAmpacityA = typeof opts.cableAmpacityA === 'number' && opts.cableAmpacityA > 0
      ? opts.cableAmpacityA
      : (typeof opts.iz === 'number' && opts.iz > 0 ? opts.iz : null);

    var coordinated = Boolean(
      selected &&
      selected.rating_a >= designCurrentA &&
      (cableAmpacityA === null || selected.rating_a <= cableAmpacityA)
    );

    return {
      rating_a: selected ? selected.rating_a : null,
      type: selected ? selected.type : null,
      designCurrentA: Number(designCurrentA.toFixed(2)),
      cableAmpacityA: cableAmpacityA,
      coordinated: coordinated,
      table: api.meta(tableName)
    };
  }

  window.EngCalc = {
    cableSizing: cableSizing,
    voltageDrop: voltageDrop,
    breakerSelection: breakerSelection
  };
})();
